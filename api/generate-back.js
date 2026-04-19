// Generate back image prompt using frontal image + back product photo via Claude
//
// HISTÓRICO:
// v2.8 — (anterior) sem proteções; prompt vago causava "looking over shoulder",
//        pose torcida em V02/V03 e anatomia quebrada por sobrecarga do frontal.
// v2.9 — FIX DE CORPO TORCIDO E ANATOMIA:
//        Camada A: sanitiza frontalPrompt (remove "looking at camera", etc)
//        Camada B: system prompt com anatomy-of-back explícito
//        Camada C: simplicity guard (reduzir elementos do cenário)
//        Camada D: negative prompt forçado com lista anti-torção

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

// ─── Camada D: negative prompt forçado ───
// Concatenado ao negativo retornado pelo Claude INDEPENDENTE do que ele gerar.
// Garante que mesmo se o Claude esquecer, essas regras vão pro Nano Banana.
const FORCED_BACK_NEGATIVE = [
  'looking over shoulder',
  'looking back at camera',
  'head turned to camera',
  'head turned toward viewer',
  'face visible',
  'partial face visible',
  'profile view',
  'three-quarter back view',
  'side profile',
  'twisted torso',
  'rotated upper body',
  'upper body rotation',
  'contrapposto with head turn',
  'neck rotation',
  'twisted spine',
  'body torsion',
  'eye contact',
  'facing camera',
  'glancing back',
  'peeking over shoulder',
  'partial back view',
].join(', ');

// ─── Camada B + C: system prompt com anatomy-of-back + simplicity guard ───
const SYSTEM_PROMPT = `Você é um especialista em prompts de imagem UGC para TikTok Shop, especializado em poses de COSTAS.

CONTEXTO: Recebe imagem frontal já aprovada + prompt frontal já usado. Seu trabalho: criar o prompt da MESMA CENA mas com a pessoa de costas.

═══ REGRAS ANATÔMICAS DE COSTAS (CRÍTICAS) ═══

POSE OBRIGATÓRIA:
- Corpo 100% virado de costas para a câmera
- Tronco, ombros e quadris alinhados — ZERO rotação
- Cabeça alinhada com a coluna — pescoço NÃO torce
- Nuca totalmente visível — a câmera está ATRÁS do sujeito
- Nenhuma parte do rosto visível (nem mesmo parcialmente)
- Sem contato visual, sem olhar sobre o ombro
- Braços em posição natural relaxada ao lado do corpo

PROIBIDO (NUNCA incluir no positivo):
- "looking over shoulder" ou "glancing back"
- "head turned", "partial face visible", "profile view"
- "three-quarter back" — é BACK, não 3/4
- Torção de coluna, rotação de pescoço, corpo contorcido
- Qualquer expressão que sugira contato com a câmera ou visibilidade do rosto

═══ REGRA DE SIMPLICIDADE (SIMPLICITY GUARD) ═══

O prompt de costas deve ser MAIS ENXUTO que o frontal.
- MANTENHA: cenário principal (1-2 elementos), iluminação, roupa, calçado, cabelo
- REMOVA: detalhes acessórios (partículas de poeira, copos de vinho, plantas decorativas, objetos menores, texturas específicas de almofada, etc)
- Motivo: Nano Banana perde anatomia (braços extras, pés torcidos) quando o prompt está sobrecarregado.
- Regra prática: se o frontal tem >4 elementos ambientais, o de costas pode ter no máximo 2.

═══ CONSISTÊNCIA COM A FRONTAL ═══

- Mesma modelo, mesma roupa, mesmo cenário base, mesma iluminação
- Cabelo: descrever COMO É VISTO POR TRÁS (ex: "long wavy brown hair falling down the back" em vez de "framing the face")
- Calçado e acessórios visíveis de costas: manter

═══ FORMATO ═══

- Vertical 9:16, UGC authentic, realistic
- Full body visible head to toe including feet (anatomicamente correto)
- Prompt em INGLÊS
- O campo "positivo" DEVE começar com: "Woman standing with her back fully to the camera, head aligned with spine, nape of neck visible,"

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
      console.warn(`[generate-back v2.9] ${warning}`);
    }
    console.log(`[generate-back v2.9] frontalPrompt: removed ${removedCount} contaminant phrase(s)`);

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
1. Comece o "positivo" OBRIGATORIAMENTE com: "Woman standing with her back fully to the camera, head aligned with spine, nape of neck visible,"
2. Descreva o cabelo COMO É VISTO DE TRÁS
3. Aplique o SIMPLICITY GUARD — remova detalhes acessórios do cenário
4. O prompt de costas DEVE ser MAIS ENXUTO que o frontal
5. No "negativo", inclua pelo menos: "looking over shoulder, head turned, twisted torso, face visible, profile view"

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
      console.error('[generate-back v2.9] Claude error:', data.error);
      return res.status(500).json({ error: data.error.message || JSON.stringify(data.error) });
    }

    const text = data.content?.map(i => i.text || '').join('') || '';

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (parseErr) {
      console.error('[generate-back v2.9] JSON parse error:', parseErr, 'Raw text:', text.substring(0, 500));
      return res.status(500).json({ error: 'Failed to parse Claude response', raw: text.substring(0, 500) });
    }

    // ─── CAMADA D: injeta negative forçado independente do que Claude retornou ───
    if (parsed.negativo && typeof parsed.negativo === 'string' && parsed.negativo.trim()) {
      parsed.negativo = `${parsed.negativo.trim()}, ${FORCED_BACK_NEGATIVE}`;
    } else {
      parsed.negativo = FORCED_BACK_NEGATIVE;
    }

    console.log(`[generate-back v2.9] OK — positivoLen=${(parsed.positivo||'').length}, negativoLen=${parsed.negativo.length}`);

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('[generate-back v2.9] error:', error);
    return res.status(500).json({ error: error.message });
  }
}
