// Generate back image prompt using frontal image + back product photo via Claude
//
// HISTÓRICO:
// v2.8 — (anterior) sem proteções; prompt vago causava "looking over shoulder".
// v2.9 — 4 camadas: sanitização de frontal, anatomy-of-back, simplicity guard,
//        negative forçado anti-pose. Resolveu torção mas causou Frankenstein
//        quando combinado com anchor v3.0 no image.js.
// v3.1 — SIMPLIFICAÇÃO GERAL:
//        Projeto legado comprovou que Nano Banana quer prompts CURTOS pra back.
//        System prompt reduzido a ~30 linhas, negative trocado pra anti-anatomia.
// v3.3 — CLAUDE ENXERGA A FOTO DE COSTAS DO PRODUTO:
//        Até v3.2, o Claude aqui só via a imagem frontal gerada e escrevia um
//        prompt genérico ("wearing the outfit from reference image"). O
//        Nano Banana depois recebia a foto de costas do produto como 2a
//        imagem de referência, mas sem nenhuma descrição textual do que
//        deveria preservar do design traseiro (ziper, recorte, etc).
//        Isso causava o bug 1 do handoff v3.1: costas genérica sem preservar
//        o design específico.
//        v3.3 passa a foto de costas do produto TAMBÉM pro Claude aqui.
//        Ele agora olha a peça, descreve objetivamente o design traseiro
//        (ziper, painéis, aberturas, alças, decote), e inclui essa descrição
//        no prompt positivo. O Nano Banana recebe: (1) a descrição textual
//        do design traseiro + (2) as 2 imagens de referência. Muito mais
//        chance de preservar detalhes específicos.
//        FALLBACK: se a foto de costas não vier (caso edge), comportamento
//        é idêntico ao v3.1 — system prompt antigo, sem descrição traseira.

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

  cleaned = cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/(?:\s*,\s*){2,}/g, ', ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+\./g, '.')
    .replace(/,\s*\./g, '.')
    .replace(/^[,\s]+/, '')
    .replace(/[,\s]+$/, '')
    .trim();

  const integrityRatio = originalLen > 0 ? cleaned.length / originalLen : 1;
  const warning = (integrityRatio < 0.6 || removedCount > 3)
    ? `frontalPrompt heavily sanitized: removed ${removedCount} phrase(s), ${Math.round((1 - integrityRatio) * 100)}% reduction in length`
    : null;

  return { cleaned, removedCount, warning };
}

// ─── Negative prompt forçado (mantido de v3.1) ───
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

