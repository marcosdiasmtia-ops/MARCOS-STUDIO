// api/pov-elevenlabs-tts.js (v1.1 — Eleven v3 gera áudio PT-BR de 1 take POV)
//
// 🆕 v1.1 (13/05/2026) — Fix sotaque PT-BR: default de languageCode mudou
//    de 'pt' (genérico, tendia a sotaque europeu) pra 'pt-BR' (IETF BCP 47,
//    força português brasileiro). Sintoma corrigido: vozes anglo do Eleven v3
//    (Sarah, Aria, Brian, etc.) saíam com sotaque de Portugal em vez do Brasil.
//
// Endpoint ATÔMICO que gera UM áudio de fala pra UM take POV (modo 'voiced').
// O áudio sai como MP3 hospedado no fal.ai, pronto pra mergear com o vídeo
// daquele take no compose final (Lote C).
//
// É atômico (não faz N takes numa só chamada) por consistência de pipeline
// com pov-image-base.js. Frontend orquestra N chamadas paralelas.
//
// 🎙️ MODELO: ElevenLabs Eleven v3 via fal.ai
//   - Endpoint: fal-ai/elevenlabs/tts/eleven-v3
//   - Aceita 70+ línguas (PT-BR estável)
//   - AUDIO TAGS inline: [excited] [whispers] [softly] [confident] etc.
//     (lista completa em pov-elevenlabs-voices.js)
//   - Limite: 3.000 chars por geração (sobra muito pra POV — max ~900 chars
//     por take de 10s)
//   - Voz: aceita NOME direto (Sarah, Brian, Aria...) — não precisa hash
//
// FALLBACK ENDPOINT (se v3 instabilizar): trocar string ELEVENLABS_ENDPOINT
// pra 'fal-ai/elevenlabs/tts/multilingual-v2'. Mesma lista de vozes funciona,
// só perde os audio tags.
//
// REQUEST:
//   POST /api/pov-elevenlabs-tts
//   Body: {
//     text: string,                    // texto em PT-BR, pode conter audio tags
//                                       // Ex: "[excited] Gente, achei o perfeito!"
//     voiceId: string,                 // nome da voz (ex: "Sarah", "Brian")
//                                       // Lista oficial fal.ai espelhada abaixo
//     speed?: number,                  // 0.7-1.2 (default 1.0)
//     stability?: number,              // 0-1 (default 0.5)
//     similarityBoost?: number,        // 0-1 (default 0.75)
//     languageCode?: string,           // IETF BCP 47 (default 'pt-BR' pra
//                                       // português brasileiro). Foi 'pt' na
//                                       // v1.0, mas o Eleven v3 tendia a
//                                       // sotaque europeu — 'pt-BR' força BR.
//     takeNumber?: number,             // só pra log
//   }
//
// RESPONSE:
//   200: { audioUrl, voiceId, charCount, requestId, takeNumber? }
//   400: { error: <mensagem> }
//   500: { error: <mensagem> }
//   504: { error: 'Timeout', requestId }

const ELEVENLABS_ENDPOINT = 'fal-ai/elevenlabs/tts/eleven-v3';
const ELEVENLABS_FALLBACK = 'fal-ai/elevenlabs/tts/multilingual-v2';

// ════════════════════════════════════════════════════════════════════════
// Lista de vozes válidas (espelho de pov-elevenlabs-voices.js)
// ════════════════════════════════════════════════════════════════════════
//
// 🔁 SE ALTERAR pov-elevenlabs-voices.js, ATUALIZE AQUI.
// Inclui as 15 vozes do data file + as 5 oficiais do fal.ai não escolhidas
// (Rachel, Roger, Charlie, Callum, River, Chris) pra aceitar uso direto.

const VALID_VOICES = [
  // 8 femininas escolhidas
  'Sarah', 'Aria', 'Charlotte', 'Alice', 'Matilda', 'Lily', 'Jessica', 'Laura',
  // 7 masculinas escolhidas
  'Brian', 'George', 'Bill', 'Will', 'Liam', 'Eric', 'Daniel',
  // 5 oficiais não escolhidas (aceitas se usuário forçar)
  'Rachel', 'Roger', 'Charlie', 'Callum', 'River', 'Chris',
];

