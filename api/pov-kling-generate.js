// api/pov-kling-generate.js (v3.0 — migração pra Kling v3 Standard 15s)
//
// CHANGELOG v3.0 (18/05/2026):
//   🆕 MIGRAÇÃO PRA KLING V3 STANDARD (15s)
//      Motivo: fix definitivo do "freeze frame no final do vídeo POV".
//      Vozes BR migradas em 13/05/2026 falam ~12-15s pras 25-30 palavras
//      do voiceText, estourando o slot de 10s do Kling 2.6 Pro. O FFmpeg
//      compose estendia o último frame congelado em vez de truncar o áudio.
//
//      Solução: subir o slot pra 15s usando Kling v3 Standard, que aceita
//      nativamente duration 3-15s. Kling 2.6 Pro só aceitava '5' ou '10'.
//
//   📌 Endpoint: fal-ai/kling-video/v3/standard/image-to-video
//      (era fal-ai/kling-video/v2.6/pro/image-to-video)
//      Custo: $0.084/s (audio off) — era $0.07/s no 2.6 Pro
//      Custo por take de 15s: $1.26 — era $0.70 no take de 10s
//      Diferença: +$0.56/take, mas slot 50% maior comporta áudios PT-BR.
//
//   📌 MESMO modelo usado pela aba VTON em produção desde 25/04/2026.
//      Validado, estável, manutenção unificada futura entre POV e VTON.
//
//   📌 Schema retrocompat:
//      - Body aceita duration entre '3' e '15' (string ou number).
//      - Default '15' (era '10' na v1.0).
//      - Se PovOutput ainda mandar '10' (deploy intermediário), continua
//        funcionando — Kling v3 aceita o range completo 3-15s.
//
//   📌 Mesmo formato de payload do v2.6 Pro:
//      - start_image_url (idêntico nos dois modelos)
//      - prompt, duration (string), generate_audio (bool opcional)
//      - Aspect ratio é inferido do start_image_url pelo Kling v3
//
// CHANGELOG v1.0 (10/05/2026):
//   Endpoint ATÔMICO inicial usando Kling 2.6 Pro com duration 10s.
//
// ════════════════════════════════════════════════════════════════════════
// Endpoint que SUBMETE 1 vídeo Kling pra fal.ai e retorna 202 com
// requestId/URLs pro frontend fazer polling. NÃO faz polling no servidor.
//
// POR QUE submit-only:
// Kling v3 Standard leva 2-5 min por vídeo de 15s. Vercel Pro tem timeout
// de 60s. Não cabe num único request. Solução: padrão submit + polling no
// cliente, reusando o /api/video-status que já existe no projeto.
//
// PIPELINE COMPLETA:
//   1. pov-image-base.js     → imagem-base (input pra esse endpoint)
//   2. pov-kling-generate    (ESTE)   → submete vídeo, retorna requestId
//   3. /api/video-status     → polling do cliente
//   4. pov-elevenlabs-tts    → áudio (paralelo, se modo voiced)
//   5. pov-compose-final     → concat tudo
//
// REQUEST:
//   POST /api/pov-kling-generate
//   Body: {
//     prompt: string,           // prompt em inglês (do pov-kling-prompts)
//     startImageUrl: string,    // URL da imagem-base (do pov-image-base)
//     duration?: '3'..'15',     // default '15' (era '10' na v1.0)
//     generateAudio?: boolean,  // default false (sempre false pra POV)
//     takeNumber?: number,      // só pra log
//   }
//
// RESPONSE:
//   202: { requestId, endpoint, statusUrl, responseUrl, takeNumber? }
//   400: { error }
//   500: { error }
//
// COMO O FRONTEND USA:
//   1. Chama submitPovKlingVideo(input) → recebe { requestId, endpoint, ... }
//   2. Chama checkVideoStatus(...) em loop até status === 'COMPLETED'
//   3. Resultado tem result.video.url

const KLING_ENDPOINT = 'fal-ai/kling-video/v3/standard/image-to-video';
const MIN_DURATION_SECONDS = 3;
const MAX_DURATION_SECONDS = 15;
const DEFAULT_DURATION_SECONDS = 15;

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
      startImageUrl,
      duration,
      generateAudio = false,
      takeNumber = null,
    } = req.body || {};

    // ── Validação ────────────────────────────────────────────────────
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 30) {
      return res.status(400).json({ error: 'prompt is required (min 30 chars)' });
    }
    if (!startImageUrl || typeof startImageUrl !== 'string') {
      return res.status(400).json({ error: 'startImageUrl is required (string URL)' });
    }

    // Default '15' se não vier. Aceita 3-15 (range nativo do Kling v3 Standard).
    // Retrocompat: frontend antigo mandando '10' continua funcionando — '10'
    // tá dentro do range válido. Isso permite deploy gradual sem quebrar nada.
    const durationStr = String(duration || DEFAULT_DURATION_SECONDS);
    const durationNum = parseFloat(durationStr);
    if (
      isNaN(durationNum) ||
      durationNum < MIN_DURATION_SECONDS ||
      durationNum > MAX_DURATION_SECONDS
    ) {
      return res.status(400).json({
        error: `duration must be a number between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS} (seconds), received "${duration}"`,
      });
    }

    // ── Monta body ───────────────────────────────────────────────────
    // Schema Kling v3 Standard: start_image_url + prompt + duration (string)
    // + generate_audio (bool opcional). Aspect ratio é inferido pelo modelo
    // a partir do start_image_url, então não precisamos passar.
    const body = {
      prompt: prompt,
      start_image_url: startImageUrl,
      duration: durationStr,
      generate_audio: !!generateAudio,
    };

    const logPrefix = `[pov-kling-generate v3.0${takeNumber ? ` t${takeNumber}` : ''}]`;

    console.log(
      `${logPrefix} Submitting to ${KLING_ENDPOINT}:`,
      `prompt_chars=${prompt.length},`,
      `image=${startImageUrl.substring(0, 60)}...,`,
      `duration=${durationStr}s,`,
      `generate_audio=${!!generateAudio}`
    );

    // ── Submit pra fal.ai ────────────────────────────────────────────
    const submitRes = await fetch(`https://queue.fal.run/${KLING_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${FAL_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      console.error(
        `${logPrefix} fal.ai submit error ${submitRes.status}:`,
        errText.substring(0, 300)
      );
      return res.status(submitRes.status).json({
        error: `fal.ai error: ${submitRes.status}`,
        details: errText.substring(0, 300),
      });
    }

    const submitData = await submitRes.json();
    const requestId = submitData.request_id;

    if (!requestId) {
      // Caso raro: resposta síncrona (vídeo curto pode retornar direto)
      if (submitData.video) {
        console.log(`${logPrefix} Sync response received`);
        return res.status(200).json({
          ...submitData,
          takeNumber,
        });
      }
      return res.status(500).json({ error: 'No request_id from fal.ai', data: submitData });
    }

    const statusUrl = submitData.status_url
      || `https://queue.fal.run/${KLING_ENDPOINT}/requests/${requestId}/status`;
    const responseUrl = submitData.response_url
      || `https://queue.fal.run/${KLING_ENDPOINT}/requests/${requestId}`;

    console.log(`${logPrefix} Queued: ${requestId}`);

    // 202 Accepted — frontend faz polling no /api/video-status
    return res.status(202).json({
      requestId,
      endpoint: KLING_ENDPOINT,
      statusUrl,
      responseUrl,
      takeNumber,
    });
  } catch (error) {
    console.error('[pov-kling-generate v3.0] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
