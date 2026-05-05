// api/ugc-image-base.js (v1.0 — wrapper Nano Banana Pro pra frame inicial UGC Falante)
//
// Endpoint que gera o FRAME INICIAL da aba UGC Falante. Esse frame é a
// imagem estática composta (influencer + produto + cenário) que vai
// servir de "starting frame" pro Veo 3 frame-to-video animar (Take 1).
//
// PIPELINE COMPLETO (referência):
//   1. ugc-image-base (este endpoint) → frame_take1.png ← VOCÊ ESTÁ AQUI
//   2. Veo 3 frame-to-video (manual, no Veo Studio) → Take 1 (8s)
//   3. Veo 3 nativo: extrair último frame → frame_take2.png
//   4. Veo 3 frame-to-video → Take 2, 3, 4, 5...
//   5. CapCut concatena (costura invisível, validada empiricamente em 01/05)
//
// Espelha o padrão do api/generate-vton-image.js (v1.0): recebe prompt já
// montado + 2 URLs, chama Nano Banana Pro Edit, retorna imageUrl.
//
// CRITÉRIO ESPECIAL DO FRAME UGC FALANTE:
// O prompt deveria incluir instrução de POSE ESTÁVEL no FINAL do frame
// (porque o Veo 3 anima a partir dele e pose dinâmica gera artefatos).
// Quem monta o prompt no frontend é responsável por incluir isso.
// Sugestão de instrução: "neutral standing pose, mouth slightly open as if
// about to speak, ready for animation."
//
// Input (POST body):
//   - facePhotoUrl (string)    — URL pública da foto de rosto da influencer
//   - productPhotoUrl (string) — URL pública da foto do produto
//   - prompt (string)          — prompt em inglês, já montado pelo frontend
//                                combinando strings dos 7 data files
//
// Output (200):
//   {
//     imageUrl: "https://v3b.fal.media/files/.../output.png",
//     prompt: "...",            // echo do prompt usado
//     seed: 1234567890,         // se disponível
//     requestId: "uuid"
//   }
//
// CONFIG VALIDADA (espelha generate-vton-image.js de 24/04/2026):
//   - Modelo: fal-ai/nano-banana-pro/edit (suporta 2 imagens + prompt)
//   - num_images: 1
//   - Sem aspect_ratio explícito (Nano Banana Pro infere do input)
//   - Sem parâmetros customizados (zero-config)

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

    // ── Validação de input ────────────────────────────────────────────
    if (!facePhotoUrl) {
      return res.status(400).json({ error: 'facePhotoUrl is required' });
    }
    if (!productPhotoUrl) {
      return res.status(400).json({ error: 'productPhotoUrl is required' });
    }
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 100) {
      return res.status(400).json({ error: 'prompt is required (min 100 chars)' });
    }

    // ── Validação ESTRUTURAL do prompt UGC Falante ────────────────────
    // Não bloqueia, só avisa via console pra debug. Quem monta o prompt
    // (frontend) deve garantir esses markers, mas a falta deles não impede
    // a geração — o Nano Banana ainda pode produzir uma imagem decente.

    const hasWearingMarker = /\bwearing\b/i.test(prompt);
    if (!hasWearingMarker) {
      console.warn('[ugc-image-base] prompt missing WEARING marker — frame pode não mostrar produto vestido');
    }

    const hasStablePoseMarker = /\b(stable|neutral|ready for animation|about to speak)\b/i.test(prompt);
    if (!hasStablePoseMarker) {
      console.warn('[ugc-image-base] prompt missing STABLE POSE marker — Take 1 do Veo pode ter artefatos');
    }

    // ── Submit pra fal.ai ─────────────────────────────────────────────
    const body = {
      prompt: prompt,
      image_urls: [facePhotoUrl, productPhotoUrl],
      num_images: 1,
      output_format: 'png',
    };

    console.log(
      '[ugc-image-base] Submitting to Nano Banana Pro Edit:',
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
      console.error(`[ugc-image-base] fal.ai submit error ${submitRes.status}:`, errText);
      return res.status(submitRes.status).json({
        error: `fal.ai error: ${submitRes.status}`,
        details: errText,
      });
    }

    const submitData = await submitRes.json();

    // ── Caso 1: retorno síncrono (raro, mas possível) ─────────────────
    if (submitData.images && submitData.images.length > 0) {
      console.log('[ugc-image-base] Sync response received');
      return res.status(200).json({
        imageUrl: submitData.images[0].url,
        prompt: prompt,
        seed: submitData.seed || null,
        requestId: submitData.request_id || null,
      });
    }

    // ── Caso 2: enfileirou, fazer polling ─────────────────────────────
    const requestId = submitData.request_id;
    if (!requestId) {
      return res.status(500).json({ error: 'No request_id from fal.ai', data: submitData });
    }

    const statusUrl = submitData.status_url
      || `https://queue.fal.run/${NANO_BANANA_PRO_EDIT_ENDPOINT}/requests/${requestId}/status`;
    const responseUrl = submitData.response_url
      || `https://queue.fal.run/${NANO_BANANA_PRO_EDIT_ENDPOINT}/requests/${requestId}`;

    console.log(`[ugc-image-base] Queued: ${requestId}`);

    // Polling — Nano Banana Pro costuma levar 20-40s
    let attempts = 0;
    const maxAttempts = 40; // 40 × 2s = 80s máximo

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      });

      if (!statusRes.ok) {
        console.error(`[ugc-image-base] Status check error ${statusRes.status} (attempt ${attempts})`);
        continue;
      }

      const status = await statusRes.json();

      if (status.status === 'COMPLETED') {
        const resultRes = await fetch(responseUrl, {
          headers: { 'Authorization': `Key ${FAL_KEY}` },
        });

        if (!resultRes.ok) {
          const errText = await resultRes.text();
          console.error(`[ugc-image-base] Result fetch error ${resultRes.status}:`, errText);
          return res.status(500).json({ error: `Result fetch error: ${resultRes.status}` });
        }

        const result = await resultRes.json();

        if (!result.images || result.images.length === 0) {
          console.error('[ugc-image-base] No images in result:', JSON.stringify(result).substring(0, 500));
          return res.status(500).json({ error: 'No images returned by Nano Banana Pro', data: result });
        }

        console.log(`[ugc-image-base] OK: ${requestId} after ${attempts * 2}s`);
        return res.status(200).json({
          imageUrl: result.images[0].url,
          prompt: prompt,
          seed: result.seed || null,
          requestId: requestId,
        });
      }

      if (status.status === 'FAILED' || status.status === 'ERROR') {
        console.error('[ugc-image-base] Generation failed:', JSON.stringify(status));
        return res.status(500).json({
          error: 'Nano Banana Pro generation failed',
          details: status,
        });
      }

      // IN_QUEUE ou IN_PROGRESS → continua polling
    }

    // ── Estourou tempo ────────────────────────────────────────────────
    console.error(`[ugc-image-base] Timeout after ${maxAttempts * 2}s for request ${requestId}`);
    return res.status(504).json({
      error: 'Nano Banana Pro timeout',
      requestId: requestId,
    });

  } catch (error) {
    console.error('[ugc-image-base] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
