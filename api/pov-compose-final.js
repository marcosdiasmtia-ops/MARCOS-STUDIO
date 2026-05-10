// api/pov-compose-final.js (v1.0 — compose final POV via FFmpeg API do fal.ai)
//
// Endpoint STATEFUL que orquestra a composição final do vídeo POV. Cada
// chamada faz APENAS UM submit fal.ai e retorna 202 com requestId + nextStage.
// O frontend orquestra: chama → polling no /api/video-status → chama com
// próximo stage → repete até nextStage=null (vídeo final pronto).
//
// MODOS DE USO:
//
// 🔇 MODO SILENT (default — POV puro mute):
//   1 etapa apenas. Chama com stage='start' e modo silent.
//   Pipeline: merge-videos → fim. Retorna URL do vídeo concatenado.
//
// 🎙️ MODO VOICED (com narração Eleven v3):
//   3 etapas. Frontend orquestra:
//   stage 'start' → merge-videos → frontend salva videoUrl
//   stage 'merge-audios' → merge-audios → frontend salva audioUrl
//   stage 'merge-final' → merge-audio-video → URL final
//
// FFMPEG API DO FAL.AI (descoberto em 10/05/2026 — game changer):
//   - fal-ai/ffmpeg-api/merge-videos     — concat de N vídeos
//   - fal-ai/ffmpeg-api/merge-audios     — concat de N áudios
//   - fal-ai/ffmpeg-api/merge-audio-video — mergear áudio em vídeo
//
// Zero FFmpeg local no Vercel. Todo processamento na infra do fal.ai.
//
// ⚠️ LIMITAÇÃO CONHECIDA DO MODO VOICED v1.0:
//   merge-audios concatena áudios EM SEQUÊNCIA, sem padding entre eles.
//   Se take 1 dura 10s mas fala dura 6s, o áudio do take 2 começa aos 6s
//   (não aos 10s). Resultado: dessincronia entre fala e movimento.
//
//   FIX FUTURO (v1.1): usar fal-ai/ffmpeg-api/compose com tracks que tem
//   timestamps explícitos por take (audio[0] em 0s, audio[1] em 10s, etc).
//   Por enquanto, modo voiced fica como "experimental — pode dessincronizar".
//
// REQUEST:
//   POST /api/pov-compose-final
//   Body: {
//     stage: 'start' | 'merge-audios' | 'merge-final',  // default 'start'
//     videoUrls: string[],                               // sempre obrigatório (ordem dos takes)
//     audioUrls?: string[],                              // só se modo voiced
//     // Pra stage != 'start':
//     mergedVideoUrl?: string,                           // resultado do stage 'start'
//     mergedAudioUrl?: string,                           // resultado do stage 'merge-audios'
//   }
//
// RESPONSE 202 (etapa intermediária ou final assíncrona):
//   {
//     requestId,
//     endpoint,           // qual endpoint fal.ai foi usado
//     statusUrl,          // pra polling no /api/video-status
//     responseUrl,        // pra polling no /api/video-status
//     stage,              // qual stage acabou de submeter
//     nextStage,          // próximo a chamar OU null se for o último
//     done: false,        // true só quando esta etapa é a última
//   }
//
// RESPONSE 400 / 500: { error }

// ════════════════════════════════════════════════════════════════════════
// Endpoints fal.ai
// ════════════════════════════════════════════════════════════════════════

const FFMPEG_MERGE_VIDEOS_ENDPOINT = 'fal-ai/ffmpeg-api/merge-videos';
const FFMPEG_MERGE_AUDIOS_ENDPOINT = 'fal-ai/ffmpeg-api/merge-audios';
const FFMPEG_MERGE_AV_ENDPOINT = 'fal-ai/ffmpeg-api/merge-audio-video';

