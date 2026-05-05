// src/data/ugc-durations.js
//
// 5 durações de vídeo UGC Falante (mesmas do Trendly).
// Cada duração = N takes de 8s gerados no Veo 3 frame-to-video,
// concatenados sem transição no CapCut (costura invisível conforme
// validado empiricamente em 01/05/2026).
//
// CUSTO ATUAL (pipeline manual):
// Marcos paga Gemini Advanced/Ultra mensal → Veo 3 está INCLUSO na
// assinatura, custo marginal por geração = $0. Único custo por vídeo
// é o Nano Banana Pro pra gerar o frame inicial (1 imagem, ~$0,05).
//
// QUANDO MUDAR (fase 2):
// Se migrar pra pipeline automático interno via fal.ai, basta atualizar
// COST_VEO3_PER_8S abaixo. Tudo recalcula sozinho.

// ── Custos unitários (em USD) ────────────────────────────────────────
export const COST_NANO_BANANA_PER_IMAGE = 0.05;
export const COST_VEO3_PER_8S = 0; // 0 enquanto Gemini Ultra mensal cobre

// Custo fixo por vídeo (independente da duração no pipeline manual atual)
function costForDuration(takes) {
  return COST_NANO_BANANA_PER_IMAGE + takes * COST_VEO3_PER_8S;
}

// ── 5 durações ───────────────────────────────────────────────────────

export const UGC_DURATIONS = [
  {
    id: '8s',
    seconds: 8,
    takes: 1,
    label: '8s',
    name: '8 segundos',
    description: '1 take. Mais direto, ideal pra urgência.',
    estimatedCost: costForDuration(1),
  },
  {
    id: '16s',
    seconds: 16,
    takes: 2,
    label: '16s',
    name: '16 segundos',
    description: '2 takes. Sweet spot do TikTok pra a maioria dos vídeos.',
    estimatedCost: costForDuration(2),
  },
  {
    id: '24s',
    seconds: 24,
    takes: 3,
    label: '24s',
    name: '24 segundos',
    description: '3 takes. Espaço pra demonstrar e fechar com CTA.',
    estimatedCost: costForDuration(3),
  },
  {
    id: '32s',
    seconds: 32,
    takes: 4,
    label: '32s',
    name: '32 segundos',
    description: '4 takes. Pra quando precisa explicar mais a fundo.',
    estimatedCost: costForDuration(4),
  },
  {
    id: '40s',
    seconds: 40,
    takes: 5,
    label: '40s',
    name: '40 segundos',
    description: '5 takes. Limite máximo, ideal pra storytelling completo.',
    estimatedCost: costForDuration(5),
  },
];

// ── Mapeamento Estilo → Duração ideal (11 mapeamentos) ───────────────
//
// Cada estilo aponta pra a duração default. UI pré-seleciona quando o
// usuário escolhe o estilo, mas pode ser sobrescrito.
//
// Distribuição: 8s (1) · 16s (5) · 24s (3) · 32s (1) · 40s (1)
// 16s domina porque é o sweet spot do TikTok.

export const DURATION_BY_STYLE = {
  natural:         '24s', // conversa precisa de espaço
  autoridade:      '32s', // especialista explica em detalhe
  amigavel:        '16s', // vibe rápida e alegre
  urgente:         '8s',  // direto ao ponto, "compre agora"
  curioso:         '16s', // descoberta rápida
  storytelling:    '40s', // arco narrativo completo
  comparacao:      '24s', // mostrar 2 lados leva tempo
  confissao:       '16s', // segredo curto e intrigante
  alerta:          '16s', // aviso direto e claro
  hack:            '16s', // demonstração rápida do truque
  custo_beneficio: '24s', // mostrar valor recebido vs preço
};

// ── Helpers ──────────────────────────────────────────────────────────

export function getDurationById(id) {
  return UGC_DURATIONS.find((d) => d.id === id) || null;
}

// Pega o id da duração default pra um estilo. Fallback: '16s' (sweet spot).
export function getDefaultDurationIdForStyle(styleId) {
  return DURATION_BY_STYLE[styleId] || '16s';
}

// Pega o objeto-duração default pra um estilo (com seconds, takes, cost...)
export function getDefaultDurationForStyle(styleId) {
  return getDurationById(getDefaultDurationIdForStyle(styleId));
}

// Formata o custo pra exibir na UI: "$0,05" (BR) ou "Grátis" se zero.
export function formatCost(cost) {
  if (cost === 0) return 'Grátis';
  return `$${cost.toFixed(2).replace('.', ',')}`;
}
