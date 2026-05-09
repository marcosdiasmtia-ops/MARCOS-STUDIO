// MARCOS-STUDIO v1.0 — Avatar IA — Tipos de Corpo
// 6 tipos com previews separadas por gênero (avatares 3D).
// Descrições em inglês usam vocabulário pró-realismo natural (Decisão #9).

export const BODY_TYPES = [
  {
    id: 'very-slim',
    labelMale: 'Mais magro',
    labelFemale: 'Mais magra',
    description: 'naturally slim build with lean limbs and visible bone structure at shoulders and collar',
    previewMale: '/avatars/preview/body/very-slim-m.png',
    previewFemale: '/avatars/preview/body/very-slim-f.png',
  },
  {
    id: 'slim',
    labelMale: 'Magro / leve',
    labelFemale: 'Magra / leve',
    description: 'slim athletic build with natural softness, lean proportions without excessive muscle definition',
    previewMale: '/avatars/preview/body/slim-m.png',
    previewFemale: '/avatars/preview/body/slim-f.png',
  },
  {
    id: 'medium',
    labelMale: 'Médio / equilibrado',
    labelFemale: 'Média / equilibrada',
    description: 'average balanced build with natural proportions, neither slim nor heavy, realistic everyday physique',
    previewMale: '/avatars/preview/body/medium-m.png',
    previewFemale: '/avatars/preview/body/medium-f.png',
  },
  {
    id: 'athletic',
    labelMale: 'Atlético',
    labelFemale: 'Atlética',
    description: 'athletic build with natural muscle definition, fit but not exaggerated, healthy active appearance',
    previewMale: '/avatars/preview/body/athletic-m.png',
    previewFemale: '/avatars/preview/body/athletic-f.png',
  },
  {
    id: 'curvy',
    labelMale: 'Cheinho / mais encorpado',
    labelFemale: 'Cheinha / mais encorpada',
    description: 'fuller curvier build with natural softness, healthy proportions with realistic body fat distribution',
    previewMale: '/avatars/preview/body/curvy-m.png',
    previewFemale: '/avatars/preview/body/curvy-f.png',
  },
  {
    id: 'heavier',
    labelMale: 'Acima do peso / maior',
    labelFemale: 'Acima do peso / maior',
    description: 'heavier fuller build with realistic body proportions, soft natural body shape, authentic everyday physique',
    previewMale: '/avatars/preview/body/heavier-m.png',
    previewFemale: '/avatars/preview/body/heavier-f.png',
  },
];

export function getBodyTypeLabel(bodyType, gender) {
  if (!bodyType) return '';
  return gender === 'female' ? bodyType.labelFemale : bodyType.labelMale;
}

export function getBodyTypeById(id) {
  return BODY_TYPES.find((b) => b.id === id) || null;
}
