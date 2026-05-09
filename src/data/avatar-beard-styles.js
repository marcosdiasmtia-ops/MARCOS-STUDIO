// MARCOS-STUDIO v1.0 — Avatar IA — Estilos de Barba
// 5 estilos APENAS para gênero Masculino.
// O wizard suprime esse campo quando gênero=female (validação #9 — gênero gramatical).
// Descrições em inglês com vocabulário pró-realismo natural (Decisão #9).

export const BEARD_STYLES = [
  {
    id: 'none',
    label: 'Sem barba',
    description: 'clean-shaven face with natural skin texture, realistic 5-o-clock-shadow possible at close range',
    preview: '/avatars/preview/beard/none.png',
  },
  {
    id: 'stubble',
    label: 'Barba por fazer',
    description: 'short stubble with realistic individual hair texture, naturally uneven growth, 2-3 day shadow',
    preview: '/avatars/preview/beard/stubble.png',
  },
  {
    id: 'full',
    label: 'Barba cheia',
    description: 'full natural beard with realistic individual strand variation, well-groomed but not overly polished',
    preview: '/avatars/preview/beard/full.png',
  },
  {
    id: 'goatee',
    label: 'Cavanhaque',
    description: 'goatee centered on chin with clean-shaven cheeks, naturally trimmed with realistic hair texture',
    preview: '/avatars/preview/beard/goatee.png',
  },
  {
    id: 'mustache',
    label: 'Bigode',
    description: 'mustache only with clean-shaven cheeks and chin, naturally groomed with realistic hair detail',
    preview: '/avatars/preview/beard/mustache.png',
  },
];

export function getBeardStyleById(id) {
  return BEARD_STYLES.find((b) => b.id === id) || null;
}
