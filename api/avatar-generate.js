// api/avatar-generate.js (v1.0 — Avatar IA Sessão 2 — Nano Banana Pro text-to-image, 2 variações)
//
// Endpoint que recebe o `englishPrompt` (gerado pelo /api/avatar-prompt) e
// dispara o Nano Banana Pro pra gerar 2 variações da MESMA persona, em paralelo
// dentro da mesma chamada (num_images=2).
//
// Espelha o padrão de queue+polling do api/ugc-image-base.js (validado em produção),
// com 3 mudanças cirúrgicas:
//   1. Modelo: 'fal-ai/nano-banana-pro' (text-to-image — SEM o /edit do irmão)
//   2. Input: só `englishPrompt` (não recebe image_urls)
//   3. num_images: 2 (Decisão #6 — 2 variações simultâneas pra Marcos escolher)
//
// REFERÊNCIAS arquiteturais:
//   - Decisão #3: stack isolado pra Avatar IA (não acopla ao UGC Falante)
//   - Decisão #6: 2 variações simultâneas (Promise paralelo NÃO necessário,
//                 num_images=2 pede 2 numa só chamada — mais barato e atômico)
//   - Decisão #9 alavanca 2: output_format='png' (sem JPG compression),
//                            aspect_ratio='9:16' (output garantido portrait),
//                            sem guidance_scale alto (evita plastic look)
//
// Input (POST body):
//   {
//     englishPrompt: string,    // prompt concatenado vindo do /api/avatar-prompt
//     name?: string,            // só pra logging (opcional)
//   }
//
// Output (200):
//   {
//     images: [
//       { url: string, seed?: number },
//       { url: string, seed?: number }
//     ],
//     prompt: string,           // ecoa de volta o prompt usado
//     requestId: string,
//   }
//
// Custo por chamada: ~$0.10 (2× $0.05 do Nano Banana Pro).
// Tempo típico: 30-60s. vercel.json precisa de maxDuration: 120 pra esse endpoint.

const NANO_BANANA_PRO_ENDPOINT = 'fal-ai/nano-banana-pro';

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
    console.error('[avatar-generate] FAL_KEY not configured');
    return res.status(500).json({ error: 'FAL_KEY not configured' });
  }

  try {
    const { englishPrompt, name } = req.body || {};

    // ── Validação de input ──────────────────────────────────────────
    if (!englishPrompt || typeof englishPrompt !== 'string') {
      return res.status(400).json({ error: 'englishPrompt is required (string)' });
    }
    const trimmed = englishPrompt.trim();
    if (trimmed.length < 50) {
      return res.status(400).json({
        error: `englishPrompt too short (${trimmed.length} chars, min 50)`,
      });
    }
    if (trimmed.length > 5000) {
      return res.status(400).json({
        error: `englishPrompt too long (${trimmed.length} chars, max 5000)`,
      });
    }

    // ── Validação ESTRUTURAL do prompt (Decisão #9 — soft warnings) ──
    // Não bloqueia, só avisa via console pra debug. O prompt deveria vir
    // do /api/avatar-prompt já com vocabulário pró-realismo, mas se vier
    // sem, o Nano Banana ainda gera (com qualidade pior).
    const lowerPrompt = trimmed.toLowerCase();
    if (!lowerPrompt.includes('candid') && !lowerPrompt.includes('documentary')) {
      console.warn('[avatar-generate] prompt missing CANDID/DOCUMENTARY marker — output pode parecer "AI-glossy"');
    }
    if (!lowerPrompt.includes('9:16') && !lowerPrompt.includes('vertical')) {
      console.warn('[avatar-generate] prompt missing 9:16/VERTICAL marker — confiando no aspect_ratio param');
    }

    // ── Body pra fal.ai (Nano Banana Pro text-to-image) ─────────────
    const body = {
      prompt: trimmed,
      num_images: 2,            // Decisão #6 — 2 variações
      output_format: 'png',     // Decisão #9 alavanca 2 — sem compressão JPG
      aspect_ratio: '9:16',     // Decisão cirúrgica — output portrait garantido
    };

    console.log(
      `[avatar-generate] Submitting (prompt_chars=${trimmed.length}${name ? `, name=${name}` : ''})`
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
      console.error(`[avatar-generate] fal.ai submit error ${submitRes.status}:`, errText);
      return res.status(submitRes.status).json({
        error: `fal.ai error: ${submitRes.status}`,
        details: errText.substring(0, 500),
      });
    }

    const submitData = await submitRes.json();

    // ── Caso 1: retorno síncrono (raro) ─────────────────────────────
    if (submitData.images && submitData.images.length > 0) {
      console.log('[avatar-generate] Sync response received');
      return res.status(200).json({
        images: extractImages(submitData.images, submitData.seed),
        prompt: trimmed,
        requestId: submitData.request_id || null,
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

    console.log(`[avatar-generate] Queued: ${requestId}`);

    // Polling — Nano Banana Pro com num_images=2 costuma levar 40-70s
    let attempts = 0;
    const maxAttempts = 55; // 55 × 2s = 110s máximo (vercel.json: maxDuration=120)

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      });

      if (!statusRes.ok) {
        console.error(`[avatar-generate] Status check error ${statusRes.status} (attempt ${attempts})`);
        continue;
      }

      const status = await statusRes.json();

      if (status.status === 'COMPLETED') {
        const resultRes = await fetch(responseUrl, {
          headers: { 'Authorization': `Key ${FAL_KEY}` },
        });

        if (!resultRes.ok) {
          const errText = await resultRes.text();
          console.error(`[avatar-generate] Result fetch error ${resultRes.status}:`, errText);
          return res.status(500).json({ error: `Result fetch error: ${resultRes.status}` });
        }

        const result = await resultRes.json();

        if (!result.images || result.images.length === 0) {
          console.error('[avatar-generate] No images in result:', JSON.stringify(result).substring(0, 500));
          return res.status(500).json({
            error: 'No images returned by Nano Banana Pro',
            data: result,
          });
        }

        if (result.images.length < 2) {
          // Caso degenerado: pediu 2, voltou só 1. Loga warning e devolve mesmo assim.
          console.warn(
            `[avatar-generate] Asked for 2 images, got ${result.images.length}. Returning what we have.`
          );
        }

        console.log(
          `[avatar-generate] OK: ${requestId} after ${attempts * 2}s (${result.images.length} images)`
        );

        return res.status(200).json({
          images: extractImages(result.images, result.seed),
          prompt: trimmed,
          requestId: requestId,
        });
      }

      if (status.status === 'FAILED' || status.status === 'ERROR') {
        console.error('[avatar-generate] Generation failed:', JSON.stringify(status));
        return res.status(500).json({
          error: 'Nano Banana Pro generation failed',
          details: status,
        });
      }

      // IN_QUEUE ou IN_PROGRESS → continua polling
    }

    // ── Estourou tempo ──────────────────────────────────────────────
    console.error(`[avatar-generate] Timeout after ${maxAttempts * 2}s for request ${requestId}`);
    return res.status(504).json({
      error: 'Nano Banana Pro timeout',
      requestId: requestId,
    });
  } catch (error) {
    console.error('[avatar-generate] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

// Extrai array padronizado [{ url, seed? }] das imagens retornadas pelo fal.ai.
// Cada imagem PODE ter seed individual; se não tiver, usa o seed top-level.
function extractImages(falImages, topLevelSeed) {
  return falImages.map((img) => ({
    url: img.url,
    seed: img.seed ?? topLevelSeed ?? null,
    width: img.width ?? null,
    height: img.height ?? null,
  }));
}
