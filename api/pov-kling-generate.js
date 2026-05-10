// api/pov-kling-generate.js (v1.0 — submit Kling 2.6 Pro pra 1 take POV)
//
// Endpoint que SUBMETE 1 vídeo Kling 2.6 Pro pra fal.ai e retorna 202 com
// requestId/URLs pro frontend fazer polling. NÃO faz polling no servidor.
//
// POR QUE submit-only:
// Kling 2.6 Pro leva 2-5 min por vídeo de 10s. Vercel Pro tem timeout de 60s.
// Não cabe num único request. Solução: padrão submit + polling no cliente,
// reusando o /api/video-status que já existe no projeto.
//
// CONFIG KLING 2.6 PRO:
//   - Endpoint: fal-ai/kling-video/v2.6/pro/image-to-video
//   - Custo: $0.07/segundo (audio off — nosso caso)
//   - 10s × $0.07 = $0.70 por take
//   - generate_audio: false (áudio vem do Eleven v3 separado)
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
//     duration?: '5' | '10',    // default '10'
//     generateAudio?: boolean,  // default false (sempre false pra POV)
//     takeNumber?: number,      // só pra log
//   }
//
// RESPONSE:
//   202: { requestId, endpoint, statusUrl, responseUrl, takeNumber? }
//   400: { error }
//   500: { error }
//
// COMO O FRONTEND USA (Sessão 3):
//   1. Chama generatePovKlingVideo(input) → recebe { requestId, endpoint, statusUrl, responseUrl }
//   2. Chama checkVideoStatus(requestId, endpoint, statusUrl, responseUrl) em loop
//   3. Quando status === 'COMPLETED', resultado tem result.video.url

const KLING_ENDPOINT = 'fal-ai/kling-video/v2.6/pro/image-to-video';

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
      duration = '10',
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
    if (duration !== '5' && duration !== '10') {
      return res.status(400).json({ error: 'duration must be "5" or "10"' });
    }

    // ── Monta body ───────────────────────────────────────────────────
    const body = {
      prompt: prompt,
      start_image_url: startImageUrl,
      duration: duration,
      generate_audio: !!generateAudio,
    };

    const logPrefix = `[pov-kling-generate${takeNumber ? ` t${takeNumber}` : ''}]`;

    console.log(
      `${logPrefix} Submitting to ${KLING_ENDPOINT}:`,
      `prompt_chars=${prompt.length},`,
      `image=${startImageUrl.substring(0, 60)}...,`,
      `duration=${duration}s,`,
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
      console.error(`${logPrefix} fal.ai submit error ${submitRes.status}:`, errText.substring(0, 300));
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
    console.error('[pov-kling-generate] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