// Audio tags válidas Eleven v3 (espelho de pov-elevenlabs-voices.js)
const VALID_AUDIO_TAGS = [
  'happy', 'sad', 'excited', 'angry', 'sarcastically', 'nervous', 'confident',
  'whispers', 'shouting', 'slowly', 'quickly', 'softly',
  'laughs', 'chuckles', 'sighs', 'gasps', 'coughs', 'gulps', 'applause',
];

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
      text,
      voiceId,
      speed = 1.0,
      stability = 0.5,
      similarityBoost = 0.75,
      languageCode = 'pt-BR',
      takeNumber = null,
    } = req.body || {};

    // ── Validação ────────────────────────────────────────────────────
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required (non-empty string)' });
    }
    if (text.length > 3000) {
      return res.status(400).json({ error: `text too long (${text.length} chars, max 3000 for Eleven v3)` });
    }
    if (!voiceId || typeof voiceId !== 'string') {
      return res.status(400).json({ error: 'voiceId is required (string, ex: "Sarah")' });
    }
    if (!VALID_VOICES.includes(voiceId)) {
      // Não bloqueia — fal.ai pode aceitar vozes que não temos catalogadas.
      // Só avisa via warn pra debug.
      console.warn(`[pov-elevenlabs-tts] voiceId "${voiceId}" not in known list — fal.ai vai validar`);
    }
    if (typeof speed !== 'number' || speed < 0.7 || speed > 1.2) {
      return res.status(400).json({ error: 'speed must be number 0.7-1.2' });
    }

    // ── Validação leve de audio tags (não bloqueia) ──────────────────
    const tagMatches = text.match(/\[([^\]]+)\]/g) || [];
    const invalidTags = tagMatches
      .map((m) => m.slice(1, -1).trim().toLowerCase())
      .filter((t) => !VALID_AUDIO_TAGS.includes(t));

    if (invalidTags.length > 0) {
      console.warn(
        `[pov-elevenlabs-tts${takeNumber ? ` t${takeNumber}` : ''}] unknown audio tags (Eleven v3 vai ignorar): ${invalidTags.join(', ')}`
      );
    }

    // ── Submit pra fal.ai ────────────────────────────────────────────
    const body = {
      text: text,
      voice: voiceId,
      speed: speed,
      stability: stability,
      similarity_boost: similarityBoost,
      language_code: languageCode,
    };

    const logPrefix = `[pov-elevenlabs-tts${takeNumber ? ` t${takeNumber}` : ''}]`;

    console.log(
      `${logPrefix} Submitting to ${ELEVENLABS_ENDPOINT}:`,
      `voice=${voiceId},`,
      `chars=${text.length},`,
      `tags=${tagMatches.length}${invalidTags.length ? `,invalid=${invalidTags.length}` : ''},`,
      `lang=${languageCode}`
    );

    const submitRes = await fetch(`https://queue.fal.run/${ELEVENLABS_ENDPOINT}`, {
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
        endpoint: ELEVENLABS_ENDPOINT,
      });
    }

    const submitData = await submitRes.json();

    // ── Caso 1: retorno síncrono ─────────────────────────────────────
    if (submitData.audio && submitData.audio.url) {
      console.log(`${logPrefix} Sync response received`);
      return res.status(200).json({
        audioUrl: submitData.audio.url,
        voiceId: voiceId,
        charCount: text.length,
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
      || `https://queue.fal.run/${ELEVENLABS_ENDPOINT}/requests/${requestId}/status`;
    const responseUrl = submitData.response_url
      || `https://queue.fal.run/${ELEVENLABS_ENDPOINT}/requests/${requestId}`;

    console.log(`${logPrefix} Queued: ${requestId}`);

    // Polling — Eleven v3 costuma ser rápido (5-15s)
    let attempts = 0;
    const maxAttempts = 30; // 30 × 2s = 60s máximo

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

        if (!result.audio || !result.audio.url) {
          console.error(`${logPrefix} No audio in result:`, JSON.stringify(result).substring(0, 500));
          return res.status(500).json({ error: 'No audio returned by Eleven v3', data: result });
        }

        console.log(`${logPrefix} OK: ${requestId} after ${attempts * 2}s, audio=${result.audio.url.substring(0, 60)}...`);
        return res.status(200).json({
          audioUrl: result.audio.url,
          voiceId: voiceId,
          charCount: text.length,
          requestId: requestId,
          takeNumber,
        });
      }

      if (status.status === 'FAILED' || status.status === 'ERROR') {
        console.error(`${logPrefix} Generation failed:`, JSON.stringify(status).substring(0, 500));
        return res.status(500).json({
          error: 'Eleven v3 generation failed',
          details: status,
          endpoint: ELEVENLABS_ENDPOINT,
        });
      }

      // IN_QUEUE ou IN_PROGRESS → continua polling
    }

    // ── Estourou tempo ───────────────────────────────────────────────
    console.error(`${logPrefix} Timeout after ${maxAttempts * 2}s for request ${requestId}`);
    return res.status(504).json({
      error: 'Eleven v3 timeout',
      requestId: requestId,
    });

  } catch (error) {
    console.error('[pov-elevenlabs-tts] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
