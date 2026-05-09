// MARCOS-STUDIO v1.0 — Avatar IA — Tons de Pele
// 9 níveis baseados na escala Fitzpatrick.
// `hex` = swatch CSS (Decisão #5: 29 swatches = código, custo zero).
// `description` em inglês com vocabulário pró-realismo (Decisão #9).

export const SKIN_TONES = [
  {
    id: 'tone-1',
    label: 'Muito clara',
    fitzpatrick: 'I',
    hex: '#F5DCC4',
    description: 'very fair complexion with subtle natural pinkish undertones, sensitive skin appearance, visible delicate skin texture',
  },
  {
    id: 'tone-2',
    label: 'Clara',
    fitzpatrick: 'II',
    hex: '#EBC9A6',
    description: 'fair complexion with natural warm undertones, visible pores at close range, natural skin texture',
  },
  {
    id: 'tone-3',
    label: 'Clara/Média',
    fitzpatrick: 'III',
    hex: '#DDB089',
    description: 'fair-to-medium complexion with natural warm-beige undertones, even natural skin tone with subtle variation',
  },
  {
    id: 'tone-4',
    label: 'Média',
    fitzpatrick: 'IV',
    hex: '#C99670',
    description: 'medium complexion with golden-tan undertones, naturally even skin with subtle micro-imperfections',
  },
  {
    id: 'tone-5',
    label: 'Média (Oliva)',
    fitzpatrick: 'IV',
    hex: '#B07854',
    description: 'medium-olive complexion with warm undertones, healthy natural skin appearance with subtle variation',
  },
  {
    id: 'tone-6',
    label: 'Média-Escura (Caramelo)',
    fitzpatrick: 'V',
    hex: '#8E5A3B',
    description: 'medium-dark caramel complexion with rich warm undertones, naturally textured skin with healthy glow',
  },
  {
    id: 'tone-7',
    label: 'Escura',
    fitzpatrick: 'V',
    hex: '#6E4129',
    description: 'dark complexion with rich brown undertones, natural skin texture with subtle highlights',
  },
  {
    id: 'tone-8',
    label: 'Muito Escura',
    fitzpatrick: 'VI',
    hex: '#4F2D1B',
    description: 'very dark complexion with deep brown undertones, naturally radiant skin with rich texture',
  },
  {
    id: 'tone-9',
    label: 'Profundamente Escura',
    fitzpatrick: 'VI',
    hex: '#341E12',
    description: 'deep dark complexion with rich ebony undertones, beautifully textured skin with natural sheen',
  },
];

export function getSkinToneById(id) {
  return SKIN_TONES.find((t) => t.id === id) || null;
}
