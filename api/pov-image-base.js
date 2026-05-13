// api/pov-image-base.js (v2.0 — Plano v4: aceita seed opcional pra consistência visual entre takes)
//
// CHANGELOG v2.0 (12/05/2026 — Plano v4, Sub-lote B):
//   🆕 Aceita `seed` opcional no body (number inteiro).
//      Quando fornecido, é passado pro Nano Banana Pro Edit no payload.
//      Como o modelo aceita seed, isso permite que o frontend envie
//      O MESMO seed pra todas as N chamadas paralelas de
//      `generatePovImageBase` — garantindo consistência visual entre
//      takes (mesma paleta de cor, mesma iluminação, mesma estética).
//
//      Padrão de uso recomendado no frontend (PovOutput.jsx):
//          const sharedSeed = Math.floor(Math.random() * 1e9);
//          await Promise.all(takes.map((t) =>
//            generatePovImageBase({ ..., seed: sharedSeed })
//          ));
//
//      Solução C do Plano v4 (fidelidade visual). Combinada com:
//        • Solução A (refator buildImagePrompt em PovOutput) — Sub-lote C2
//        • Solução B (prefixo fidelidade em pov-kling-prompts) — Sub-lote B (já deployed)
//
//      Validação leve: seed inválido (não-número ou fora do range int)
//      vira warning e é ignorado — não bloqueia a geração.
//
// CHANGELOG v1.0:
//   Endpoint ATÔMICO inicial — gera 1 imagem por chamada.
//
// Endpoint ATÔMICO que gera UMA imagem-base pra UM take POV. Essa imagem
// é o `start_image_url` que vai pro Kling 2.6 Pro animar.
//
// É atômico (não faz N takes numa só chamada) por causa do timeout do Vercel:
// Nano Banana leva 20-40s por imagem; gerar 6 takes (POV de 60s) num único
// request estouraria os 60s do serverless. O frontend orquestra N chamadas
// paralelas via Promise.all (ou sequenciais com progressbar, se preferir).
//
// PIPELINE COMPLETA (referência):
//   1. pov-script.js          → roteiro PT-BR com N takes
//   2. pov-kling-prompts.js   → N prompts em inglês
//   3. pov-image-base (ESTE)  → N imagens-base (chamado N vezes pelo frontend)
//   4. pov-kling-generate.js  → N vídeos de 10s
//   5. pov-elevenlabs-tts.js  → N áudios de fala (se voiced)
//   6. pov-compose-final.js   → vídeo final concat com timestamps
//
// Espelha o padrão de api/ugc-image-base.js (validado em produção):
//   - Modelo: fal-ai/nano-banana-pro/edit (suporta 2 imagens + prompt)
//   - num_images: 1
//   - Sem aspect_ratio explícito (Nano Banana Pro infere do input)
//   - Polling 2s × max 40 tentativas (~80s)
//
// REQUEST:
//   POST /api/pov-image-base
//   Body: {
//     productPhotoUrl: string,         // URL pública da foto do produto
//     handsReferenceUrl?: string,      // ⭐ opcional — foto do influencer pras mãos
//                                       // (modo 'influencer'). Se não vier, prompt
//                                       // descreve mãos genéricas (modo 'anonymous'
//                                       // ou fallback).
//     prompt: string,                  // prompt já montado pelo frontend, em inglês
//                                       // Combina type + scenario + style + hands
//                                       // (ver pov-kling-prompts.js mas ADAPTADO
//                                       // pra IMAGEM ESTÁTICA, não vídeo).
//     takeNumber?: number,             // só pra log (1, 2, 3...)
//     seed?: number,                   // 🆕 Plano v4 — opcional, integer.
//                                       // Quando fornecido, passado pro Nano Banana Pro
//                                       // pra reproducibilidade entre takes. Recomendado
//                                       // usar o MESMO seed em todas as N chamadas
//                                       // paralelas do mesmo POV.
//   }
//
// RESPONSE:
//   200: { imageUrl, prompt (echo), seed, requestId, takeNumber? }
//   400: { error: <mensagem> }
//   500: { error: <mensagem> }
//   504: { error: 'Timeout', requestId }

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
    const {
      productPhotoUrl,
      handsReferenceUrl = null,
      prompt,
      takeNumber = null,
      seed = null,  // 🆕 Plano v4 — opcional
    } = req.body || {};

    // ── Validação ────────────────────────────────────────────────────
    if (!productPhotoUrl || typeof productPhotoUrl !== 'string') {
      return res.status(400).json({ error: 'productPhotoUrl is required (string URL)' });
    }
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 50) {
      return res.status(400).json({ error: 'prompt is required (min 50 chars)' });
    }

    // 🆕 Validação leve do seed — inválido vira warning, não erro 400
    let finalSeed = null;
    if (seed !== null && seed !== undefined) {
      const s = Number(seed);
      if (Number.isFinite(s) && Number.isInteger(s) && s >= 0 && s <= Number.MAX_SAFE_INTEGER) {
        finalSeed = s;
      } else {
        console.warn(`[pov-image-base${takeNumber ? ` t${takeNumber}` : ''}] Invalid seed "${seed}" — ignored (expected non-negative integer).`);
      }
    }

    // ── Validação ESTRUTURAL do prompt POV (não bloqueia, só avisa) ──
    // Quem monta o prompt (frontend) deve garantir esses markers, mas a
    // falta deles não impede a geração. Padrão idêntico ao ugc-image-base.

    const hasHandsMarker = /\bhand[s]?\b/i.test(prompt);
    if (!hasHandsMarker && !/\bsem_maos\b|no hands\b/i.test(prompt)) {
      console.warn(`[pov-image-base${takeNumber ? ` t${takeNumber}` : ''}] prompt missing HANDS marker — pode gerar imagem sem mãos`);
    }

    const hasProductMarker = /\bproduct\b|\bbottle\b|\bcase\b|\bjar\b|\bshoe\b/i.test(prompt);
    if (!hasProductMarker) {
      console.warn(`[pov-image-base${takeNumber ? ` t${takeNumber}` : ''}] prompt missing PRODUCT marker — pode minimizar produto`);
    }

    // ── Monta image_urls ─────────────────────────────────────────────
    // Se tem handsReferenceUrl: 2 imagens (mãos do influencer + produto)
    // Se não tem: 1 imagem (só produto) — modo anônimo ou fallback
    const imageUrls = handsReferenceUrl
      ? [handsReferenceUrl, productPhotoUrl]
      : [productPhotoUrl];

    // ── Submit pra fal.ai ────────────────────────────────────────────
    const body = {
      prompt: prompt,
      image_urls: imageUrls,
      num_images: 1,
      output_format: 'png',
    };
    // 🆕 Plano v4 — injeta seed apenas se válido. Quando não fornecido,
    // Nano Banana Pro usa seed aleatório (comportamento default v1.0).
    if (finalSeed !== null) {
      body.seed = finalSeed;
    }

    const logPrefix = `[pov-image-base${takeNumber ? ` t${takeNumber}` : ''}]`;

    console.log(
      `${logPrefix} Submitting to Nano Banana Pro Edit:`,
      `prompt_chars=${prompt.length},`,
      `imgs=${imageUrls.length},`,
      `seed=${finalSeed !== null ? finalSeed : '(random)'},`,
      `product=${productPhotoUrl.substring(0, 60)}...,`,
      `hands=${handsReferenceUrl ? handsReferenceUrl.substring(0, 60) + '...' : '(none)'}`
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
      console.error(`${logPrefix} fal.ai submit error ${submitRes.status}:`, errText.substring(0, 300));
      return res.status(submitRes.status).json({
        error: `fal.ai error: ${submitRes.status}`,
        details: errText.substring(0, 300),
      });
    }

    const submitData = await submitRes.json();

    // ── Caso 1: retorno síncrono (raro) ──────────────────────────────
    if (submitData.images && submitData.images.length > 0) {
      console.log(`${logPrefix} Sync response received`);
      return res.status(200).json({
        imageUrl: submitData.images[0].url,
        prompt: prompt,
        seed: submitData.seed ?? finalSeed,
        requestId: submitData.request_id || null,
        takeNumber,
      });
    }

    // ── Caso 2: enfileirou, fazer polling ────────────────────────────
    const requestId = submitData.request_id;
    if (!requestId) {
      return res.status(500).json({ error: 'No request_id from fal.ai', data: submitData });
    }

    const statusUrl = submitData.status_url
      || `https://queue.fal.run/${NANO_BANANA_PRO_EDIT_ENDPOINT}/requests/${requestId}/status`;
    const responseUrl = submitData.response_url
      || `https://queue.fal.run/${NANO_BANANA_PRO_EDIT_ENDPOINT}/requests/${requestId}`;

    console.log(`${logPrefix} Queued: ${requestId}`);

    // Polling — Nano Banana Pro costuma levar 20-40s
    let attempts = 0;
    const maxAttempts = 40; // 40 × 2s = 80s máximo (ajustado ao timeout Vercel)

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      });

      if (!statusRes.ok) {
        console.error(`${logPrefix} Status check error ${statusRes.status} (attempt ${attempts})`);
        continue;
      }

      const status = await statusRes.json();

      if (status.status === 'COMPLETED') {
        const resultRes = await fetch(responseUrl, {
          headers: { 'Authorization': `Key ${FAL_KEY}` },
        });

        if (!resultRes.ok) {
          const errText = await resultRes.text();
          console.error(`${logPrefix} Result fetch error ${resultRes.status}:`, errText);
          return res.status(500).json({ error: `Result fetch error: ${resultRes.status}` });
        }

        const result = await resultRes.json();

        if (!result.images || result.images.length === 0) {
          console.error(`${logPrefix} No images in result:`, JSON.stringify(result).substring(0, 500));
          return res.status(500).json({ error: 'No images returned by Nano Banana Pro', data: result });
        }

        console.log(`${logPrefix} OK: ${requestId} after ${attempts * 2}s (seed=${result.seed ?? finalSeed ?? 'unknown'})`);
        return res.status(200).json({
          imageUrl: result.images[0].url,
          prompt: prompt,
          // Prioridade: seed do fal.ai (autoritativo) > seed que mandamos > null.
          // Se mandamos seed e o fal.ai aceitou, ele devolve no result.
          seed: result.seed ?? finalSeed,
          requestId: requestId,
          takeNumber,
        });
      }

      if (status.status === 'FAILED' || status.status === 'ERROR') {
        console.error(`${logPrefix} Generation failed:`, JSON.stringify(status).substring(0, 500));
        return res.status(500).json({
          error: 'Nano Banana Pro generation failed',
          details: status,
        });
      }

      // IN_QUEUE ou IN_PROGRESS → continua polling
    }

    // ── Estourou tempo ───────────────────────────────────────────────
    console.error(`${logPrefix} Timeout after ${maxAttempts * 2}s for request ${requestId}`);
    return res.status(504).json({
      error: 'Nano Banana Pro timeout',
      requestId: requestId,
    });

  } catch (error) {
    console.error('[pov-image-base] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
