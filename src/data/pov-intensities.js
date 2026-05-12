// src/data/pov-intensities.js
//
// 9 níveis de Intensidade Humana — NOVO arquivo do Plano v4 (sessão
// 11/05/2026). Dimensão de voz que aparece SÓ no Step 9 do PovWizard
// quando `audioMode === 'voiced'`. Define o estilo de fala da influencer
// no TTS Eleven v3 — emoção, ritmo, energia, tags de áudio sugeridas.
//
// 🎚️ ESCALA NÃO-LINEAR
// Diferente do POV_IMPERFECTIONS (escala progressiva polido → cru), as
// intensidades são variantes EXPRESSIVAS sem ordem moral. Cada uma serve
// a um momento/tipo de produto. Use `level` apenas como ID de ordenação
// estável na UI, não como hierarquia.
//
// Os 9 níveis cobrem todo o espectro de produção UGC:
//   1. 🎬 Comercial limpo — Anúncio polido broadcast
//   2. ✨ Influencer natural — Creator profissional
//   3. 📱 TikTok casual — Vibe creator real
//   4. 📸 iPhone cru — Gravação caseira espontânea
//   5. 🤩 Amigo empolgado — Mostrando descoberta animada
//   6. 🌙 Rotina noturna calma — Soft, baixo, íntimo (ASMR-adjacent)
//   7. 💎 Luxo contemplativo — Premium, sofisticado, espaçado
//   8. 🚀 Hype urgente — Drop limitado, FOMO
//   9. 🤝 Recomendação confiável — Review honesto, "eu testei"
//
// 🔀 MAPPING IMPERFEIÇÃO → INTENSIDADE
// Fica em ./pov-mappings.js (arquivo 7 do Sub-lote A). É overrideable
// pelo usuário no Step 9. Quando o usuário escolhe imperfeição mas não
// intensidade, o PovWizard sugere a intensidade default desse mapping.
//
// 🎭 BALANCEAMENTO F+M
// Cada nível tem ≥2 vozes de cada gênero recomendadas, garantindo que
// a aba POV funcione com qualquer influencer cadastrada (de qualquer
// gênero). Os IDs de voz aqui devem existir em pov-elevenlabs-voices.js.
//
// 🏷️ AUDIO TAGS HINT
// Cada nível sugere 2-4 audio tags do Eleven v3 (emotional/delivery/
// nonVerbal). Esses tags são pistas pro pov-script.js (arquivo 8 do
// Sub-lote B) — o Claude lá decide quais usar de fato no script gerado.
//
// Cada intensidade tem:
//   - id: slug em snake_case
//   - name: nome em PT-BR pra UI
//   - emoji: emoji representativo
//   - level: 1-9 (ID estável de ordenação)
//   - vibe: rótulo curto pra UI (3-5 palavras)
//   - description: 1 frase explicando a vibe
//   - recommendedVoices: { female: [...], male: [...] } — IDs do
//                        pov-elevenlabs-voices.js (mín. 2 por gênero)
//   - audioTagsHint: array de strings — tags do Eleven v3 sugeridas
//                    (devem existir em ELEVENLABS_V3_AUDIO_TAGS)
//   - speechStyle: texto em INGLÊS pra orientar o Claude no
//                  pov-script.js sobre como a fala deve soar
//
// 🔁 Retrocompatibilidade: arquivo NOVO — nenhum consumidor importa ainda.
// PovWizard (C1) vai importar quando Step 9 for reformado. Backend
// pov-script.js (B) vai aceitar `intensityId` opcional, com fallback.
//
// Referência: 📋 Sessão 11/05/2026 — Plano consolidado v4 (Notion).