// ─── SYSTEM PROMPT v3.3 — COM VISÃO DE COSTAS ───
// Reescrito pra instruir o Claude a DESCREVER o design traseiro quando recebe a
// foto de costas do produto (IMAGEM 2). Se só IMAGEM 1 vier (fallback), o
// comportamento é idêntico ao v3.1.
const SYSTEM_PROMPT_V33 = `Você é um especialista em prompts de imagem UGC para TikTok Shop.
Sua tarefa: criar o prompt de COSTAS da mesma cena da imagem frontal aprovada.

VOCÊ RECEBE 2 IMAGENS:
- IMAGEM 1: frontal aprovada da modelo na cena final.
- IMAGEM 2: FOTO DE COSTAS DO PRODUTO — mostra o design traseiro da peça
  (pode estar em manequim, em outra modelo, ou plana).

FORMATO DO PROMPT POSITIVO (em inglês, ~5-7 linhas):
"Woman standing back view wearing the outfit from reference image,
[calçado visível por trás],
[cabelo visto de trás, ex: 'long wavy brown hair falling down the back'],
[mesmo cenário da imagem frontal — descrição simples, 1-2 elementos principais],
[mesma iluminação da imagem frontal],
visible back details: [UMA LINHA OBJETIVA descrevendo o design traseiro visto na IMAGEM 2],
full body visible head to toe including feet,
UGC authentic style, realistic, vertical 9:16."

REGRAS GERAIS:
- Prompt CURTO e POSITIVO. Nada de "NOT visible", "must not", "do NOT".
- Cenário simples — se o frontal tem vários elementos acessórios (dust particles,
  wine glass, plantas, etc), MANTENHA APENAS os 1-2 principais.
- Cabelo descrito COMO É VISTO POR TRÁS.
- NÃO descreva a cor da roupa (a imagem de referência faz isso).
- Mantenha consistência de cenário e iluminação com a frontal.

COMO DESCREVER "visible back details:" (OLHANDO A IMAGEM 2):
- Identifique o que está visível nas costas da peça:
  * Zipers (posição: nuca, costas inteiras, parte inferior, lateral)
  * Aberturas e recortes (cutouts, decote traseiro, costas nuas, keyhole)
  * Costuras visíveis (centro, painéis, recortes horizontais, bainhas)
  * Alças (cruzadas, retas, amarrações, laços, tiras)
  * Painéis de tecido (divisões, pregas, franzidos)
  * Fechamentos (botões, colchetes, amarração)
- Descreva em UMA linha, OBJETIVA, em inglês. Exemplos bons:
  * "visible back details: exposed metallic zipper running from neckline to mid-back, two fabric panels meeting at center seam"
  * "visible back details: open cutout between shoulder blades, thin crossed straps"
  * "visible back details: full closed back with horizontal seam at waist"
  * "visible back details: plain smooth back with no openings"
  * "visible back details: back tie closure with fabric bow at upper back"
- IGNORE a pessoa/manequim da IMAGEM 2 — só o design da peça importa.
- NÃO invente detalhes que não vê. Se a peça é lisa atrás, escreva "plain back".
- Se a IMAGEM 2 não mostrar claramente as costas (ex: foto ruim, peça de frente),
  escreva "visible back details: back design inferred from front" e siga.

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

// ─── SYSTEM PROMPT v3.1 (FALLBACK quando não tem foto de costas) ───
// Usado APENAS quando backProductImage não foi enviada — preserva comportamento
// anterior pra não introduzir regressão em usos sem foto de costas.
const SYSTEM_PROMPT_V31_FALLBACK = `Você é um especialista em prompts de imagem UGC para TikTok Shop.
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
    const {
      frontalImageUrl,
      frontalPrompt,
      visual,
      camadas,
      // v3.3 — NOVOS campos opcionais: foto de costas do produto
      backProductImageBase64,
      backProductImageMimeType,
    } = req.body;

    if (!frontalImageUrl) return res.status(400).json({ error: 'frontalImageUrl is required' });

    // ─── CAMADA A: sanitizar frontalPrompt antes de enviar ao Claude ───
    const { cleaned: cleanedFrontal, removedCount, warning } = sanitizeFrontalPrompt(frontalPrompt);
    if (warning) {
      console.warn(`[generate-back v3.3] ${warning}`);
    }

    // v3.3 — decide qual system prompt usar com base na presença da IMAGEM 2
    const hasBackPhoto = !!(backProductImageBase64 && backProductImageMimeType);
    const systemPrompt = hasBackPhoto ? SYSTEM_PROMPT_V33 : SYSTEM_PROMPT_V31_FALLBACK;

    console.log(`[generate-back v3.3] frontalPrompt: removed ${removedCount} contaminant phrase(s), hasBackPhoto=${hasBackPhoto}`);

    // ─── Monta a user message ───
    const userContent = [];

    // Imagem 1 — frontal aprovada (sempre presente)
    userContent.push({
      type: 'image',
      source: { type: 'url', url: frontalImageUrl }
    });

    // v3.3 — Imagem 2 — foto de costas do produto (quando disponível)
    if (hasBackPhoto) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: backProductImageMimeType,
          data: backProductImageBase64,
        }
      });
    }

    // Contexto textual (muda conforme tem ou não a IMAGEM 2)
    const imageContext = hasBackPhoto
      ? `IMAGEM 1 (frontal aprovada da modelo): anexada em primeiro lugar.
IMAGEM 2 (FOTO DE COSTAS DO PRODUTO — OLHE A PEÇA, ignore quem a veste): anexada em segundo lugar.`
      : `IMAGEM FRONTAL APROVADA: (anexada acima)`;

    const backDetailsInstruction = hasBackPhoto
      ? `6. Você tem IMAGEM 2: inclua uma linha "visible back details: ..." descrevendo
   objetivamente os detalhes traseiros da peça (ziper, recortes, costuras, aberturas,
   alças). Olhe a IMAGEM 2, foque na peça, ignore quem veste. Se a peça é lisa
   atrás, escreva "visible back details: plain back".`
      : '';

    const textPart = `${imageContext}

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
${backDetailsInstruction ? backDetailsInstruction + '\n' : ''}
APENAS JSON.`;

    userContent.push({ type: 'text', text: textPart });

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: [{ type: 'text', text: systemPrompt }],
      messages: [{ role: 'user', content: userContent }]
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
      console.error('[generate-back v3.3] Claude error:', data.error);
      return res.status(500).json({ error: data.error.message || JSON.stringify(data.error) });
    }

    const text = data.content?.map(i => i.text || '').join('') || '';

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (parseErr) {
      console.error('[generate-back v3.3] JSON parse error:', parseErr, 'Raw text:', text.substring(0, 500));
      return res.status(500).json({ error: 'Failed to parse Claude response', raw: text.substring(0, 500) });
    }

    // Injeta negative de ANATOMIA (mantido de v3.1)
    if (parsed.negativo && typeof parsed.negativo === 'string' && parsed.negativo.trim()) {
      parsed.negativo = `${parsed.negativo.trim()}, ${FORCED_ANATOMY_NEGATIVE}`;
    } else {
      parsed.negativo = FORCED_ANATOMY_NEGATIVE;
    }

    // v3.3 — log adicional: indica se o positivo contém a descrição traseira
    const hasBackDetails = typeof parsed.positivo === 'string' && /visible back details:/i.test(parsed.positivo);
    console.log(`[generate-back v3.3] OK — positivoLen=${(parsed.positivo||'').length}, negativoLen=${parsed.negativo.length}, hasBackPhoto=${hasBackPhoto}, hasBackDetails=${hasBackDetails}`);

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('[generate-back v3.3] error:', error);
    return res.status(500).json({ error: error.message });
  }
}
