// src/data/ugc-veo-voices.js
//
// 30 vozes nativas do Veo 3 / Gemini TTS (lista oficial Google,
// confirmada via fal.ai e Google Cloud Vertex AI docs).
//
// Cada voz é nomeada com nome de estrela ou figura mitológica.
// Validado empiricamente em 01/05/2026: a mesma voz mantém consistência
// perfeita entre múltiplos takes (Descoberta 1 da arquitetura).
//
// Cada voz tem:
//   - id: nome oficial (passa direto pro Veo Studio: "Zephyr", "Kore", etc)
//   - name: igual ao id (mantido pra UI ficar simples)
//   - gender: 'female' | 'male' (estimado — algumas vozes não têm gênero
//     oficialmente documentado pelo Google; ouça antes de usar)
//   - tone: característica do tom (bright, firm, smooth, mature, etc)
//   - description: 1 linha em PT-BR pra UI
//   - confirmed: true se gênero/tom confirmados em fonte oficial,
//                false se estimado (Marcos pode ouvir e corrigir)
//
// MAPEAMENTO Estilo → Voz é DUPLO (F + M) pra suportar voz dinâmica:
//   ƒ(influencer × estilo) = voz_recomendada
// Se a influencer for F → usa VOICE_BY_STYLE_FEMALE
// Se a influencer for M → usa VOICE_BY_STYLE_MALE
//
// TODO (sessão futura): adicionar campo `gender` no ProfileManager.jsx
// pra que o recommendVoice possa diferenciar F/M automaticamente.
// Por enquanto, default = 'female' (caso real do Marcos hoje).

export const UGC_VEO_VOICES = [
  // ── 16 vozes femininas ───────────────────────────────────────────
  { id: 'Zephyr',       gender: 'female', tone: 'bright_warm',  description: 'Clara e calorosa, vibe conversa amigável.', confirmed: true },
  { id: 'Kore',         gender: 'female', tone: 'strong_firm',  description: 'Forte e firme, vibe autoridade.',           confirmed: true },
  { id: 'Aoede',        gender: 'female', tone: 'warm_melodic', description: 'Quente e melódica, vibe acolhedora.',       confirmed: true },
  { id: 'Callirrhoe',   gender: 'female', tone: 'easy_going',   description: 'Tranquila e leve, vibe descontraída.',      confirmed: true },
  { id: 'Despina',      gender: 'female', tone: 'smooth_breathy', description: 'Suave e sussurrada, vibe íntima.',         confirmed: true },
  { id: 'Pulcherrima',  gender: 'female', tone: 'clear',        description: 'Clara e neutra, vibe profissional.',        confirmed: true },
  { id: 'Autonoe',      gender: 'female', tone: 'bright_upbeat', description: 'Animada e brilhante, vibe energética.',     confirmed: false },
  { id: 'Laomedeia',    gender: 'female', tone: 'bright_upbeat', description: 'Vibrante e expressiva, vibe TikTok ativa.', confirmed: false },
  { id: 'Erinome',      gender: 'female', tone: 'firm_clear',   description: 'Firme e analítica, vibe explicação clara.', confirmed: false },
  { id: 'Leda',         gender: 'female', tone: 'youthful',     description: 'Jovem e fresca, vibe Geração Z.',           confirmed: false },
  { id: 'Gacrux',       gender: 'female', tone: 'mature',       description: 'Madura e experiente, vibe mãe sábia.',      confirmed: false },
  { id: 'Sulafat',      gender: 'female', tone: 'warm',         description: 'Calorosa e narrativa, vibe storytelling.',  confirmed: false },
  { id: 'Achernar',     gender: 'female', tone: 'bright',       description: 'Brilhante e clean, vibe pop fresh.',        confirmed: false },
  { id: 'Schedar',      gender: 'female', tone: 'mature',       description: 'Madura e refinada, vibe elegante.',         confirmed: false },
  { id: 'Vindemiatrix', gender: 'female', tone: 'mature_calm',  description: 'Madura e calma, vibe consultora confiável.', confirmed: false },
  { id: 'Sadachbia',    gender: 'female', tone: 'soft',         description: 'Suave e tranquila, vibe meditativa.',       confirmed: false },

  // ── 14 vozes masculinas ──────────────────────────────────────────
  { id: 'Charon',       gender: 'male',   tone: 'calm_professional', description: 'Calmo e profissional, vibe locutor.',   confirmed: true },
  { id: 'Puck',         gender: 'male',   tone: 'upbeat_lively', description: 'Animado e brincalhão, vibe descontraída.',  confirmed: true },
  { id: 'Fenrir',       gender: 'male',   tone: 'excitable',    description: 'Excitado e vibrante, vibe entusiasmado.',   confirmed: true },
  { id: 'Orus',         gender: 'male',   tone: 'firm_clear',   description: 'Firme e claro, vibe instrutor.',            confirmed: true },
  { id: 'Achird',       gender: 'male',   tone: 'warm',         description: 'Caloroso e suave, vibe amigo próximo.',     confirmed: true },
  { id: 'Alnilam',      gender: 'male',   tone: 'firm_clear',   description: 'Firme e analítico, vibe especialista.',     confirmed: true },
  { id: 'Iapetus',      gender: 'male',   tone: 'firm_clear',   description: 'Firme e narrativo, vibe documentário.',     confirmed: false },
  { id: 'Algieba',      gender: 'male',   tone: 'smooth',       description: 'Suave e contemplativo, vibe íntima.',       confirmed: false },
  { id: 'Algenib',      gender: 'male',   tone: 'firm',         description: 'Firme e sério, vibe autoritária.',          confirmed: false },
  { id: 'Enceladus',    gender: 'male',   tone: 'breathy_deep', description: 'Profundo e respirado, vibe misteriosa.',    confirmed: false },
  { id: 'Rasalgethi',   gender: 'male',   tone: 'informative',  description: 'Informativo e didático, vibe professor.',   confirmed: false },
  { id: 'Sadaltager',   gender: 'male',   tone: 'mature_deep',  description: 'Maduro e grave, vibe pai conselheiro.',     confirmed: false },
  { id: 'Umbriel',      gender: 'male',   tone: 'easy_going',   description: 'Tranquilo e relaxado, vibe casual.',        confirmed: false },
  { id: 'Zubenelgenubi',gender: 'male',   tone: 'mid_range',    description: 'Médio e versátil, vibe conversacional.',    confirmed: false },
];

