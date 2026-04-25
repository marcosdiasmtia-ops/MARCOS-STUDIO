// api/generate-vton-image.js (v1.0 — wrapper Nano Banana Pro)
//
// Endpoint que recebe:
//   - facePhotoUrl  (string) — URL pública da foto de rosto da influencer
//   - productPhotoUrl (string) — URL pública da foto on-model do produto
//   - prompt (string) — prompt UGC já montado pelo generate-vton-prompt.js
//
// Faz:
//   1. Submete pro fal.ai endpoint do Nano Banana Pro Edit (image-to-image
//      com 2 imagens de referência + prompt textual)
//   2. Faz polling do status (queue async, ~20-40s)
//   3. Quando completa, retorna a URL da imagem gerada
//
// CONFIG VALIDADA (24/04/2026):
//   - Modelo: nano-banana-pro/edit (suporta 2 imagens + prompt)
//   - num_images: 1
//   - Sem parâmetros customizados (Nano Banana Pro é zero-config como FLUX.2)
//
// Output (JSON):
//   {
//     imageUrl: "https://v3b.fal.media/files/.../output.png",
//     prompt: "...",                     // echo do prompt usado
//     seed: 1234567890,                  // se disponível
//     requestId: "uuid"
//   }

const NANO_BANANA_PRO_EDIT_ENDPOINT = 'fal-ai/nano-banana-pro/edit';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

  try {
    const { facePhotoUrl, productPhotoUrl, prompt } = req.body;

    if (!facePhotoUrl) {
      return res.status(400).json({ error: 'facePhotoUrl is required' });
    }
    if (!productPhotoUrl) {
      return res.status(400).json({ error: 'productPhotoUrl is required' });
    }
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 100) {
      return res.status(400).json({ error: 'prompt is required (min 100 chars)' });
    }

    // Validação: o prompt UGC tem que ter as marcas estruturais do template-pai
    // (autodefesa contra prompts mal formados que escapariam do generate-vton-prompt.js)
    const hasOutfitMarker = /wearing the outfit from reference image/i.test(prompt);
    if (!hasOutfitMarker) {
      console.warn('[generate-vton-image] prompt missing OUTFIT marker — proceeding anyway');
    }

    const body = {
      prompt: prompt,
      image_urls: [facePhotoUrl, productPhotoUrl],
      num_images: 1,
      output_format: 'png',
    };

    console.log(
      '[generate-vton-image] Submitting to Nano Banana Pro Edit:',
      `prompt_chars=${prompt.length},`,
      `face=${facePhotoUrl.substring(0, 60)}...,`,
      `product=${productPhotoUrl.substring(0, 60)}...`
    );

    const submitRes = await fetch(`https://queue.fal.run/${NANO_BANANA_PRO_EDIT_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${FAL_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      console.error(`[generate-vton-image] fal.ai submit error ${submitRes.status}:`, errText);
      return res.status(submitRes.status).json({
        error: `fal.ai error: ${submitRes.status}`,
        details: errText
      });
    }

    const submitData = await submitRes.json();

    // Caso 1: retorno síncrono (raro mas possível)
    if (submitData.images && submitData.images.length > 0) {
      console.log('[generate-vton-image] Sync response received');
      return res.status(200).json({
        imageUrl: submitData.images[0].url,
        prompt: prompt,
        seed: submitData.seed || null,
        requestId: submitData.request_id || null,
      });
    }

    // Caso 2: enfileirou, fazer polling
    const requestId = submitData.request_id;
    if (!requestId) {
      return res.status(500).json({ error: 'No request_id from fal.ai', data: submitData });
    }

    const statusUrl = submitData.status_url
      || `https://queue.fal.run/${NANO_BANANA_PRO_EDIT_ENDPOINT}/requests/${requestId}/status`;
    const responseUrl = submitData.response_url
      || `https://queue.fal.run/${NANO_BANANA_PRO_EDIT_ENDPOINT}/requests/${requestId}`;

    console.log(`[generate-vton-image] Queued: ${requestId}`);

    // Polling — Nano Banana Pro costuma levar 20-40s
    let attempts = 0;
    const maxAttempts = 40; // 40 × 2s = 80s máximo
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      });

      if (!statusRes.ok) {
        console.error(`[generate-vton-image] Status check error ${statusRes.status} (attempt ${attempts})`);
        continue;
      }

      const status = await statusRes.json();

      if (status.status === 'COMPLETED') {
        const resultRes = await fetch(responseUrl, {
          headers: { 'Authorization': `Key ${FAL_KEY}` },
        });

        if (!resultRes.ok) {
          const errText = await resultRes.text();
          console.error(`[generate-vton-image] Result fetch error ${resultRes.status}:`, errText);
          return res.status(500).json({ error: `Result fetch error: ${resultRes.status}` });
        }

        const result = await resultRes.json();

        if (!result.images || result.images.length === 0) {
          console.error('[generate-vton-image] No images in result:', JSON.stringify(result).substring(0, 500));
          return res.status(500).json({ error: 'No images returned by Nano Banana Pro', data: result });
        }

        console.log(`[generate-vton-image] OK: ${requestId} after ${attempts * 2}s`);
        return res.status(200).json({
          imageUrl: result.images[0].url,
          prompt: prompt,
          seed: result.seed || null,
          requestId: requestId,
        });
      }

      if (status.status === 'FAILED' || status.status === 'ERROR') {
        console.error(`[generate-vton-image] Generation failed:`, JSON.stringify(status));
        return res.status(500).json({
          error: 'Nano Banana Pro generation failed',
          details: status
        });
      }

      // IN_QUEUE ou IN_PROGRESS → continua polling
    }

    // Estourou tempo
    console.error(`[generate-vton-image] Timeout after ${maxAttempts * 2}s for request ${requestId}`);
    return res.status(504).json({
      error: 'Nano Banana Pro timeout',
      requestId: requestId
    });

  } catch (error) {
    console.error('[generate-vton-image] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
