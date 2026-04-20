// Generate back image prompt using frontal image + back product photo via Claude
//
// HISTÓRICO:
// v2.8 — (anterior) sem proteções; prompt vago causava "looking over shoulder".
// v2.9 — 4 camadas: sanitização de frontal, anatomy-of-back, simplicity guard,
//        negative forçado anti-pose. Resolveu torção mas causou Frankenstein
//        quando combinado com anchor v3.0 no image.js.
// v3.1 — SIMPLIFICAÇÃO GERAL:
//        Projeto legado comprovou que Nano Banana quer prompts CURTOS pra back.
//        Mudanças: system prompt reduzido a ~30 linhas (era ~50), saiu o template
//        obrigatório "back fully to camera, head aligned with spine", negative
//        trocado pra anti-anatomia-ruim (padrão Lígia). Mantida a sanitização
//        de frontal (camada A) — é útil e barata.

// ─── Camada A: padrões de contaminação frontal ───
// Removidos ANTES de passar o prompt frontal para o Claude, pra evitar que
// ele herde a orientação de contato visual no prompt de costas.
const FRONTAL_CONTAMINATION_PATTERNS = [
  /looking\s+(?:directly\s+|straight\s+|right\s+)?(?:at|into|toward[s]?)\s+(?:the\s+)?camera/gi,
  /looking\s+at\s+(?:the\s+)?viewer/gi,
  /eye\s+contact(?:\s+with\s+(?:the\s+)?(?:viewer|camera))?/gi,
  /eyes\s+on\s+(?:the\s+)?camera/gi,
  /gazing\s+(?:at|into|toward[s]?)\s+(?:the\s+)?(?:camera|viewer)/gi,
  /direct\s+gaze(?:\s+(?:at|into|toward[s]?)\s+(?:the\s+)?(?:camera|viewer))?/gi,
  /facing\s+(?:the\s+)?camera/gi,
  /front-facing\s+pose/gi,
  /(?:soft|warm|gentle|bright|friendly)\s+smile\s+at\s+(?:the\s+)?(?:camera|viewer)/gi,
  /smiling\s+at\s+(?:the\s+)?(?:camera|viewer)/gi,
  /warm\s+expression\s+at\s+(?:the\s+)?(?:viewer|camera)/gi,
];

function sanitizeFrontalPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return { cleaned: prompt || '', removedCount: 0, warning: null };
  }
  const originalLen = prompt.length;
  let cleaned = prompt;
  let removedCount = 0;

  for (const pattern of FRONTAL_CONTAMINATION_PATTERNS) {
    const matches = cleaned.match(pattern);
    if (matches) {
      removedCount += matches.length;
      cleaned = cleaned.replace(pattern, '');
    }
  }

  // Limpa sujeira resultante (vírgulas múltiplas, espaços múltiplos, etc)
  cleaned = cleaned
    .replace(/\s{2,}/g, ' ')                 // espaços duplos → único
    .replace(/(?:\s*,\s*){2,}/g, ', ')       // vírgulas múltiplas (", ,", ", , ,", etc) → uma só
    .replace(/\s*,\s*/g, ', ')               // normaliza espaço em torno de vírgula
    .replace(/\s+\./g, '.')                  // espaço antes de ponto
    .replace(/,\s*\./g, '.')                 // vírgula antes de ponto
    .replace(/^[,\s]+/, '')                  // início limpo
    .replace(/[,\s]+$/, '')                  // fim limpo
    .trim();

  // Opção 3 do fallback: passa mesmo quebrado, mas loga warning se ficou ruim
  const integrityRatio = originalLen > 0 ? cleaned.length / originalLen : 1;
  const warning = (integrityRatio < 0.6 || removedCount > 3)
    ? `frontalPrompt heavily sanitized: removed ${removedCount} phrase(s), ${Math.round((1 - integrityRatio) * 100)}% reduction in length`
    : null;

  return { cleaned, removedCount, warning };
}

// ─── Negative prompt forçado v3.1 ───
// Projeto legado usa negativos contra ANATOMIA RUIM e QUALIDADE, não contra pose.
// "looking over shoulder" NÃO é mais banido — quando é única instrução clara, o
// modelo lida bem. Banimos apenas artefatos ruins de imagem.
const FORCED_ANATOMY_NEGATIVE = [
  'slim body', 'skinny', 'thin', 'model body', 'athletic body', 'muscular',
  'underweight', 'bony', 'flat hips', 'no curves',
  'wrong hair color', 'wrong hair texture',
  'barefoot', 'no shoes', 'wrong product design',
  'sitting', 'seated', 'people in background', 'empty background', 'studio backdrop',
  'cropped body', 'cut off legs', 'missing feet',
  'low quality', 'blurry', 'distorted', 'unrealistic',
  'advertising style', 'fake lighting', 'text overlay', 'watermark', 'logo',
  'cartoon', 'CGI', 'plastic skin', 'airbrushed skin', 'porcelain skin',
  'perfectly smooth skin', 'overly polished', 'retouched skin', 'studio lighting',
].join(', ');

