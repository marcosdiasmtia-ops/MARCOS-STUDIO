// fal.ai Nano Banana image generation proxy (v2.2 — unified model pipeline)
// Routes to /edit (with reference images) or text-to-image (without)
//
// v2.2 FIXES aplicados quando há image_urls (rota /edit):
//   Fix 1 — Âncora de identidade: prefixa o prompt com instrução explícita
//           pro modelo preservar rosto, pele, cabelo e proporções da 1a imagem
//   Fix 2 — bodyDescription injetada: se recebida, entra na âncora pra guiar
//           o modelo sobre o tipo corporal esperado
//   Fix 3 — Sanitização do negative prompt: remove itens específicos da Lígia
//           (no freckles, nose ring missing, wrong hair color/texture) que
//           atrapalham geração de outras influencers

// Itens do negative prompt v8.2 que são específicos da Lígia e NÃO devem
// ir pra outras modelos. Mantemos tudo que é genérico (qualidade, anatomia).
const LIGIA_SPECIFIC_NEGATIVES = [
  'no freckles',
  'nose ring missing',
  'wrong hair color',
  'wrong hair texture',
  'straight hair without waves',
  'different face',
  'blue eyes',
  'brown eyes',
];

function sanitizeNegativePrompt(negativePrompt) {
  if (!negativePrompt || typeof negativePrompt !== 'string') return negativePrompt;
  let sanitized = negativePrompt;
  for (const item of LIGIA_SPECIFIC_NEGATIVES) {
    // Remove o termo + vírgula/espaço subsequente (flexível entre vírgula e newline)
    const re = new RegExp(`\\s*${item.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*,?`, 'gi');
    sanitized = sanitized.replace(re, '');
  }
  // Limpar múltiplas vírgulas ou espaços extras resultantes
  sanitized = sanitized.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').replace(/\s*,\s*/g, ', ').trim();
  if (sanitized.startsWith(',')) sanitized = sanitized.slice(1).trim();
  if (sanitized.endsWith(',')) sanitized = sanitized.slice(0, -1).trim();
  return sanitized;
}

function buildIdentityAnchor(profileName, bodyDescription, numRefImages) {
  // Âncora de identidade: prefixa o prompt quando há 2+ imagens de referência
  // Ordem esperada: image_urls[0] = influencer/frontal, image_urls[1] = produto
  const parts = [];
  if (numRefImages >= 2) {
    parts.push(
      `Woman identical to the first reference image (same exact face, skin tone, hair color and texture, eye color, body proportions)`
    );
    if (bodyDescription && bodyDescription.trim()) {
      parts.push(`body type: ${bodyDescription.trim()}`);
    }
    parts.push(`wearing the outfit from the second reference image (preserve exact product design, cut, texture and color).`);
  } else if (numRefImages === 1) {
    // Apenas 1 imagem de ref — tratamos como identidade da influencer
    parts.push(
      `Woman identical to the reference image (same exact face, skin tone, hair, body proportions)${bodyDescription ? `, body type: ${bodyDescription.trim()}` : ''}.`
    );
  }
  return parts.length ? parts.join(', ') + ' ' : '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

  try {
    const {
      prompt,
      image_urls,
      aspect_ratio = '9:16',
      profile_name,       // v2.2
      body_description,   // v2.2
      negative_prompt,    // v2.2 (opcional — se o frontend quiser passar explicitamente)
    } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    // Choose endpoint: /edit requires image_urls, text-to-image does not
    const hasImages = Array.isArray(image_urls) && image_urls.length > 0;
    const endpoint = hasImages ? 'fal-ai/nano-banana/edit' : 'fal-ai/nano-banana';

    // v2.2: prefixar prompt com âncora de identidade quando há referências
    let finalPrompt = prompt;
    if (hasImages) {
      const anchor = buildIdentityAnchor(profile_name, body_description, image_urls.length);
      if (anchor) {
        finalPrompt = anchor + prompt;
      }
    }

    // v2.2: sanitizar negative prompt (se enviado)
    const finalNegative = negative_prompt ? sanitizeNegativePrompt(negative_prompt) : null;

    console.log(`[image v2.2] endpoint=${endpoint}, hasImages=${hasImages}, imgs=${image_urls?.length||0}, profile=${profile_name||'—'}, bodyDesc=${!!body_description}`);

    // Build request body
    const body = {
      prompt: finalPrompt,
      aspect_ratio,
      output_format: 'png',
      num_images: 1,
    };
    if (hasImages) body.image_urls = image_urls;
    if (finalNegative) body.negative_prompt = finalNegative;

    // Submit to queue
    const submitRes = await fetch(`https://queue.fal.run/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${FAL_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      console.error(`[image] fal.ai submit error ${submitRes.status}:`, errText);
      return res.status(submitRes.status).json({ error: `fal.ai error: ${submitRes.status}`, details: errText });
    }

    const submitData = await submitRes.json();

    if (submitData.images) {
      // Sync mode - result immediately
      return res.status(200).json(submitData);
    }

    const requestId = submitData.request_id;
    if (!requestId) return res.status(500).json({ error: 'No request_id', data: submitData });

    // Use URLs from submit response (correct paths without subpath)
    const statusUrl = submitData.status_url || `https://queue.fal.run/fal-ai/nano-banana/requests/${requestId}/status`;
    const responseUrl = submitData.response_url || `https://queue.fal.run/fal-ai/nano-banana/requests/${requestId}`;

    console.log(`[image] Queued: ${requestId}`);

    // Poll for result
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      });
      if (!statusRes.ok) {
        console.error(`[image] Status check error ${statusRes.status}`);
        continue;
      }
      const status = await statusRes.json();

      if (status.status === 'COMPLETED') {
        const resultRes = await fetch(responseUrl, {
          headers: { 'Authorization': `Key ${FAL_KEY}` },
        });
        const result = await resultRes.json();
        return res.status(200).json(result);
      }

      if (status.status === 'FAILED') {
        console.error(`[image] Generation failed:`, status);
        return res.status(500).json({ error: 'Image generation failed', details: status });
      }
    }

    return res.status(408).json({ error: 'Timeout waiting for image', requestId });
  } catch (error) {
    console.error('Image API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