const VALID_STAGES = ['start', 'merge-audios', 'merge-final'];

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
      mergedVideoUrl = null,
      mergedAudioUrl = null,
    } = req.body || {};

    // ── Validação ────────────────────────────────────────────────────
    if (!VALID_STAGES.includes(stage)) {
      return res.status(400).json({ error: `stage must be one of: ${VALID_STAGES.join(', ')}` });
    }
    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return res.status(400).json({ error: 'videoUrls is required (non-empty array)' });
    }
    if (videoUrls.length === 1) {
      // Só 1 vídeo, não precisa concat
      console.warn('[pov-compose-final] Apenas 1 video — concat desnecessário');
    }

    // ── Determina o modo (silent vs voiced) baseado em audioUrls ─────
    const hasAudio = Array.isArray(audioUrls) && audioUrls.length > 0;
    const mode = hasAudio ? 'voiced' : 'silent';

    // ── Validação de stage por modo ──────────────────────────────────
    if (mode === 'silent' && stage !== 'start') {
      return res.status(400).json({
        error: 'silent mode only uses stage="start" (single merge-videos call)',
      });
    }
    if (stage === 'merge-audios' && !mergedVideoUrl) {
      return res.status(400).json({
        error: 'mergedVideoUrl is required for stage="merge-audios" (from previous stage="start" result)',
      });
    }
    if (stage === 'merge-final' && (!mergedVideoUrl || !mergedAudioUrl)) {
      return res.status(400).json({
        error: 'mergedVideoUrl AND mergedAudioUrl are required for stage="merge-final"',
      });
    }

    // ── Roteia pro stage correto ─────────────────────────────────────
    let result;
    switch (stage) {
      case 'start':
        result = await stageStart(videoUrls, mode, FAL_KEY);
        break;
      case 'merge-audios':
        result = await stageMergeAudios(audioUrls, FAL_KEY);
        break;
      case 'merge-final':
        result = await stageMergeFinal(mergedVideoUrl, mergedAudioUrl, FAL_KEY);
        break;
    }

    if (result.error) {
      return res.status(result.statusCode || 500).json({ error: result.error, details: result.details });
    }

    console.log(
      `[pov-compose-final] OK: stage=${stage}, mode=${mode}, requestId=${result.requestId}, nextStage=${result.nextStage || 'null (done)'}`
    );

    return res.status(202).json({
      requestId: result.requestId,
      endpoint: result.endpoint,
      statusUrl: result.statusUrl,
      responseUrl: result.responseUrl,
      stage: stage,
      nextStage: result.nextStage,
      done: result.nextStage === null,
      mode: mode,
    });
  } catch (error) {
    console.error('[pov-compose-final] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ════════════════════════════════════════════════════════════════════════
// Stage 'start' — concat dos vídeos do Kling
// Sempre roda. Em modo silent, é o único stage. Em modo voiced, vira
// input do stage 'merge-final' depois.
// ════════════════════════════════════════════════════════════════════════

async function stageStart(videoUrls, mode, FAL_KEY) {
  console.log(`[pov-compose-final stage=start] Merging ${videoUrls.length} videos (mode=${mode})`);

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
    nextStage: mode === 'voiced' ? 'merge-audios' : null,
  };
}

// ════════════════════════════════════════════════════════════════════════
// Stage 'merge-audios' — concat dos áudios do Eleven v3 (modo voiced)
//
// ⚠️ LIMITAÇÃO v1.0: concatena em sequência sem padding. Se cada áudio
// dura 5-8s mas cada take dura 10s, áudios "comem" o silêncio entre takes.
// ════════════════════════════════════════════════════════════════════════

async function stageMergeAudios(audioUrls, FAL_KEY) {
  console.log(`[pov-compose-final stage=merge-audios] Merging ${audioUrls.length} audios`);

  const submitData = await submitFalQueue(
    FFMPEG_MERGE_AUDIOS_ENDPOINT,
    { audio_urls: audioUrls },
    FAL_KEY
  );

  if (submitData.error) return submitData;

  return {
    requestId: submitData.request_id,
    endpoint: FFMPEG_MERGE_AUDIOS_ENDPOINT,
    statusUrl: submitData.status_url,
    responseUrl: submitData.response_url,
    nextStage: 'merge-final',
  };
}

// ════════════════════════════════════════════════════════════════════════
// Stage 'merge-final' — mergeia o áudio concatenado no vídeo concatenado
// ════════════════════════════════════════════════════════════════════════

async function stageMergeFinal(videoUrl, audioUrl, FAL_KEY) {
  console.log(`[pov-compose-final stage=merge-final] Merging audio+video`);

  const submitData = await submitFalQueue(
    FFMPEG_MERGE_AV_ENDPOINT,
    {
      video_url: videoUrl,
      audio_url: audioUrl,
    },
    FAL_KEY
  );

  if (submitData.error) return submitData;

  return {
    requestId: submitData.request_id,
    endpoint: FFMPEG_MERGE_AV_ENDPOINT,
    statusUrl: submitData.status_url,
    responseUrl: submitData.response_url,
    nextStage: null, // último stage
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
    console.error(`[pov-compose-final] fal.ai submit error ${submitRes.status} (${endpoint}):`, errText.substring(0, 300));
    return {
      error: `fal.ai error: ${submitRes.status}`,
      details: errText.substring(0, 300),
      statusCode: submitRes.status,
    };
  }

  const data = await submitRes.json();

  if (!data.request_id) {
    return { error: 'No request_id from fal.ai', details: JSON.stringify(data).substring(0, 300), statusCode: 500 };
  }

  return {
    request_id: data.request_id,
    status_url: data.status_url || `https://queue.fal.run/${endpoint}/requests/${data.request_id}/status`,
    response_url: data.response_url || `https://queue.fal.run/${endpoint}/requests/${data.request_id}`,
  };
}
