// MARCOS-STUDIO v1.0 — Avatar IA — Etnias
// 10 etnias × suporte gramatical M/F.
// Cada `traits` usa vocabulário pró-realismo natural (Decisão #9, Alavanca 3).
// Referência visual: prints Trendly capturados em 08/05/2026.

export const ETHNICITIES = [
  {
    id: 'nordic',
    labelMale: 'Nórdico',
    labelFemale: 'Nórdica',
    description: 'Nordic European heritage',
    traits: 'fair complexion with subtle natural pinkish undertones, light eye color tendency (blue, green, or grey), naturally fine hair from blonde to light-brown, sharp facial structure with high cheekbones',
    previewMale: '/avatars/preview/ethnicities/nordic-m.png',
    previewFemale: '/avatars/preview/ethnicities/nordic-f.png',
  },
  {
    id: 'anglo-saxon',
    labelMale: 'Anglo-Saxão',
    labelFemale: 'Anglo-Saxã',
    description: 'Anglo-Saxon British heritage',
    traits: 'fair to medium complexion with natural skin variation, varied eye colors (blue, hazel, brown), brown to dark-blonde hair with subtle natural texture, balanced facial proportions',
    previewMale: '/avatars/preview/ethnicities/anglo-saxon-m.png',
    previewFemale: '/avatars/preview/ethnicities/anglo-saxon-f.png',
  },
  {
    id: 'germanic',
    labelMale: 'Germânico',
    labelFemale: 'Germânica',
    description: 'Germanic Central European heritage',
    traits: 'fair complexion with natural skin texture, blue or green eyes most common, blonde to light-brown hair with subtle natural variation, defined cheekbones and strong jawline',
    previewMale: '/avatars/preview/ethnicities/germanic-m.png',
    previewFemale: '/avatars/preview/ethnicities/germanic-f.png',
  },
  {
    id: 'slavic',
    labelMale: 'Eslavo',
    labelFemale: 'Eslava',
    description: 'Slavic Eastern European heritage',
    traits: 'fair complexion with subtle warmth, blue or green eyes very common, ash-blonde to medium-brown hair, slightly broad face with high cheekbones, soft natural features',
    previewMale: '/avatars/preview/ethnicities/slavic-m.png',
    previewFemale: '/avatars/preview/ethnicities/slavic-f.png',
  },
  {
    id: 'east-asian',
    labelMale: 'Leste Asiático',
    labelFemale: 'Leste Asiática',
    description: 'East Asian heritage',
    traits: 'East Asian features with naturally smooth skin, dark almond-shaped eyes with subtle epicanthic folds, naturally straight black to dark-brown hair, refined facial structure',
    previewMale: '/avatars/preview/ethnicities/east-asian-m.png',
    previewFemale: '/avatars/preview/ethnicities/east-asian-f.png',
  },
  {
    id: 'african',
    labelMale: 'Africano',
    labelFemale: 'Africana',
    description: 'African heritage',
    traits: 'African features with natural skin texture and subtle melanin variation, dark expressive eyes, naturally textured hair from coily to curly, full natural lips, broad nose bridge',
    previewMale: '/avatars/preview/ethnicities/african-m.png',
    previewFemale: '/avatars/preview/ethnicities/african-f.png',
  },
  {
    id: 'latino',
    labelMale: 'Latino',
    labelFemale: 'Latina',
    description: 'Latin American heritage',
    traits: 'warm olive to medium-tan skin with natural variation, dark expressive eyes commonly brown, naturally wavy dark-brown to black hair, expressive features with subtle asymmetry',
    previewMale: '/avatars/preview/ethnicities/latino-m.png',
    previewFemale: '/avatars/preview/ethnicities/latino-f.png',
  },
  {
    id: 'arab',
    labelMale: 'Árabe',
    labelFemale: 'Árabe',
    description: 'Arab Middle Eastern heritage',
    traits: 'olive to medium complexion with natural warmth, dark expressive eyes commonly brown, dark naturally wavy hair, defined nose bridge and prominent eyebrows, strong facial features',
    previewMale: '/avatars/preview/ethnicities/arab-m.png',
    previewFemale: '/avatars/preview/ethnicities/arab-f.png',
  },
  {
    id: 'indigenous',
    labelMale: 'Indígena',
    labelFemale: 'Indígena',
    description: 'Indigenous American heritage',
    traits: 'medium-tan to bronze skin with natural texture, dark almond eyes, naturally straight black hair, broader nose and high cheekbones, distinctive facial structure',
    previewMale: '/avatars/preview/ethnicities/indigenous-m.png',
    previewFemale: '/avatars/preview/ethnicities/indigenous-f.png',
  },
  {
    id: 'turkish',
    labelMale: 'Turco',
    labelFemale: 'Turca',
    description: 'Turkish Anatolian heritage',
    traits: 'olive to fair complexion with natural warmth, dark expressive eyes most common (brown, hazel), dark wavy hair, refined facial features with strong brow line',
    previewMale: '/avatars/preview/ethnicities/turkish-m.png',
    previewFemale: '/avatars/preview/ethnicities/turkish-f.png',
  },
];

// Helper: pega label conforme gênero gramatical correto
export function getEthnicityLabel(ethnicity, gender) {
  if (!ethnicity) return '';
  return gender === 'female' ? ethnicity.labelFemale : ethnicity.labelMale;
}

// Helper: pega ethnicity por id
export function getEthnicityById(id) {
  return ETHNICITIES.find((e) => e.id === id) || null;
}
