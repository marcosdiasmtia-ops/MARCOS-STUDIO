// src/data/ugc-realism.js
//
// 9 níveis de realismo pra aba UGC Falante (v3.0).
//
// Escala vai do MAIS POLIDO (1 = cinematográfico) ao MAIS CRU
// (9 = livestream). Cada nível controla o "look & feel" do vídeo:
// iluminação, gradação de cor, grão, qualidade de câmera percebida, etc.
//
// Cada nível tem:
//   - id: slug em snake_case
//   - name: nome em PT-BR pra UI
//   - description: frase curta pra UI (1 linha)
//   - realismPrompt: texto em INGLÊS pro bloco [VISUAL REALISM] do
//                    prompt do Veo 3
//   - intensity: nº 1-9 (útil pra UI tipo slider ou ordenação)
//   - vibe: palavra-chave curta
//   - bestFor: exemplos PT-BR de quando usar
//
// SWEET SPOT default: 'standard_ugc' (intensity 5) — onde o TikTok mais converte.

export const UGC_REALISM_LEVELS = [
  {
    id: 'cinematic_film',
    name: 'Cinematográfico',
    description: 'Filme, grão de película, gradação rica de cor.',
    realismPrompt: 'Cinematic film aesthetic with rich color grading, slight film grain, shallow depth of field, professional cinematography lighting, 24fps motion blur.',
    intensity: 1,
    vibe: 'filme',
    bestFor: 'Storytelling, lifestyle premium, marcas de luxo.',
  },
  {
    id: 'studio_pro',
    name: 'Estúdio profissional',
    description: 'Iluminação controlada, equipamento broadcast.',
    realismPrompt: 'Professional studio production with controlled three-point lighting (softbox key light, fill, rim), neutral clean background, sharp focus, broadcast-quality clarity.',
    intensity: 2,
    vibe: 'broadcast',
    bestFor: 'Skincare premium, autoridade, conteúdo educativo.',
  },
  {
    id: 'influencer_high_end',
    name: 'Influencer top',
    description: 'Ringlight, smartphone 4K, edição sutil.',
    realismPrompt: 'High-end influencer aesthetic: ring light setup with even soft illumination, 4K modern smartphone camera, subtle natural color grading, well-composed framing.',
    intensity: 3,
    vibe: 'influencer pro',
    bestFor: 'Maquiagem, beleza top, lifestyle aspiracional.',
  },
  {
    id: 'polished_ugc',
    name: 'UGC polido',
    description: 'Boa luz natural, smartphone moderno, composição limpa.',
    realismPrompt: 'Polished UGC content: good natural daylight, modern smartphone camera, slight color enhancement, clean balanced composition, no heavy filters.',
    intensity: 4,
    vibe: 'arrumadinho',
    bestFor: 'Moda casual, decoração, conteúdo do dia.',
  },
  {
    id: 'standard_ugc',
    name: 'UGC padrão',
    description: 'Smartphone típico, sem filtros, vibe TikTok comum.',
    realismPrompt: 'Standard everyday UGC look: typical smartphone camera, natural mixed lighting, no filters or color correction, casual but presentable framing, authentic mid-range quality.',
    intensity: 5,
    vibe: 'TikTok comum',
    bestFor: 'Sweet spot — funciona pra QUASE TUDO. Default seguro.',
  },
  {
    id: 'casual_smartphone',
    name: 'Smartphone casual',
    description: 'Mão livre, leve movimento, sem preparação.',
    realismPrompt: 'Casual smartphone capture: handheld with slight natural movement, average everyday lighting, no professional treatment, spontaneous and unpolished feel.',
    intensity: 6,
    vibe: 'espontâneo',
    bestFor: 'Confissão, hack rápido, casual day.',
  },
  {
    id: 'raw_authentic',
    name: 'Autêntico cru',
    description: 'Sem filtros, pele real, conversa direta.',
    realismPrompt: 'Raw authentic look: completely unfiltered, no color correction, natural skin tones with imperfections visible, conversational handheld feel, very real and unstaged.',
    intensity: 7,
    vibe: 'real real',
    bestFor: 'Confissão, alerta sério, "verdade nua".',
  },
  {
    id: 'vintage_lo_fi',
    name: 'Vintage lo-fi',
    description: 'Vibe Y2K, câmera antiga, cores desbotadas.',
    realismPrompt: 'Vintage lo-fi aesthetic: slight VHS-style softness, faded and slightly desaturated colors, mild film grain, early 2000s smartphone or camcorder quality.',
    intensity: 8,
    vibe: 'Y2K',
    bestFor: 'Storytelling nostálgico, "lembra quando...", produtos retrô.',
  },
  {
    id: 'livestream_vibe',
    name: 'Vibe livestream',
    description: 'Imediato, ao vivo, leves desfoques de câmera.',
    realismPrompt: 'Live streaming aesthetic: immediate handheld feel, occasional slight motion blur, natural lighting as-is without correction, minor focus shifts typical of real-time recording.',
    intensity: 9,
    vibe: 'ao vivo',
    bestFor: 'Urgente, alerta, lançamento "tô avisando agora".',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

export function getRealismById(id) {
  return UGC_REALISM_LEVELS.find((r) => r.id === id) || null;
}

export function getRealismByIntensity(intensity) {
  return UGC_REALISM_LEVELS.find((r) => r.intensity === intensity) || null;
}

// Default sugerido — sweet spot do TikTok onde a maioria dos vídeos UGC
// performam melhor. Pode ser sobrescrito pelo usuário no wizard.
export const DEFAULT_REALISM_ID = 'standard_ugc';

export function getDefaultRealism() {
  return getRealismById(DEFAULT_REALISM_ID);
}

// Lista ordenada por intensidade (1 → 9). Útil pra UI tipo slider.
export const UGC_REALISM_LEVELS_ORDERED = [...UGC_REALISM_LEVELS].sort(
  (a, b) => a.intensity - b.intensity
);
