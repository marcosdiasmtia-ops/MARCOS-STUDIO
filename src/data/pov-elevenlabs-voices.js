// src/data/pov-elevenlabs-voices.js
//
// Vozes ElevenLabs curadas pra POV Studio em PT-BR.
// 15 vozes: 8 femininas + 7 masculinas, todas confirmadas na lista
// oficial do fal.ai.
//
// ✅ DESCOBERTA-CHAVE (10/05/2026):
// O fal.ai aceita o NOME da voz direto no campo `voice` do payload —
// NÃO precisa do hash voice_id (tipo "21m00Tcm4TlvDq8ikWAM").
// Schema oficial confirmado em:
//   https://fal.ai/models/fal-ai/elevenlabs/tts/multilingual-v2/api
// Exemplos de nomes aceitos pelo fal.ai (lista oficial):
//   "Aria", "Roger", "Sarah", "Laura", "Charlie", "George", "Callum",
//   "River", "Liam", "Charlotte", "Alice", "Matilda", "Will", "Jessica",
//   "Eric", "Chris", "Brian", "Daniel", "Lily", "Bill" + "Rachel" (default)
//
// As 15 vozes desta lista foram escolhidas dentre as 20 oficiais.
// 5 não escolhidas (espaço pra expansão futura): Rachel, Roger, Charlie,
// Callum, River, Chris.
//
// 🎙️ ENDPOINT ESCOLHIDO: ElevenLabs Eleven v3
//   - 70+ línguas (PT-BR estável)
//   - Audio tags inline pra dar emoção ([excited], [whispers], [softly]...)
//   - Limite 3.000 chars (sobra muito — POV 60s tem ~900 chars de fala)
//   - Mesma lista de vozes do Multilingual v2 funciona idêntica
//
// 🔄 Plano v4 (sessão 11/05/2026) — campo intensityProfile novo:
// Cada voz agora tem `intensityProfile: [...]` — array de IDs de
// intensidade do `./pov-intensities.js` em que aquela voz funciona bem.
// É o mapping REVERSO do `recommendedVoices` de POV_INTENSITIES.
// Útil pra UI do C1 (Step 9 reformado): quando o usuário escolhe uma
// intensidade, o PovWizard destaca as vozes cujo intensityProfile
// contém aquela intensidade, ficando outras dimmed.
//
// Cada voz tem:
//   - id: nome ElevenLabs (passa direto pro fal.ai como string)
//   - gender: 'female' | 'male'
//   - tone: característica do tom
//   - description: 1 linha em PT-BR pra UI
//   - confirmed: true (todas — listadas no schema oficial do fal.ai)
//   - intensityProfile: array de IDs de intensidade (NOVO no Plano v4)
//
// MAPEAMENTO Estilo → Voz é DUPLO (F + M) pra suportar voz dinâmica
// que herda do gênero da influencer cadastrada (modo padrão).
//
// Referência: 🎬 Arquitetura Aba POV (v1.0) no Notion · seção B3+B4.
//             📋 Sessão 11/05/2026 — Plano consolidado v4 (refine v4).

// ── Endpoint fal.ai escolhido ─────────────────────────────────────────

export const ELEVENLABS_FAL_ENDPOINT = 'fal-ai/elevenlabs/tts/eleven-v3';

// Endpoint alternativo caso v3 instabilize em produção (fallback fácil:
// trocar a string em pov-elevenlabs-tts.js que vai usar essa constante).
export const ELEVENLABS_FAL_ENDPOINT_FALLBACK = 'fal-ai/elevenlabs/tts/multilingual-v2';

// ── Audio tags suportadas pelo Eleven v3 ──────────────────────────────
//
// Use embutido no texto: "[excited] Gente, olha isso! [whispers] sério..."
// Claude (em pov-script.js, Sessão 2) vai inserir tags adequadas
// automaticamente baseado no estilo escolhido.

export const ELEVENLABS_V3_AUDIO_TAGS = {
  emotional: ['happy', 'sad', 'excited', 'angry', 'sarcastically', 'nervous', 'confident'],
  delivery:  ['whispers', 'shouting', 'slowly', 'quickly', 'softly'],
  nonVerbal: ['laughs', 'chuckles', 'sighs', 'gasps', 'coughs', 'gulps', 'applause'],
};

// ── 15 vozes (8F + 7M) ────────────────────────────────────────────────
//
// 🆕 intensityProfile: cada voz lista as intensidades de `pov-intensities.js`
// em que se encaixa bem (mapping derivado do `recommendedVoices` daquele
// arquivo). Ordem do array é por nível crescente, não por preferência.

