// src/data/pov-durations.js
//
// 4 durações de vídeo POV (Point of View) — múltiplos limpos de 10s.
// Cada duração = N takes de 10s gerados no Kling 2.6 Pro, concatenados
// sem transição via FFmpeg (cortes secos = vibe TikTok puro).
//
// SEM DEFAULT: o wizard começa em branco no passo 7 — usuário escolhe
// conscientemente. Confirmado pelo Marcos em 09/05/2026 (reduz risco
// de gerar vídeo de 60s por descuido, que custa 3× mais que 20s).
//
// CUSTO ATUAL (pipeline interno via fal.ai):
// - Nano Banana Pro (imagem-base): $0,05 por take (1 imagem por take)
// - Kling 2.6 Pro (vídeo): ~$1,05 por take de 10s
// - ElevenLabs v3 (TTS, modo Com voz): ~$0,06 fixo (independe da duração)
// - FFmpeg (composição): grátis (CPU server Vercel)
//
// QUANDO MUDAR: se preços do fal.ai mudarem, basta atualizar as constantes
// COST_* abaixo. Tudo recalcula sozinho.
//
// Referência: 🎬 Arquitetura Aba POV (v1.0) no Notion · 21 decisões fechadas.

// ── Custos unitários (em USD) ────────────────────────────────────────

export const COST_NANO_BANANA_PER_IMAGE = 0.05;
export const COST_KLING_PER_10S = 1.05;
export const COST_ELEVENLABS_TTS_FIXED = 0.06;

// Custo estimado por vídeo conforme N takes (modo Sem voz)
function costSilent(takes) {
  return takes * (COST_NANO_BANANA_PER_IMAGE + COST_KLING_PER_10S);
}

// Custo estimado por vídeo conforme N takes (modo Com voz)
function costVoiced(takes) {
  return costSilent(takes) + COST_ELEVENLABS_TTS_FIXED;
}

// ── 4 durações ──────────────────────────────────────────────────────

export const POV_DURATIONS = [
  {
    id: '20s',
    seconds: 20,
    takes: 2,
    composition: '2 × 10s',
    label: '20s',
    name: '20 segundos',
    description: '2 takes. Curto e ágil, ideal pra primeiro contato rápido com o produto.',
    estimatedCostSilent: costSilent(2),
    estimatedCostVoiced: costVoiced(2),
  },
  {
    id: '30s',
    seconds: 30,
    takes: 3,
    composition: '3 × 10s',
    label: '30s',
    name: '30 segundos',
    description: '3 takes. Sweet spot do TikTok pra a maioria dos vídeos de afiliação.',
    estimatedCostSilent: costSilent(3),
    estimatedCostVoiced: costVoiced(3),
  },
  {
    id: '40s',
    seconds: 40,
    takes: 4,
    composition: '4 × 10s',
    label: '40s',
    name: '40 segundos',
    description: '4 takes. Espaço pra contar mais — uso, detalhes e CTA com folga.',
    estimatedCostSilent: costSilent(4),
    estimatedCostVoiced: costVoiced(4),
  },
  {
    id: '60s',
    seconds: 60,
    takes: 6,
    composition: '6 × 10s',
    label: '60s',
    name: '60 segundos',
    description: '6 takes. Review completo, tipo unboxing detalhado ou storytelling longo.',
    estimatedCostSilent: costSilent(6),
    estimatedCostVoiced: costVoiced(6),
  },
];

// ── Distribuição de frases on-screen por duração ────────────────────
//
// Sugestão do Claude no passo "Frases on-screen" do wizard.
// Cada duração tem ranges (min/max) — Claude decide quantas exatamente
// baseado em produto, estilo e densidade de informação.
//
// Hook: sempre 1, nos primeiros 1-3s do TAKE 1 (captura mute viewer).
// Demonstração: opcionais, takes intermediários (reforça pontos visuais).
// CTA: sempre 1, nos últimos 2-3s do TAKE final (call-to-action).

export const ON_SCREEN_PHRASES_BY_DURATION = {
  '20s': {
    hook: 1,
    demonstration: { min: 0, max: 1 },
    cta: 1,
    total: { min: 2, max: 3 },
  },
  '30s': {
    hook: 1,
    demonstration: { min: 1, max: 1 },
    cta: 1,
    total: { min: 3, max: 3 },
  },
  '40s': {
    hook: 1,
    demonstration: { min: 1, max: 2 },
    cta: 1,
    total: { min: 3, max: 4 },
  },
  '60s': {
    hook: 1,
    demonstration: { min: 2, max: 3 },
    cta: 1,
    total: { min: 4, max: 5 },
  },
};

// ── Default ─────────────────────────────────────────────────────────
//
// Marcos confirmou em 09/05/2026: SEM DEFAULT. Wizard começa em branco,
// força o usuário a escolher conscientemente.

export const DEFAULT_DURATION_ID = null;

// ── Helpers ─────────────────────────────────────────────────────────

export function getDurationById(id) {
  return POV_DURATIONS.find((d) => d.id === id) || null;
}

export function getDurationByTakes(takes) {
  return POV_DURATIONS.find((d) => d.takes === takes) || null;
}

export function getDurationBySeconds(seconds) {
  return POV_DURATIONS.find((d) => d.seconds === seconds) || null;
}

// Pega a distribuição de frases on-screen pra uma duração.
// Retorna { hook, demonstration: {min, max}, cta, total: {min, max} } ou null.
export function getOnScreenDistribution(durationId) {
  return ON_SCREEN_PHRASES_BY_DURATION[durationId] || null;
}

// Pega o custo estimado em USD pra uma duração + modo de áudio.
// audioMode: 'silent' (Sem voz, default) ou 'voiced' (Com voz).
// Retorna número (ex: 2.20) ou null se durationId inválido.
export function getEstimatedCost(durationId, audioMode = 'silent') {
  const d = getDurationById(durationId);
  if (!d) return null;
  return audioMode === 'voiced' ? d.estimatedCostVoiced : d.estimatedCostSilent;
}

// Quantas frases on-screen no máximo pra uma duração (útil pra UI).
export function getMaxOnScreenPhrases(durationId) {
  const dist = getOnScreenDistribution(durationId);
  return dist ? dist.total.max : 0;
}

// Formata custo USD pra exibir na UI: "$2,20" (padrão BR) ou "Grátis" se zero.
export function formatCost(cost) {
  if (cost === null || cost === undefined) return '';
  if (cost === 0) return 'Grátis';
  return `$${cost.toFixed(2).replace('.', ',')}`;
}
