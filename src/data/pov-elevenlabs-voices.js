// src/data/pov-elevenlabs-voices.js (v2.0 — Opção C: 13 vozes BR nativas via voice_id hash)
//
// CHANGELOG v2.0 (13/05/2026 — Opção C, Sub-passo 4 — INTERRUPTOR FINAL):
//   🆕 As 15 vozes anglo do core ElevenLabs (Sarah, Aria, Brian, etc.) foram
//      SUBSTITUÍDAS pelas 13 vozes BR nativas selecionadas pelo Marcos na
//      Voice Library do ElevenLabs. Cada voz BR tem sotaque brasileiro
//      autêntico (a maioria neutro paulistano + 1 nordestina + 1 com
//      sotaque interior SP + 1 idoso rural).
//   🆕 Cada voz agora tem campo `name` (display amigável pra UI — ex:
//      "Raquel") em adição ao `id` (que agora é o voice_id hash de 20
//      caracteres do ElevenLabs — ex: "GDzHdQOi6jjf8zaXhCYD"). A UI
//      (PovWizard v2.1 + PovGallery v1.1) usa `v.name || v.id`.
//   🆕 Campos opcionais novos: `accent` (regionalismo declarado) +
//      `perpetual` (vozes com licença perpétua, não expiram).
//   🆕 Endpoint NÃO MUDOU — continua Eleven v3. Decisão validada com
//      Marcos: manter audio tags (`[excited]`, `[whispers]`, etc.) que
//      são parte central do refine v4 do roteiro.
//
//   🔁 Retrocompat: assinaturas dos exports (POV_ELEVENLABS_VOICES,
//      VOICES_FEMALE, VOICES_MALE, VOICE_BY_STYLE_FEMALE,
//      VOICE_BY_STYLE_MALE, getVoiceById, getVoicesByGender,
//      getDefaultVoiceForStyle, getAllVoiceIds, voiceMatchesIntensity,
//      getVoicesByIntensity, ELEVENLABS_FAL_ENDPOINT, ELEVENLABS_V3_AUDIO_TAGS,
//      etc.) são 100% mantidas. Quem importa não muda nada.
//
//   ⚠️ Galeria local (localStorage) com POVs gerados antes desta migração
//      pode mostrar `voiceId` antigo (nome anglo tipo "Sarah"). O fallback
//      `getVoiceById(id)?.name || id` faz a galeria exibir o id direto
//      nesses casos (comportamento aceitável — POV antigo ainda visível).
//
// CHANGELOG v1.0 (10/05/2026 — POV Sub-lote A):
//   Definição inicial com 15 vozes anglo do core ElevenLabs.
//
// ──────────────────────────────────────────────────────────────────────
// CONTEXTO
// ──────────────────────────────────────────────────────────────────────
//
// Vozes ElevenLabs curadas pra POV Studio em PT-BR.
//
// 🎙️ ENDPOINT: ElevenLabs Eleven v3 via fal.ai
//   - fal-ai/elevenlabs/tts/eleven-v3
//   - 70+ línguas (PT estável)
//   - Audio tags inline pra dar emoção ([excited], [whispers], [softly]...)
//   - Limite 3.000 chars (sobra muito — POV 60s tem ~900 chars de fala)
//   - Aceita tanto NOME curto quanto voice_id HASH no campo `voice`
//
// 🔑 voice_id HASHES vêm da Voice Library do ElevenLabs (vozes BR nativas
// criadas por cloners profissionais brasileiros, com sotaque autêntico).
// Pra ouvir cada uma: elevenlabs.io/app/voice-library + busca pelo nome.

// ── Endpoint fal.ai escolhido ─────────────────────────────────────────

export const ELEVENLABS_FAL_ENDPOINT = 'fal-ai/elevenlabs/tts/eleven-v3';

// Endpoint alternativo caso v3 instabilize em produção (fallback fácil:
// trocar a string em pov-elevenlabs-tts.js que vai usar essa constante).
// Importante: trocar pra multilingual-v2 perde os audio tags inline.
export const ELEVENLABS_FAL_ENDPOINT_FALLBACK = 'fal-ai/elevenlabs/tts/multilingual-v2';

// ── Audio tags suportadas pelo Eleven v3 ──────────────────────────────
//
// Use embutido no texto: "[excited] Gente, olha isso! [whispers] sério..."
// Claude (em pov-script.js) insere tags adequadas automaticamente baseado
// na intensidade escolhida.

