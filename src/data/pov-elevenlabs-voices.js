// src/data/pov-elevenlabs-voices.js
//
// Vozes ElevenLabs v3 (multilingual) curadas pra POV Studio em PT-BR.
//
// ⚠️ STATUS: PLACEHOLDER ESTRUTURAL — VALIDAR NA SESSÃO 2 (BACKEND)
// ════════════════════════════════════════════════════════════════════
// ElevenLabs tem 10.000+ vozes na biblioteca pública. Esta lista contém
// 15 vozes-âncora oficiais (default ElevenLabs) com nomes públicos
// conhecidos. PORÉM:
//   - Os `id` aqui usam o NOME público da voz, não o voice_id real
//     da API (que é um hash tipo "21m00Tcm4TlvDq8ikWAM").
//   - Os tone/description são estimativas baseadas na documentação
//     pública — confirmar empiricamente ouvindo prévias no fal.ai.
//
// AÇÃO PENDENTE NA SESSÃO 2 (backend):
//   1. Acessar https://fal.ai/models/fal-ai/elevenlabs-tts-multilingual-v2
//      ou https://elevenlabs.io/docs/api-reference/voices
//   2. Pegar os voice_id REAIS de cada voz aqui listada
//   3. Trocar campo `id` (nome) por `voiceId` (hash da API)
//   4. Manter `name` separado pro UI ler
//   5. Expandir lista pra 40-60 vozes (decisão #B4 da Arquitetura)
//   6. Marcar `confirmed: true` quando ouvir e validar PT-BR
// ════════════════════════════════════════════════════════════════════
//
// Cada voz tem (estrutura final pós-Sessão 2):
//   - id: hoje = nome ElevenLabs · futuro = voice_id da API
//   - name: nome público da voz pra UI (Sarah, Brian, Charlotte...)
//   - gender: 'female' | 'male'
//   - tone: característica do tom (warm, firm, smooth, mature...)
//   - description: 1 linha em PT-BR pra UI
//   - confirmed: false (todas hoje) — true quando validar empiricamente
//
// MAPEAMENTO Estilo → Voz é DUPLO (F + M) pra suportar voz dinâmica
// que herda do gênero da influencer cadastrada (modo padrão).
//
// Referência: 🎬 Arquitetura Aba POV (v1.0) no Notion · seção B4.

export const POV_ELEVENLABS_VOICES = [
  // ── 8 vozes femininas ────────────────────────────────────────────
  { id: 'Sarah',     gender: 'female', tone: 'youthful_warm',  description: 'Jovem e calorosa, vibe Geração Z amigável.',     confirmed: false },
  { id: 'Aria',      gender: 'female', tone: 'bright_vibrant', description: 'Vibrante e expressiva, vibe TikTok energética.', confirmed: false },
  { id: 'Charlotte', gender: 'female', tone: 'smooth_soft',    description: 'Suave e refinada, vibe íntima elegante.',        confirmed: false },
  { id: 'Alice',     gender: 'female', tone: 'clear_neutral',  description: 'Clara e neutra, vibe profissional confiável.',   confirmed: false },
  { id: 'Matilda',   gender: 'female', tone: 'warm_friendly',  description: 'Calorosa e acolhedora, vibe conversa amigável.', confirmed: false },
  { id: 'Lily',      gender: 'female', tone: 'youthful_light', description: 'Leve e fresca, vibe pop jovem.',                 confirmed: false },
  { id: 'Jessica',   gender: 'female', tone: 'mature_calm',    description: 'Madura e calma, vibe consultora especialista.',  confirmed: false },
  { id: 'Laura',     gender: 'female', tone: 'mature_warm',    description: 'Madura e quente, vibe storytelling acolhedora.', confirmed: false },

  // ── 7 vozes masculinas ───────────────────────────────────────────
  { id: 'Brian',     gender: 'male',   tone: 'warm_friendly',  description: 'Caloroso e amigável, vibe conversa próxima.',    confirmed: false },
  { id: 'George',    gender: 'male',   tone: 'firm_authority', description: 'Firme e autoritário, vibe especialista.',        confirmed: false },
  { id: 'Bill',      gender: 'male',   tone: 'deep_mature',    description: 'Profundo e maduro, vibe documentário.',          confirmed: false },
  { id: 'Will',      gender: 'male',   tone: 'youthful_clear', description: 'Jovem e claro, vibe vlog dinâmico.',             confirmed: false },
  { id: 'Liam',      gender: 'male',   tone: 'mid_versatile',  description: 'Médio e versátil, vibe conversacional neutra.',  confirmed: false },
  { id: 'Eric',      gender: 'male',   tone: 'clean_clear',    description: 'Clean e direto, vibe locutor profissional.',     confirmed: false },
  { id: 'Daniel',    gender: 'male',   tone: 'firm_clear',     description: 'Firme e analítico, vibe instrutor explicativo.', confirmed: false },
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
//
// Indicador visual no wizard: "voz placeholder, validar empíricamente"
// vai sumir quando todas as vozes tiverem confirmed: true (Sessão 2).
export function getConfirmedVoicesCount() {
  return POV_ELEVENLABS_VOICES.filter((v) => v.confirmed).length;
}

export function areAllVoicesConfirmed() {
  return POV_ELEVENLABS_VOICES.every((v) => v.confirmed);
}