// ── Mapeamento Estilo → Voz (default pra influencer FEMININA) ────────
//
// 11 mappings, cada um dos 11 estilos com sua voz F ideal.
// Critério: combinar a "vibe" do estilo com o "tone" da voz.

export const VOICE_BY_STYLE_FEMALE = {
  natural:         'Zephyr',     // bright_warm — conversa amigável
  autoridade:      'Kore',       // strong_firm — autoridade clara
  amigavel:        'Aoede',      // warm_melodic — acolhedora
  urgente:         'Laomedeia',  // bright_upbeat — urgência sem agressividade
  curioso:         'Autonoe',    // bright_upbeat — descobridora animada
  storytelling:    'Sulafat',    // warm — perfeita pra contar história
  comparacao:      'Erinome',    // firm_clear — analítica
  confissao:       'Despina',    // smooth_breathy — intimista, sussurrada
  alerta:          'Pulcherrima', // clear — alerta sem ser alarmista
  hack:            'Callirrhoe', // easy_going — dica casual
  custo_beneficio: 'Gacrux',     // mature — fala de valor com experiência
};

// ── Mapeamento Estilo → Voz (default pra influencer MASCULINA) ───────
//
// Espelha a lógica do mapeamento F. Pronto pro futuro quando o
// ProfileManager ganhar campo `gender`.

export const VOICE_BY_STYLE_MALE = {
  natural:         'Charon',      // calm_professional — locutor confiável
  autoridade:      'Orus',        // firm_clear — instrutor sério
  amigavel:        'Achird',      // warm — amigo próximo
  urgente:         'Puck',        // upbeat_lively — energia ativa
  curioso:         'Fenrir',      // excitable — descobridor entusiasmado
  storytelling:    'Iapetus',     // firm_clear — narrador documentário
  comparacao:      'Alnilam',     // firm_clear — especialista
  confissao:       'Algieba',     // smooth — contemplativo
  alerta:          'Rasalgethi',  // informative — alerta didático
  hack:            'Umbriel',     // easy_going — dica relaxada
  custo_beneficio: 'Sadaltager',  // mature_deep — conselheiro experiente
};

// ── Helpers ──────────────────────────────────────────────────────────

export function getVoiceById(id) {
  return UGC_VEO_VOICES.find((v) => v.id === id) || null;
}

export function getVoicesByGender(gender) {
  return UGC_VEO_VOICES.filter((v) => v.gender === gender);
}

// Pega o id da voz recomendada pra (estilo × gênero da influencer).
// Default gender = 'female' (caso atual do Marcos: todas as influencers F).
//
// Esta é a função núcleo que o endpoint /api/ugc-voice-recommend.js
// vai expor pro frontend chamar.
export function recommendVoiceId(styleId, gender = 'female') {
  const map = gender === 'male' ? VOICE_BY_STYLE_MALE : VOICE_BY_STYLE_FEMALE;
  return map[styleId] || map.natural; // fallback seguro
}

// Versão que retorna o objeto-voz completo (com tone, description, etc).
export function recommendVoice(styleId, gender = 'female') {
  return getVoiceById(recommendVoiceId(styleId, gender));
}

// Atalhos pra UI separar lista por gênero
export const VOICES_FEMALE = UGC_VEO_VOICES.filter((v) => v.gender === 'female');
export const VOICES_MALE = UGC_VEO_VOICES.filter((v) => v.gender === 'male');