export const ELEVENLABS_V3_AUDIO_TAGS = {
  emotional: ['happy', 'sad', 'excited', 'angry', 'sarcastically', 'nervous', 'confident'],
  delivery:  ['whispers', 'shouting', 'slowly', 'quickly', 'softly'],
  nonVerbal: ['laughs', 'chuckles', 'sighs', 'gasps', 'coughs', 'gulps', 'applause'],
};

// ──────────────────────────────────────────────────────────────────────
// IDs das vozes BR (Voice Library ElevenLabs) — pra legibilidade nos mappings
// ──────────────────────────────────────────────────────────────────────

// Femininas (7)
const RAQUEL_ID         = 'GDzHdQOi6jjf8zaXhCYD'; // jovem energética/forte/calorosa
const PAULA_ID          = 'xPnmQf6Ow3GGYWWURFPi'; // jovem suave/contemplativa
const ROBERTA_ID        = 'RGymW84CSmfVugnA5tvA'; // jovem amigável/calorosa
const JENIFER_ID        = 'GOkMqfyKMLVUcYfO2WbB'; // jovem natural sotaque interior SP
const MULHER_ADULTA_ID  = 'gX4eTo1XOTTALJXnDro4'; // madura fluida storytelling
const FERNANDA_ID       = 'KHmfNHtEjHhLK9eER20w'; // clara profissional acolhedora
const MARIANA_ID        = 'tZ2oxQJXfOrGrN7iKnta'; // enérgica ensolarada (perpétua)

// Masculinas (6)
const JOSE_ID           = 'aU2vcrnwi348Gnc2Y1si'; // idoso rural SP, nicho personagem
const EDUARDO_ID        = '83Nae6GFQiNslSbuzmE7'; // firme nordestino (Alagoas)
const LUCKE_ID          = 'NQ10OlqJ7vYH6XwegHSW'; // direto neutro conversacional (perpétua)
const MARCIO_ID         = 'Zk0wRqIFBWGMu2lIk7hw'; // cativante persuasivo comercial
const YURI_ID           = '3Je7qW9yPOhc47iG41pH'; // jovem casual amigável caloroso
const MATHEUS_ID        = 'xWdpADtEio43ew1zGxUQ'; // jovem 28a amigável calmo

// ──────────────────────────────────────────────────────────────────────
// 13 VOZES BR NATIVAS
// ──────────────────────────────────────────────────────────────────────

