// api/pov-compose-final.js (v1.2 — default takeDurationSeconds = 15 pra Kling v3)
//
// CHANGELOG v1.2 (18/05/2026):
//   🆕 DEFAULT takeDurationSeconds = 15 (era 10 na v1.1)
//      Motivo: parte da migração POV pra Kling v3 Standard 15s.
//      O slot por take agora é 15s (era 10s no Kling 2.6 Pro), o que
//      acomoda áudios PT-BR de 30-45 palavras sem estourar — fix definitivo
//      do "freeze frame no final" reportado pós-migração de vozes BR (13/05).
//
//   📌 Retrocompat 100%:
//      - Frontend pode continuar mandando takeDurationSeconds: 10 sem erro.
//      - A validação aceita qualquer valor entre 0-60.
//      - Quando o PovOutput v3.0 for deployado (arquivo 6), ele vai mandar
//        explicitamente takeDurationSeconds: 15.
//      - Entre os deploys, o sistema funciona normalmente com slot de 10s
//        (mesmo comportamento da v1.1).
//
//   📌 Modo SILENT inalterado:
//      - Continua usando fal-ai/ffmpeg-api/merge-videos (concat puro).
//      - takeDurationSeconds não é usado em modo silent.
//
//   📌 Modo VOICED:
//      - keyframes de vídeo: timestamp = i * 15000ms, duration = 15000ms
//      - keyframes de áudio: idem
//      - Resultado: vídeo final = N * 15s, com áudio sincronizado por take.
//
// CHANGELOG v1.1 (10/05/2026) — FIX MODO VOICED:
//   - Modo voiced REESCRITO usando `fal-ai/ffmpeg-api/compose` com tracks +
//     keyframes em timestamps explícitos por take. Substitui o pipeline
//     antigo de 3 chamadas (merge-audios → merge-audio-video) que dessincronizava.
//   - Modo voiced agora é 1 chamada só (stage='start' com audioUrls).
//     Sem mais stages 'merge-audios' e 'merge-final'.
//   - Vantagens:
//     * Sync perfeito por take (audio_i começa no timestamp i*10s)
//     * Vídeo final mantém 100% da duração original (sem -shortest cortando)
//     * 3× mais barato (1 chamada compose vs 3 chamadas separadas)
//     * 3× mais rápido (sem polling intermediário)
//   - Modo silent continua usando merge-videos (1 chamada como antes).
//   - Compat: frontend antigo que ainda manda stage='merge-audios' ou
//     'merge-final' recebe erro 400 explicativo orientando a atualizar.
//
// ════════════════════════════════════════════════════════════════════════
// Endpoint STATEFUL que orquestra a composição final do vídeo POV.
//
// MODOS DE USO:
//
// 🔇 MODO SILENT (POV puro mute):
//   1 chamada apenas, stage='start' SEM audioUrls.
//   Endpoint: fal-ai/ffmpeg-api/merge-videos
//   Concat dos N vídeos do Kling em sequência. Vídeo final = soma das durações.
//
// 🎙️ MODO VOICED (com narração Eleven v3):
//   1 chamada apenas, stage='start' COM audioUrls (mesmo número de videoUrls).
//   Endpoint: fal-ai/ffmpeg-api/compose
//   2 tracks:
//     - Track video: cada vídeo com timestamp = i*takeDuration_ms, duration = takeDuration_ms
//     - Track audio: cada áudio com timestamp = i*takeDuration_ms, duration = takeDuration_ms
//       (Se áudio é < takeDuration, vídeo continua rodando com silêncio.
//        Se áudio é ≥ takeDuration, fal.ai trunca pra duração do keyframe.)
//
// REQUEST:
//   POST /api/pov-compose-final
//   Body: {
//     stage?: 'start',         // só 'start' aceito na v1.1+ (default)
//     videoUrls: string[],     // sempre obrigatório, na ordem dos takes
//     audioUrls?: string[],    // OPCIONAL. Se presente, ativa modo voiced.
//                              // Tem que ter o mesmo comprimento de videoUrls.
//     takeDurationSeconds?: number, // default 15 (Kling v3 Standard).
//                                   // Aceita 0-60. Use 10 pra compat com Kling 2.6.
//   }
//
// RESPONSE 202:
//   {
//     requestId, endpoint, statusUrl, responseUrl,
//     stage: 'start', nextStage: null, done: true, mode: 'silent' | 'voiced'
//   }
//
// RESPONSE 400 / 500: { error }

