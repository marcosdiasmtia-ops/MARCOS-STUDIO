// api/avatar-card-preview.js (v1.0 — Avatar IA Sessão 2 — Nano Banana Pro 1 imagem pra preview de card)
//
// Endpoint que gera UMA imagem de preview pra um card do wizard de Avatar IA.
// Implementa a Decisão #5 REVISADA (lazy generation) e a Decisão #10 NOVA
// (3 ações por card — esse endpoint atende a ação "🎨 Gerar com IA").
//
// Caso de uso:
//   - Marcos abre wizard, clica em "Gerar com IA" no card "Nórdica" (etnia)
//   - Frontend monta um prompt simples ("candid headshot of a Nordic woman, ...")
//   - Chama esse endpoint
//   - Recebe 1 imagem
//   - Salva no localStorage 'marcos-studio-avatar-preview-cache'
//   - Próxima vez que outro avatar usar "Nórdica feminina", vem do cache
//
// Diferenças vs avatar-generate.js (que gera 2 variações pro avatar FINAL):
//   1. num_images: 1 (Decisão #5 revisada — gera só 1 preview)
//   2. aspect_ratio: configurável pelo frontend (default '1:1' pra cards quadrados)
//   3. Polling mais curto (~60s vs 110s)
//   4. Output simplificado: { url, seed, requestId, prompt } (não array)
//
// Espelha o padrão de queue+polling do api/ugc-image-base.js.
//
// Input (POST body):
//   {
//     prompt: string,                  // prompt em inglês (frontend monta)
//     aspectRatio?: '1:1' | '3:4' |    // default '1:1'
//                   '4:3' | '9:16' |
//                   '16:9' | '4:5' | '5:4',
//     cacheKey?: string,               // só pra logging (ex: 'ethnicities/nordic-f')
//   }
//
// Output (200):
//   {
//     url: string,                     // URL pública da imagem no fal.ai
//     seed: number | null,
//     requestId: string,
//     prompt: string,                  // ecoa de volta
//   }
//
// Custo por chamada: ~$0.05 (1× Nano Banana Pro).
// Tempo típico: 15-30s. vercel.json precisa de maxDuration: 60 pra esse endpoint.

const NANO_BANANA_PRO_ENDPOINT = 'fal-ai/nano-banana-pro';

const VALID_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9', '4:5', '5:4'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    console.error('[avatar-card-preview] FAL_KEY not configured');
    return res.status(500).json({ error: 'FAL_KEY not configured' });
  }

  try {
    const { prompt, aspectRatio, cacheKey } = req.body || {};

    // ── Validação de input ──────────────────────────────────────────
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required (string)' });
    }
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length < 30) {
      return res.status(400).json({
        error: `prompt too short (${trimmedPrompt.length} chars, min 30)`,
      });
    }
    if (trimmedPrompt.length > 2000) {
      return res.status(400).json({
        error: `prompt too long (${trimmedPrompt.length} chars, max 2000)`,
      });
    }

    const finalAspectRatio = aspectRatio || '1:1';
    if (!VALID_ASPECT_RATIOS.includes(finalAspectRatio)) {
      return res.status(400).json({
        error: `aspectRatio must be one of: ${VALID_ASPECT_RATIOS.join(', ')}`,
      });
    }

    // ── Body pra fal.ai ─────────────────────────────────────────────
    const body = {
      prompt: trimmedPrompt,
      num_images: 1,                    // Decisão #5 revisada — 1 preview por chamada
      output_format: 'png',             // Decisão #9 alavanca 2
      aspect_ratio: finalAspectRatio,
    };

    console.log(
      `[avatar-card-preview] Submitting (prompt_chars=${trimmedPrompt.length}, ratio=${finalAspectRatio}${cacheKey ? `, cache=${cacheKey}` : ''})`
    );

    // ── Submit pra fal.ai ───────────────────────────────────────────
    const submitRes = await fetch(`https://queue.fal.run/${NANO_BANANA_PRO_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${FAL_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      console.error(`[avatar-card-preview] fal.ai submit error ${submitRes.status}:`, errText);
      return res.status(submitRes.status).json({
        error: `fal.ai error: ${submitRes.status}`,
        details: errText.substring(0, 500),
      });
    }

    const submitData = await submitRes.json();

    // ── Caso 1: retorno síncrono (raro) ─────────────────────────────
    if (submitData.images && submitData.images.length > 0) {
      console.log('[avatar-card-preview] Sync response received');
      return res.status(200).json({
        url: submitData.images[0].url,
        seed: submitData.seed ?? null,
        requestId: submitData.request_id || null,
        prompt: trimmedPrompt,
      });
    }

    // ── Caso 2: enfileirou, fazer polling ───────────────────────────
    const requestId = submitData.request_id;
    if (!requestId) {
      return res.status(500).json({
        error: 'No request_id from fal.ai',
        data: submitData,
      });
    }

    const statusUrl =
      submitData.status_url ||
      `https://queue.fal.run/${NANO_BANANA_PRO_ENDPOINT}/requests/${requestId}/status`;
    const responseUrl =
      submitData.response_url ||
      `https://queue.fal.run/${NANO_BANANA_PRO_ENDPOINT}/requests/${requestId}`;

    console.log(`[avatar-card-preview] Queued: ${requestId}`);

    // Polling — 1 imagem do Nano Banana Pro: 15-30s típico
    let attempts = 0;
    const maxAttempts = 25; // 25 × 2s = 50s máximo (vercel.json: maxDuration=60)

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      });

      if (!statusRes.ok) {
        console.error(`[avatar-card-preview] Status check error ${statusRes.status} (attempt ${attempts})`);
        continue;
      }

      const status = await statusRes.json();

      if (status.status === 'COMPLETED') {
        const resultRes = await fetch(responseUrl, {
          headers: { 'Authorization': `Key ${FAL_KEY}` },
        });

        if (!resultRes.ok) {
          const errText = await resultRes.text();
          console.error(`[avatar-card-preview] Result fetch error ${resultRes.status}:`, errText);
          return res.status(500).json({ error: `Result fetch error: ${resultRes.status}` });
        }

        const result = await resultRes.json();

        if (!result.images || result.images.length === 0) {
          console.error('[avatar-card-preview] No images in result:', JSON.stringify(result).substring(0, 500));
          return res.status(500).json({
            error: 'No images returned by Nano Banana Pro',
            data: result,
          });
        }

        const img = result.images[0];
        console.log(
          `[avatar-card-preview] OK: ${requestId} after ${attempts * 2}s${cacheKey ? ` (cache=${cacheKey})` : ''}`
        );

        return res.status(200).json({
          url: img.url,
          seed: img.seed ?? result.seed ?? null,
          requestId: requestId,
          prompt: trimmedPrompt,
        });
      }

      if (status.status === 'FAILED' || status.status === 'ERROR') {
        console.error('[avatar-card-preview] Generation failed:', JSON.stringify(status));
        return res.status(500).json({
          error: 'Nano Banana Pro generation failed',
          details: status,
        });
      }

      // IN_QUEUE ou IN_PROGRESS → continua polling
    }

    // ── Estourou tempo ──────────────────────────────────────────────
    console.error(`[avatar-card-preview] Timeout after ${maxAttempts * 2}s for request ${requestId}`);
    return res.status(504).json({
      error: 'Nano Banana Pro timeout',
      requestId: requestId,
    });
  } catch (error) {
    console.error('[avatar-card-preview] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