// ─── SYSTEM PROMPT v3.1 — MINIMALISTA ───
// Aprendizado: system prompt v2.9 tinha ~40 linhas de regras ("pose OBRIGATÓRIA",
// "PROIBIDO", "SIMPLICITY GUARD"). Resultado no Nano Banana: Frankenstein
// (tronco frontal + cabeça de costas) porque as negações acumuladas conflitavam
// com a imagem frontal de referência. Projeto legado comprovou que Nano Banana
// quer prompts CURTOS e POSITIVOS pra back view.
// Agora Claude gera um prompt enxuto no padrão legado e confiamos que image.js
// adiciona a anchor de identidade.
const SYSTEM_PROMPT = `Você é um especialista em prompts de imagem UGC para TikTok Shop.
Sua tarefa: criar o prompt de COSTAS da mesma cena da imagem frontal aprovada.

FORMATO DO PROMPT POSITIVO (em inglês, ~4-6 linhas):
"Woman standing back view wearing the outfit from reference image,
[calçado visível por trás], [cabelo visto de trás, ex: 'long wavy brown hair falling down the back'],
[mesmo cenário da imagem frontal — descrição simples, 1-2 elementos principais],
[mesma iluminação da imagem frontal],
full body visible head to toe including feet,
UGC authentic style, realistic, vertical 9:16."

REGRAS:
- Prompt CURTO e POSITIVO. Nada de "NOT visible", "must not", "do NOT".
- Cenário simples — se o frontal tem vários elementos acessórios (dust particles,
  wine glass, plantas, etc), MANTENHA APENAS os 1-2 principais.
- Cabelo descrito COMO É VISTO POR TRÁS.
- NÃO descreva a cor da roupa (a imagem de referência faz isso).
- Mantenha consistência de cenário e iluminação com a frontal.

NEGATIVE PROMPT (em inglês): foque em anatomia ruim e qualidade, NÃO em pose.
Exemplo: "slim body, skinny, thin, model body, athletic body, muscular, underweight,
bony, flat hips, no curves, wrong hair color, wrong hair texture, barefoot, no shoes,
wrong product design, sitting, seated, people in background, empty background,
studio backdrop, cropped body, cut off legs, missing feet, low quality, blurry,
distorted, unrealistic, advertising style, fake lighting, text overlay, watermark,
logo, cartoon, CGI, plastic skin, airbrushed skin, porcelain skin,
perfectly smooth skin, overly polished, retouched skin, studio lighting"

Retorne APENAS JSON válido, sem backticks, sem markdown:
{
  "positivo": "prompt em inglês",
  "negativo": "negative prompt em inglês"
}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { frontalImageUrl, frontalPrompt, visual, camadas } = req.body;

    if (!frontalImageUrl) return res.status(400).json({ error: 'frontalImageUrl is required' });

    // ─── CAMADA A: sanitizar frontalPrompt antes de enviar ao Claude ───
    const { cleaned: cleanedFrontal, removedCount, warning } = sanitizeFrontalPrompt(frontalPrompt);
    if (warning) {
      console.warn(`[generate-back v3.1] ${warning}`);
    }
    console.log(`[generate-back v3.1] frontalPrompt: removed ${removedCount} contaminant phrase(s)`);

    const userMessage = [
      {
        type: 'image',
        source: { type: 'url', url: frontalImageUrl }
      },
      {
        type: 'text',
        text: `IMAGEM FRONTAL APROVADA: (anexada acima)

PROMPT FRONTAL (já sanitizado — frases de contato visual removidas):
${cleanedFrontal || 'N/A'}

VISUAL:
- Cabelo: ${visual?.cabelo || 'N/A'}
- Calçado: ${visual?.calcado || 'N/A'}
- Acessórios: ${visual?.acessorios || 'N/A'}
- Cenário: ${visual?.cenario || 'N/A'}
- Iluminação: ${visual?.iluminacao || 'N/A'}

CAMADAS:
- Momento: ${camadas?.momento || 'N/A'}
- Estação: ${camadas?.estacao || 'N/A'}
- Estética: ${camadas?.estetica || 'N/A'}

INSTRUÇÕES FINAIS:
1. Comece o "positivo" com: "Woman standing back view wearing the outfit from reference image,"
2. Descreva o cabelo COMO É VISTO DE TRÁS (ex: "long wavy brown hair falling down the back")
3. Cenário simples — 1 ou 2 elementos principais, sem acessórios excessivos
4. Mantenha consistência de cenário e iluminação com a frontal
5. NÃO descreva a cor da roupa (imagem de referência faz isso)

APENAS JSON.`
      }
    ];

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: [{ type: 'text', text: SYSTEM_PROMPT }],
      messages: [{ role: 'user', content: userMessage }]
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (data.error) {
      console.error('[generate-back v3.1] Claude error:', data.error);
      return res.status(500).json({ error: data.error.message || JSON.stringify(data.error) });
    }

    const text = data.content?.map(i => i.text || '').join('') || '';

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (parseErr) {
      console.error('[generate-back v3.1] JSON parse error:', parseErr, 'Raw text:', text.substring(0, 500));
      return res.status(500).json({ error: 'Failed to parse Claude response', raw: text.substring(0, 500) });
    }

    // ─── v3.1: injeta negative de ANATOMIA (não de pose) ───
    if (parsed.negativo && typeof parsed.negativo === 'string' && parsed.negativo.trim()) {
      parsed.negativo = `${parsed.negativo.trim()}, ${FORCED_ANATOMY_NEGATIVE}`;
    } else {
      parsed.negativo = FORCED_ANATOMY_NEGATIVE;
    }

    console.log(`[generate-back v3.1] OK — positivoLen=${(parsed.positivo||'').length}, negativoLen=${parsed.negativo.length}`);

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('[generate-back v3.1] error:', error);
    return res.status(500).json({ error: error.message });
  }
}