export const POV_ELEVENLABS_VOICES = [
  // ── 7 FEMININAS ────────────────────────────────────────────────────
  {
    id: RAQUEL_ID,
    name: 'Raquel',
    gender: 'female',
    tone: 'energetic_warm',
    description: 'Jovem brasileira forte, calorosa e expressiva — vibe Gen Z conversa próxima.',
    confirmed: true,
    intensityProfile: ['iphone_cru', 'amigo_empolgado', 'hype_urgente', 'tiktok_casual'],
  },
  {
    id: PAULA_ID,
    name: 'Paula',
    gender: 'female',
    tone: 'smooth_soft',
    description: 'Jovem suave e contemplativa — perfeita pra conversas íntimas e narração.',
    confirmed: true,
    intensityProfile: ['comercial_limpo', 'noturna_calma', 'luxo_contemplativo'],
  },
  {
    id: ROBERTA_ID,
    name: 'Roberta',
    gender: 'female',
    tone: 'warm_friendly',
    description: 'Jovem amigável e calorosa — vibe creator pop conversacional.',
    confirmed: true,
    intensityProfile: ['influencer_natural', 'tiktok_casual', 'recomendacao_confiavel'],
  },
  {
    id: JENIFER_ID,
    name: 'Jenifer',
    gender: 'female',
    tone: 'natural_regional',
    description: 'Voz natural do interior de SP com sotaque e personalidade — autenticidade caipira jovem.',
    confirmed: true,
    accent: 'interior_SP',
    intensityProfile: ['iphone_cru', 'tiktok_casual', 'amigo_empolgado'],
  },
  {
    id: MULHER_ADULTA_ID,
    name: 'Mulher brasileira adulta',
    gender: 'female',
    tone: 'mature_warm',
    description: 'Madura, tom médio fluido caloroso e convidativo — vibe storytelling consultora.',
    confirmed: true,
    intensityProfile: ['noturna_calma', 'luxo_contemplativo', 'recomendacao_confiavel'],
  },
  {
    id: FERNANDA_ID,
    name: 'Fernanda',
    gender: 'female',
    tone: 'clear_professional',
    description: 'Voz clara, acolhedora e profissional — equilíbrio raro entre proximidade e elegância.',
    confirmed: true,
    intensityProfile: ['comercial_limpo', 'influencer_natural', 'recomendacao_confiavel'],
  },
  {
    id: MARIANA_ID,
    name: 'Mariana',
    gender: 'female',
    tone: 'bright_vibrant',
    description: 'Enérgica e ensolarada, inflexões otimistas — vibe storytelling upbeat brilhante.',
    confirmed: true,
    perpetual: true,
    intensityProfile: ['iphone_cru', 'amigo_empolgado', 'hype_urgente', 'tiktok_casual'],
  },

  // ── 6 MASCULINAS ───────────────────────────────────────────────────
  {
    id: JOSE_ID,
    name: 'José',
    gender: 'male',
    tone: 'elderly_rural',
    description: 'Idoso brasileiro com sotaque caipira do interior SP — vibe personagem storytelling rural.',
    confirmed: true,
    accent: 'rural_SP',
    intensityProfile: ['noturna_calma', 'luxo_contemplativo'],
  },
  {
    id: EDUARDO_ID,
    name: 'Eduardo Monteiro',
    gender: 'male',
    tone: 'firm_confident',
    description: 'Brasileiro nordestino (Alagoas), confiante e firme — vibe especialista instrutor.',
    confirmed: true,
    accent: 'nordestino',
    intensityProfile: ['comercial_limpo', 'influencer_natural', 'recomendacao_confiavel'],
  },
  {
    id: LUCKE_ID,
    name: 'Lucke',
    gender: 'male',
    tone: 'mid_neutral',
    description: 'Voz masculina de meia-idade, direta e neutra — funciona bem pra conversas.',
    confirmed: true,
    perpetual: true,
    intensityProfile: ['influencer_natural', 'tiktok_casual', 'recomendacao_confiavel'],
  },
  {
    id: MARCIO_ID,
    name: 'Marcio',
    gender: 'male',
    tone: 'rich_captivating',
    description: 'Tom rico e envolvente com toque de calor — autoritário e cativante, perfeito pra comerciais.',
    confirmed: true,
    intensityProfile: ['comercial_limpo', 'recomendacao_confiavel', 'luxo_contemplativo'],
  },
  {
    id: YURI_ID,
    name: 'Yuri',
    gender: 'male',
    tone: 'warm_friendly',
    description: 'Jovem adulto casual, amigável e caloroso — vibe conversa de amigo próximo.',
    confirmed: true,
    intensityProfile: ['influencer_natural', 'tiktok_casual', 'iphone_cru', 'amigo_empolgado'],
  },
  {
    id: MATHEUS_ID,
    name: 'Matheus Santos',
    gender: 'male',
    tone: 'youthful_calm',
    description: 'Brasileiro 28 anos jovem adulto, amigável e calmo — perfeito pra produção de conteúdo.',
    confirmed: true,
    intensityProfile: ['tiktok_casual', 'iphone_cru', 'influencer_natural', 'recomendacao_confiavel'],
  },
];

// ──────────────────────────────────────────────────────────────────────
// Mapeamento Estilo POV → Voz default (FEMININO)
// ──────────────────────────────────────────────────────────────────────
//
// 8 mappings cobrindo cada estilo POV com voz F que combina com a vibe.
// Critério: combinar a "vibe" do estilo com o "tone" da voz.
//
// Jenifer (natural_regional) fica fora dos mappings default — disponível
// pra escolha manual quando produto/POV pedir vibe regional/autêntica.

export const VOICE_BY_STYLE_FEMALE = {
  textura_closeup:      PAULA_ID,         // smooth_soft → observacional íntimo
  design_acabamento:    FERNANDA_ID,      // clear_professional → editorial refinado
  detalhes_premium:     MULHER_ADULTA_ID, // mature_warm → luxo storytelling
  rotacao_360:          FERNANDA_ID,      // clear_professional → e-commerce limpo
  tamanho_real:         ROBERTA_ID,       // warm_friendly → casual relatable
  funcionalidade:       FERNANDA_ID,      // clear_professional → instrutora confiável
  aplicacao:            MARIANA_ID,       // bright_vibrant → before/after expressivo
  revelacao_embalagem:  RAQUEL_ID,        // energetic_warm → anticipation jovem
};

// ──────────────────────────────────────────────────────────────────────
// Mapeamento Estilo POV → Voz default (MASCULINO)
// ──────────────────────────────────────────────────────────────────────
//
// 8 mappings espelhados — mesma vibe por estilo, voz masculina equivalente.
//
// José (elderly_rural) fica fora dos mappings default — disponível pra
// escolha manual em POVs de produtos rurais/tradicionais/storytelling.

