// src/data/pov-durations.js (v2.0 — Kling v3 Standard 15s/take)
//
// CHANGELOG v2.0 (18/05/2026):
//   🆕 REFORMULA AS 4 DURAÇÕES pra alinhar com Kling v3 Standard 15s/take.
//
//   Antes (Kling 2.6 Pro 10s/take):  Agora (Kling v3 Standard 15s/take):
//   ─────────────────────────────    ────────────────────────────────────
//   '20s'  = 2 takes × 10s            '15s'  = 1 take  × 15s   (NOVO id)
//   '30s'  = 3 takes × 10s            '30s'  = 2 takes × 15s   (mesma duração total)
//   '40s'  = 4 takes × 10s            '45s'  = 3 takes × 15s   (NOVO id)
//   '60s'  = 6 takes × 10s            '60s'  = 4 takes × 15s   (mesma duração total)
//
//   🆕 CUSTOS RECALCULADOS — Kling v3 Standard cobra $0.084/s (era $0.07/s
//      no 2.6 Pro), então $0.084 × 15s = $1.26 por take (era $0.70 por
//      take de 10s). Aumento por POV: +16% a +30% no total.
//
//   📌 RETROCOMPAT da galeria:
//      POVs antigos salvos no localStorage com durationId='20s' ou '40s'
//      vão dar `.find() === undefined` e exibir "—" no label. POVs com
//      durationId='30s' ou '60s' continuam exibindo (mesma duração total),
//      mas o campo `composition` vai aparecer com a nova representação
//      (2×15s, 4×15s) em vez da histórica (3×10s, 6×10s). Nada quebra
//      funcionalmente — só visual mínimo em itens da galeria pré-v2.0.
//
//   📌 Motivo da migração:
//      Slot de 10s do Kling 2.6 Pro era pequeno demais pras vozes BR
//      migradas em 13/05 (PT-BR fala ~50% mais devagar que vozes anglo
//      do core). Áudios estouravam o slot e o FFmpeg compose estendia o
//      vídeo congelando o último frame — gerando 7-10s de freeze frame
//      no final. Slot de 15s comporta 35-45 palavras PT-BR confortavelmente.
//
// CHANGELOG v1.0 (09/05/2026):
//   4 durações de vídeo POV (Point of View) — múltiplos limpos de 10s.
//   Cada duração = N takes de 10s gerados no Kling 2.6 Pro, concatenados
//   sem transição via FFmpeg (cortes secos = vibe TikTok puro).
//
// SEM DEFAULT: o wizard começa em branco no passo 7 — usuário escolhe
// conscientemente. Confirmado pelo Marcos em 09/05/2026 (reduz risco
// de gerar vídeo de 60s por descuido, que custa 3-4× mais que 15-30s).
//
// CUSTO ATUAL (pipeline interno via fal.ai):
// - Nano Banana Pro (imagem-base): $0,05 por take (1 imagem por take)
// - Kling v3 Standard (vídeo):     $1,26 por take de 15s (era $0,70 no 2.6 Pro 10s)
// - ElevenLabs v3 (TTS, modo voiced): ~$0,06 fixo (independe da duração)
// - FFmpeg (composição):           grátis (CPU server Vercel)
//
// QUANDO MUDAR: se preços do fal.ai mudarem, basta atualizar as constantes
// COST_* abaixo. Tudo recalcula sozinho.
//
// Referência: 🎬 Arquitetura Aba POV (v2.0) no Notion + Sessão 18/05/2026.

// ── Custos unitários (em USD) ────────────────────────────────────────

export const COST_NANO_BANANA_PER_IMAGE = 0.05;

// v2.0 (18/05/2026): renomeado de COST_KLING_PER_10S (era 1.05).
// Kling v3 Standard cobra $0.084/s × 15s = $1.26 por take.
export const COST_KLING_PER_15S = 1.26;

export const COST_ELEVENLABS_TTS_FIXED = 0.06;

// Custo estimado por vídeo conforme N takes (modo Sem voz)
function costSilent(takes) {
  return takes * (COST_NANO_BANANA_PER_IMAGE + COST_KLING_PER_15S);
}

// Custo estimado por vídeo conforme N takes (modo Com voz)
function costVoiced(takes) {
  return costSilent(takes) + COST_ELEVENLABS_TTS_FIXED;
}

// ── 4 durações ──────────────────────────────────────────────────────

export const POV_DURATIONS = [
  {
    id: '15s',
    seconds: 15,
    takes: 1,
    composition: '1 × 15s',
    label: '15s',
    name: '15 segundos',
    description: 'Take único de 15s. Teaser ultra-curto, hook + CTA num só take. Ideal pra produtos que vendem só de ver.',
    estimatedCostSilent: costSilent(1),
    estimatedCostVoiced: costVoiced(1),
  },
  {
    id: '30s',
    seconds: 30,
    takes: 2,
    composition: '2 × 15s',
    label: '30s',
    name: '30 segundos',
    description: '2 takes. Curto e ágil, hook + CTA bem separados. Bom pra primeiro contato rápido com o produto.',
    estimatedCostSilent: costSilent(2),
    estimatedCostVoiced: costVoiced(2),
  },
  {
    id: '45s',
    seconds: 45,
    takes: 3,
    composition: '3 × 15s',
    label: '45s',
    name: '45 segundos',
    description: '3 takes. Sweet spot do TikTok: hook + demo + CTA com folga. Maioria dos vídeos de afiliação cabe aqui.',
    estimatedCostSilent: costSilent(3),
    estimatedCostVoiced: costVoiced(3),
  },
  {
    id: '60s',
    seconds: 60,
    takes: 4,
    composition: '4 × 15s',
    label: '60s',
    name: '60 segundos',
    description: '4 takes. Espaço pra contar mais — uso, detalhes, comparação e CTA com folga. Tipo unboxing ou storytelling.',
    estimatedCostSilent: costSilent(4),
    estimatedCostVoiced: costVoiced(4),
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
//
// v2.0: ajustado pros novos ids ('15s', '45s' novos; '30s', '60s' mantidos
// mas com nº de takes diferente).

export const ON_SCREEN_PHRASES_BY_DURATION = {
  '15s': {
    hook: 1,
    demonstration: { min: 0, max: 0 }, // 1 take só — sem espaço pra demo
    cta: 1,
    total: { min: 1, max: 2 },
  },
  '30s': {
    hook: 1,
    demonstration: { min: 0, max: 1 },
    cta: 1,
    total: { min: 2, max: 3 },
  },
  '45s': {
    hook: 1,
    demonstration: { min: 1, max: 1 },
    cta: 1,
    total: { min: 3, max: 3 },
  },
  '60s': {
    hook: 1,
    demonstration: { min: 1, max: 2 },
    cta: 1,
    total: { min: 3, max: 4 },
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
// Retorna número (ex: 2.68) ou null se durationId inválido.
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

// Formata custo USD pra exibir na UI: "$2,68" (padrão BR) ou "Grátis" se zero.
export function formatCost(cost) {
  if (cost === null || cost === undefined) return '';
  if (cost === 0) return 'Grátis';
  return `$${cost.toFixed(2).replace('.', ',')}`;
}