export const POV_INTENSITIES = [
  {
    id: 'comercial_limpo',
    name: 'Comercial limpo',
    emoji: '🎬',
    level: 1,
    vibe: 'Anúncio polido',
    description: 'Locutor controlado, articulação clara, sem emoção forte — vibe broadcast premium.',
    recommendedVoices: {
      female: ['Alice', 'Charlotte', 'Jessica'],
      male: ['George', 'Eric', 'Daniel'],
    },
    audioTagsHint: ['confident', 'slowly'],
    speechStyle: 'Polished commercial voice-over delivery with controlled pacing, neutral confident emotion, crisp articulation, broadcast quality. Smooth even cadence, no slang or hesitation, no reactions or filler words. The voice should feel like a professional ad spot.',
  },
  {
    id: 'influencer_natural',
    name: 'Influencer natural',
    emoji: '✨',
    level: 2,
    vibe: 'Creator profissional',
    description: 'Creator polido, articulação cuidada, energia controlada — vibe top creator.',
    recommendedVoices: {
      female: ['Jessica', 'Matilda', 'Alice'],
      male: ['Brian', 'Liam', 'Daniel'],
    },
    audioTagsHint: ['happy', 'confident'],
    speechStyle: 'Polished influencer delivery with warm friendly energy, careful articulation, controlled enthusiasm, conversational but produced. Some natural inflection on key words, occasional smile in the voice, no rough edges or sudden volume jumps. The voice should feel like a top creator on a sponsored post.',
  },
  {
    id: 'tiktok_casual',
    name: 'TikTok casual',
    emoji: '📱',
    level: 3,
    vibe: 'Vibe creator real',
    description: 'Conversacional, fluxo livre, 1-2 reações por take — vibe TikTok feed orgânico.',
    recommendedVoices: {
      female: ['Sarah', 'Matilda', 'Lily'],
      male: ['Brian', 'Will', 'Liam'],
    },
    audioTagsHint: ['happy', 'quickly', 'chuckles'],
    speechStyle: 'Real creator TikTok delivery: conversational and casual, broken sentences with natural pauses, occasional small reactions like "olha", "tipo", "mano", words emphasized naturally without screaming, energetic but not overproduced. The voice should feel like a real TikTok creator on a non-sponsored post talking to friends.',
  },
  {
    id: 'iphone_cru',
    name: 'iPhone cru',
    emoji: '📸',
    level: 4,
    vibe: 'Gravação caseira espontânea',
    description: 'Falando enquanto grava, sem ensaio, vibe primeira tomada caseira.',
    recommendedVoices: {
      female: ['Sarah', 'Aria', 'Lily'],
      male: ['Will', 'Brian'],
    },
    audioTagsHint: ['excited', 'quickly', 'gasps'],
    speechStyle: 'Spontaneous home-iPhone delivery: unrehearsed first-take feel, light verbal stumbling, mid-sentence corrections, genuine in-the-moment reactions ("nossa", "pera", "espera"), variable volume as if moving the phone around, candid moment vibe with zero polish. The voice should feel like someone recording on their phone without thinking.',
  },
  {
    id: 'amigo_empolgado',
    name: 'Amigo empolgado',
    emoji: '🤩',
    level: 5,
    vibe: 'Mostrando descoberta animada',
    description: 'Energia alta, "OLHA ISSO", reações entusiasmadas — vibe descoberta compartilhada.',
    recommendedVoices: {
      female: ['Aria', 'Lily', 'Sarah'],
      male: ['Will', 'Brian'],
    },
    audioTagsHint: ['excited', 'happy', 'gasps', 'laughs'],
    speechStyle: 'Enthusiastic-friend delivery: high energy excitement, lots of words in CAPS for emphasis ("CARA", "OLHA ISSO", "GENTE"), quick reactive pace, natural laughs and gasps sprinkled in, infectious sharing-a-discovery vibe. The voice should feel like a friend who just found something amazing and is texting you to come see.',
  },
  {
    id: 'noturna_calma',
    name: 'Rotina noturna calma',
    emoji: '🌙',
    level: 6,
    vibe: 'Soft, baixo, íntimo',
    description: 'Voz baixa, pausada, vibe ritual noturno — íntimo e calmo (ASMR-adjacent).',
    recommendedVoices: {
      female: ['Charlotte', 'Laura'],
      male: ['Bill', 'Brian'],
    },
    audioTagsHint: ['whispers', 'softly', 'slowly', 'sighs'],
    speechStyle: 'Calm-night-routine delivery: soft low volume close to a whisper, slow contemplative pacing with deliberate pauses, intimate close-to-microphone feel, occasional small sighs of contentment, ASMR-adjacent texture. The voice should feel like winding down at the end of the day, low-energy and self-care focused.',
  },
  {
    id: 'luxo_contemplativo',
    name: 'Luxo contemplativo',
    emoji: '💎',
    level: 7,
    vibe: 'Premium sofisticado',
    description: 'Pausado, sofisticado, palavras escolhidas — vibe revista de luxo.',
    recommendedVoices: {
      female: ['Charlotte', 'Laura'],
      male: ['Bill', 'Daniel'],
    },
    audioTagsHint: ['softly', 'slowly', 'confident'],
    speechStyle: 'Luxury-contemplative delivery: refined sophisticated pacing with deliberate dramatic pauses between phrases, premium magazine voice-over quality, low-mid volume with rich tonal depth, selective vocabulary, observational reverence for the product. The voice should feel like a high-end editorial narrating an object of desire.',
  },
  {
    id: 'hype_urgente',
    name: 'Hype urgente',
    emoji: '🚀',
    level: 8,
    vibe: 'Drop limitado, FOMO',
    description: 'Rápido, urgente, "CORRE ANTES QUE ACABE" — vibe drop hype.',
    recommendedVoices: {
      female: ['Aria', 'Lily'],
      male: ['Will', 'Eric'],
    },
    audioTagsHint: ['excited', 'quickly', 'shouting'],
    speechStyle: 'Hype-urgency delivery: fast rapid pace, urgent shouting energy on key phrases ("VAI ACABAR", "CORRE", "ÚLTIMA UNIDADE"), short staccato phrases, FOMO pressure with breath-skipping rhythm, viral drop atmosphere. The voice should feel like a streetwear drop reveal — urgent, exclusive, time-pressured.',
  },
  {
    id: 'recomendacao_confiavel',
    name: 'Recomendação confiável',
    emoji: '🤝',
    level: 9,
    vibe: 'Review honesto, eu testei',
    description: 'Sincero, ponderado, vibe consultora amiga — review honesto.',
    recommendedVoices: {
      female: ['Jessica', 'Matilda', 'Laura'],
      male: ['Brian', 'Liam', 'Daniel'],
    },
    audioTagsHint: ['confident', 'happy'],
    speechStyle: 'Trusted-recommendation delivery: honest balanced tone, measured confident pacing, conversational "I tested this and here is what I think" vibe, occasional softer reflective moments showing genuine thought, friend-giving-honest-advice atmosphere. The voice should feel like a knowledgeable friend who would not recommend something they did not actually use.',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

// Retorna a intensidade pelo id, ou null.
export function getIntensityById(id) {
  return POV_INTENSITIES.find((i) => i.id === id) || null;
}

// Retorna a intensidade por level (1-9), ou null.
export function getIntensityByLevel(level) {
  return POV_INTENSITIES.find((i) => i.level === level) || null;
}

// Lista todos os ids de intensidades (útil pra validação cruzada em
// pov-mappings.js e pra dropdowns no C1).
export function getAllIntensityIds() {
  return POV_INTENSITIES.map((i) => i.id);
}

// Retorna a lista de IDs de voz recomendados pra (intensidade, gênero).
// gender: 'female' | 'male' (default 'female').
// Retorna [] se a intensidade não existir ou o gênero não tiver vozes.
//
// Uso típico no PovWizard (C1):
//   const voices = getRecommendedVoiceIdsForIntensity(intensityId, influencerGender);
//   // mostra essas vozes em destaque no Step 9, demais ficam dimmed
export function getRecommendedVoiceIdsForIntensity(intensityId, gender = 'female') {
  const intensity = getIntensityById(intensityId);
  if (!intensity) return [];
  const key = gender === 'male' ? 'male' : 'female';
  return intensity.recommendedVoices?.[key] || [];
}

// Indica se um voiceId é recomendado pra determinada intensidade
// (independente de gênero). Útil pro PovWizard destacar visualmente
// vozes recomendadas no Step 9.
export function isVoiceRecommendedForIntensity(voiceId, intensityId) {
  const intensity = getIntensityById(intensityId);
  if (!intensity) return false;
  const f = intensity.recommendedVoices?.female || [];
  const m = intensity.recommendedVoices?.male || [];
  return f.includes(voiceId) || m.includes(voiceId);
}

// Retorna o audioTagsHint da intensidade (ou [] se id inválido).
// Usado pelo pov-script.js (Sub-lote B, arquivo 8) pra orientar o
// Claude na inserção de audio tags Eleven v3 dentro do script gerado.
export function getAudioTagsHintForIntensity(intensityId) {
  const intensity = getIntensityById(intensityId);
  return intensity?.audioTagsHint || [];
}

// Atalhos prontos pra UI — listas planas e ordenadas por level.
export const INTENSITIES_BY_LEVEL = [...POV_INTENSITIES].sort(
  (a, b) => a.level - b.level
);