// ════════════════════════════════════════════════════════════════════════
// Endpoints fal.ai
// ════════════════════════════════════════════════════════════════════════

const FFMPEG_MERGE_VIDEOS_ENDPOINT = 'fal-ai/ffmpeg-api/merge-videos';
const FFMPEG_COMPOSE_ENDPOINT = 'fal-ai/ffmpeg-api/compose';

// stages legadas (modo voiced antigo) — rejeitadas desde v1.1
const LEGACY_VOICED_STAGES = ['merge-audios', 'merge-final'];

const VALID_STAGES = ['start'];

// Default por take em segundos.
// v1.2 (18/05/2026): bumped 10 → 15 pra alinhar com Kling v3 Standard.
const DEFAULT_TAKE_DURATION_SECONDS = 15;

// ════════════════════════════════════════════════════════════════════════
// Handler
// ════════════════════════════════════════════════════════════════════════

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
      stage = 'start',
      videoUrls = [],
      audioUrls = [],
      takeDurationSeconds = DEFAULT_TAKE_DURATION_SECONDS,
    } = req.body || {};

    // ── Validação de stage ────────────────────────────────────────────
    if (LEGACY_VOICED_STAGES.includes(stage)) {
      return res.status(400).json({
        error: `stage="${stage}" foi removido na v1.1. Modo voiced agora usa stage="start" com audioUrls — frontend (PovOutput.jsx) precisa estar atualizado.`,
      });
    }
    if (!VALID_STAGES.includes(stage)) {
      return res.status(400).json({
        error: `stage must be one of: ${VALID_STAGES.join(', ')} (received: "${stage}")`,
      });
    }

    // ── Validação de vídeos ──────────────────────────────────────────
    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return res.status(400).json({ error: 'videoUrls is required (non-empty array)' });
    }

    // ── Determina o modo (silent vs voiced) ───────────────────────────
    const hasAudio = Array.isArray(audioUrls) && audioUrls.length > 0;
    const mode = hasAudio ? 'voiced' : 'silent';

    // ── Validação extra do modo voiced ────────────────────────────────
    if (mode === 'voiced' && audioUrls.length !== videoUrls.length) {
      return res.status(400).json({
        error: `voiced mode requires audioUrls.length === videoUrls.length (got ${audioUrls.length} audios for ${videoUrls.length} videos)`,
      });
    }
    if (typeof takeDurationSeconds !== 'number' || takeDurationSeconds <= 0 || takeDurationSeconds > 60) {
      return res.status(400).json({ error: 'takeDurationSeconds must be a number between 0 and 60' });
    }

    // ── Roteia pro endpoint correto ───────────────────────────────────
    let result;
    if (mode === 'silent') {
      result = await composeSilent(videoUrls, FAL_KEY);
    } else {
      result = await composeVoiced(videoUrls, audioUrls, takeDurationSeconds, FAL_KEY);
    }

    if (result.error) {
      return res.status(result.statusCode || 500).json({
        error: result.error,
        details: result.details,
      });
    }

    console.log(
      `[pov-compose-final v1.2] OK: mode=${mode}, takeDur=${takeDurationSeconds}s, requestId=${result.requestId}, endpoint=${result.endpoint}`
    );

    return res.status(202).json({
      requestId: result.requestId,
      endpoint: result.endpoint,
      statusUrl: result.statusUrl,
      responseUrl: result.responseUrl,
      stage: 'start',
      nextStage: null, // sempre null desde v1.1 (1 chamada só)
      done: true,
      mode: mode,
    });
  } catch (error) {
    console.error('[pov-compose-final v1.2] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ════════════════════════════════════════════════════════════════════════
// Modo SILENT — concat dos vídeos do Kling via merge-videos
// (mesmo comportamento desde v1.0, mantido por simplicidade e custo menor)
// ════════════════════════════════════════════════════════════════════════

async function composeSilent(videoUrls, FAL_KEY) {
  console.log(`[pov-compose-final silent v1.2] Merging ${videoUrls.length} videos`);

  const submitData = await submitFalQueue(
    FFMPEG_MERGE_VIDEOS_ENDPOINT,
    { video_urls: videoUrls },
    FAL_KEY
  );

  if (submitData.error) return submitData;

  return {
    requestId: submitData.request_id,
    endpoint: FFMPEG_MERGE_VIDEOS_ENDPOINT,
    statusUrl: submitData.status_url,
    responseUrl: submitData.response_url,
  };
}

// ════════════════════════════════════════════════════════════════════════
// Modo VOICED — fal-ai/ffmpeg-api/compose com tracks + timestamps
//
// Schema do compose:
//   tracks: [
//     {
//       id: string,
//       type: 'video' | 'audio',
//       keyframes: [{ url, timestamp (ms), duration (ms) }]
//     }
//   ]
//
// Estratégia: cada take ocupa um slot de takeDurationSeconds (15s default na v1.2).
// Vídeo do take i: timestamp = i * takeDuration_ms, duration = takeDuration_ms
// Áudio do take i: timestamp = i * takeDuration_ms, duration = takeDuration_ms
//   (Se áudio é < slot, fal.ai pad com silêncio. Se ≥ slot, trunca.)
//
// Resultado: vídeo final tem N * takeDurationSeconds de duração, áudio
// sincronizado por take.
// ════════════════════════════════════════════════════════════════════════

async function composeVoiced(videoUrls, audioUrls, takeDurationSeconds, FAL_KEY) {
  const durationMs = takeDurationSeconds * 1000;
  console.log(
    `[pov-compose-final voiced v1.2] Composing ${videoUrls.length} takes (${takeDurationSeconds}s each)`
  );

  const videoKeyframes = videoUrls.map((url, i) => ({
    url,
    timestamp: i * durationMs,
    duration: durationMs,
  }));

  const audioKeyframes = audioUrls.map((url, i) => ({
    url,
    timestamp: i * durationMs,
    duration: durationMs,
  }));

  const tracks = [
    {
      id: 'video_track',
      type: 'video',
      keyframes: videoKeyframes,
    },
    {
      id: 'audio_track',
      type: 'audio',
      keyframes: audioKeyframes,
    },
  ];

  const submitData = await submitFalQueue(
    FFMPEG_COMPOSE_ENDPOINT,
    { tracks },
    FAL_KEY
  );

  if (submitData.error) return submitData;

  return {
    requestId: submitData.request_id,
    endpoint: FFMPEG_COMPOSE_ENDPOINT,
    statusUrl: submitData.status_url,
    responseUrl: submitData.response_url,
  };
}

// ════════════════════════════════════════════════════════════════════════
// Helper: submete request à fila do fal.ai e retorna URLs de status/response
// ════════════════════════════════════════════════════════════════════════

async function submitFalQueue(endpoint, body, FAL_KEY) {
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
    console.error(
      `[pov-compose-final v1.2] fal.ai submit error ${submitRes.status} (${endpoint}):`,
      errText.substring(0, 500)
    );
    return {
      error: `fal.ai retornou ${submitRes.status} ao submeter ${endpoint}`,
      details: errText.substring(0, 300),
      statusCode: 502,
    };
  }

  const data = await submitRes.json();
  if (!data.request_id) {
    return {
      error: 'fal.ai não retornou request_id',
      details: JSON.stringify(data).substring(0, 300),
      statusCode: 502,
    };
  }

  return data;
}