export const POV_ELEVENLABS_VOICES = [
  // ── 8 vozes femininas ────────────────────────────────────────────
  {
    id: 'Sarah',
    gender: 'female',
    tone: 'youthful_warm',
    description: 'Jovem e calorosa, vibe Geração Z amigável.',
    confirmed: true,
    intensityProfile: ['tiktok_casual', 'iphone_cru', 'amigo_empolgado'],
  },
  {
    id: 'Aria',
    gender: 'female',
    tone: 'bright_vibrant',
    description: 'Vibrante e expressiva, vibe TikTok energética.',
    confirmed: true,
    intensityProfile: ['iphone_cru', 'amigo_empolgado', 'hype_urgente'],
  },
  {
    id: 'Charlotte',
    gender: 'female',
    tone: 'smooth_soft',
    description: 'Suave e refinada, vibe íntima elegante.',
    confirmed: true,
    intensityProfile: ['comercial_limpo', 'noturna_calma', 'luxo_contemplativo'],
  },
  {
    id: 'Alice',
    gender: 'female',
    tone: 'clear_neutral',
    description: 'Clara e neutra, vibe profissional confiável.',
    confirmed: true,
    intensityProfile: ['comercial_limpo', 'influencer_natural'],
  },
  {
    id: 'Matilda',
    gender: 'female',
    tone: 'warm_friendly',
    description: 'Calorosa e acolhedora, vibe conversa amigável.',
    confirmed: true,
    intensityProfile: ['influencer_natural', 'tiktok_casual', 'recomendacao_confiavel'],
  },
  {
    id: 'Lily',
    gender: 'female',
    tone: 'youthful_light',
    description: 'Leve e fresca, vibe pop jovem.',
    confirmed: true,
    intensityProfile: ['tiktok_casual', 'iphone_cru', 'amigo_empolgado', 'hype_urgente'],
  },
  {
    id: 'Jessica',
    gender: 'female',
    tone: 'mature_calm',
    description: 'Madura e calma, vibe consultora especialista.',
    confirmed: true,
    intensityProfile: ['comercial_limpo', 'influencer_natural', 'recomendacao_confiavel'],
  },
  {
    id: 'Laura',
    gender: 'female',
    tone: 'mature_warm',
    description: 'Madura e quente, vibe storytelling acolhedora.',
    confirmed: true,
    intensityProfile: ['noturna_calma', 'luxo_contemplativo', 'recomendacao_confiavel'],
  },

  // ── 7 vozes masculinas ───────────────────────────────────────────
  {
    id: 'Brian',
    gender: 'male',
    tone: 'warm_friendly',
    description: 'Caloroso e amigável, vibe conversa próxima.',
    confirmed: true,
    intensityProfile: ['influencer_natural', 'tiktok_casual', 'iphone_cru', 'amigo_empolgado', 'noturna_calma', 'recomendacao_confiavel'],
  },
  {
    id: 'George',
    gender: 'male',
    tone: 'firm_authority',
    description: 'Firme e autoritário, vibe especialista.',
    confirmed: true,
    intensityProfile: ['comercial_limpo'],
  },
  {
    id: 'Bill',
    gender: 'male',
    tone: 'deep_mature',
    description: 'Profundo e maduro, vibe documentário.',
    confirmed: true,
    intensityProfile: ['noturna_calma', 'luxo_contemplativo'],
  },
  {
    id: 'Will',
    gender: 'male',
    tone: 'youthful_clear',
    description: 'Jovem e claro, vibe vlog dinâmico.',
    confirmed: true,
    intensityProfile: ['tiktok_casual', 'iphone_cru', 'amigo_empolgado', 'hype_urgente'],
  },
  {
    id: 'Liam',
    gender: 'male',
    tone: 'mid_versatile',
    description: 'Médio e versátil, vibe conversacional neutra.',
    confirmed: true,
    intensityProfile: ['influencer_natural', 'tiktok_casual', 'recomendacao_confiavel'],
  },
  {
    id: 'Eric',
    gender: 'male',
    tone: 'clean_clear',
    description: 'Clean e direto, vibe locutor profissional.',
    confirmed: true,
    intensityProfile: ['comercial_limpo', 'hype_urgente'],
  },
  {
    id: 'Daniel',
    gender: 'male',
    tone: 'firm_clear',
    description: 'Firme e analítico, vibe instrutor explicativo.',
    confirmed: true,
    intensityProfile: ['comercial_limpo', 'influencer_natural', 'luxo_contemplativo', 'recomendacao_confiavel'],
  },
];

// ── Mapeamento Estilo → Voz default (FEMININO) ───────────────────────
//
// 8 mappings cobrindo cada estilo POV com voz F que combina com a vibe.
// Critério: combinar a "vibe" do estilo com o "tone" da voz.

export const VOICE_BY_STYLE_FEMALE = {
  textura_closeup:      'Charlotte', // smooth_soft — observacional íntimo
  design_acabamento:    'Alice',     // clear_neutral — editorial refinado
  detalhes_premium:     'Laura',     // mature_warm — luxo storytelling
  rotacao_360:          'Alice',     // clear_neutral — e-commerce limpo
  tamanho_real:         'Matilda',   // warm_friendly — casual relatable
  funcionalidade:       'Jessica',   // mature_calm — instrutora calma
  aplicacao:            'Aria',      // bright_vibrant — before/after expressivo
  revelacao_embalagem:  'Sarah',     // youthful_warm — anticipation jovem
};

// ── Mapeamento Estilo → Voz default (MASCULINO) ──────────────────────
//
// 8 mappings espelhados — mesma vibe por estilo, voz masculina equivalente.

export const VOICE_BY_STYLE_MALE = {
  textura_closeup:      'Eric',      // clean_clear — observacional preciso
  design_acabamento:    'Liam',      // mid_versatile — editorial neutro
  detalhes_premium:     'Bill',      // deep_mature — luxo gravidade
  rotacao_360:          'Eric',      // clean_clear — e-commerce limpo
  tamanho_real:         'Brian',     // warm_friendly — casual próximo
  funcionalidade:       'Daniel',    // firm_clear — instrutor analítico
  aplicacao:            'Will',      // youthful_clear — before/after dinâmico
  revelacao_embalagem:  'George',    // firm_authority — anticipation séria
};

// ── Helpers ──────────────────────────────────────────────────────────

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
// Útil em pov-script.js (Sessão 2) quando Claude inserir tags no script.

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

// ── Helpers NOVOS (Plano v4) ──────────────────────────────────────────

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