export const VOICE_BY_STYLE_MALE = {
  textura_closeup:      LUCKE_ID,    // mid_neutral → observacional preciso
  design_acabamento:    LUCKE_ID,    // mid_neutral → editorial neutro
  detalhes_premium:     MARCIO_ID,   // rich_captivating → luxo gravidade
  rotacao_360:          LUCKE_ID,    // mid_neutral → e-commerce limpo
  tamanho_real:         YURI_ID,     // warm_friendly → casual próximo
  funcionalidade:       EDUARDO_ID,  // firm_confident → instrutor analítico
  aplicacao:            MATHEUS_ID,  // youthful_calm → before/after dinâmico
  revelacao_embalagem:  MARCIO_ID,   // rich_captivating → anticipation séria
};

// ──────────────────────────────────────────────────────────────────────
// Helpers (assinaturas IDÊNTICAS à v1.0 — quem importa não muda nada)
// ──────────────────────────────────────────────────────────────────────

export function getVoiceById(id) {
  return POV_ELEVENLABS_VOICES.find((v) => v.id === id) || null;
}

export function getVoicesByGender(gender) {
  return POV_ELEVENLABS_VOICES.filter((v) => v.gender === gender);
}

// Pega a voz default pra (estilo, gênero da influencer).
// Retorna o objeto-voz completo ou null se não houver mapping.
export function getDefaultVoiceForStyle(styleId, gender = 'female') {
  const map = gender === 'male' ? VOICE_BY_STYLE_MALE : VOICE_BY_STYLE_FEMALE;
  const voiceId = map[styleId];
  return voiceId ? getVoiceById(voiceId) : null;
}

// Atalhos prontos pra UI
export const VOICES_FEMALE = POV_ELEVENLABS_VOICES.filter((v) => v.gender === 'female');
export const VOICES_MALE = POV_ELEVENLABS_VOICES.filter((v) => v.gender === 'male');

// Lista todos os ids (útil pra validação cruzada)
export function getAllVoiceIds() {
  return POV_ELEVENLABS_VOICES.map((v) => v.id);
}

// ── Status pra UI ────────────────────────────────────────────────────

export function getConfirmedVoicesCount() {
  return POV_ELEVENLABS_VOICES.filter((v) => v.confirmed).length;
}

export function areAllVoicesConfirmed() {
  return POV_ELEVENLABS_VOICES.every((v) => v.confirmed);
}

// ── Helper de tags pro Eleven v3 ─────────────────────────────────────
//
// Valida se uma tag específica é suportada antes de inserir no texto.
// Útil em pov-script.js quando Claude inserir tags no script.

export function isValidV3AudioTag(tag) {
  const allTags = [
    ...ELEVENLABS_V3_AUDIO_TAGS.emotional,
    ...ELEVENLABS_V3_AUDIO_TAGS.delivery,
    ...ELEVENLABS_V3_AUDIO_TAGS.nonVerbal,
  ];
  return allTags.includes(tag);
}

// Lista todas as tags disponíveis (flat) — útil pra mostrar na UI
// e pra Claude saber quais tags pode usar no script.
export function getAllV3AudioTags() {
  return [
    ...ELEVENLABS_V3_AUDIO_TAGS.emotional,
    ...ELEVENLABS_V3_AUDIO_TAGS.delivery,
    ...ELEVENLABS_V3_AUDIO_TAGS.nonVerbal,
  ];
}

// ──────────────────────────────────────────────────────────────────────
// Helpers de intensidade (mantidos do Plano v4)
// ──────────────────────────────────────────────────────────────────────

// Retorna todas as vozes cujo `intensityProfile` contém o intensityId.
// Útil pro PovWizard destacar vozes recomendadas no Step 9 quando o
// usuário escolhe uma intensidade.
// Aceita gender opcional pra filtrar adicional ('female' | 'male').
export function getVoicesByIntensity(intensityId, gender = null) {
  return POV_ELEVENLABS_VOICES.filter((v) => {
    if (!v.intensityProfile?.includes(intensityId)) return false;
    if (gender && v.gender !== gender) return false;
    return true;
  });
}

// Indica se determinada voz tem a intensidade no seu profile.
// Atalho semântico pra "essa voz funciona bem nessa intensidade?"
export function voiceMatchesIntensity(voiceId, intensityId) {
  const voice = getVoiceById(voiceId);
  return !!voice?.intensityProfile?.includes(intensityId);
}
