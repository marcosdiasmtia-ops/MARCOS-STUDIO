// MARCOS-STUDIO v1.0 — Avatar IA — Cortes de Cabelo
// 6 cortes masculinos + 6 cortes femininos (listas separadas).
// Wizard mostra a lista correta conforme gênero selecionado na Etapa 1.
// Descrições em inglês com vocabulário pró-realismo natural (Decisão #9).

export const HAIR_STYLES_MALE = [
  {
    id: 'buzzcut',
    label: 'Buzzcut (raspado clean)',
    description: 'very short buzzcut with clean even length, visible scalp texture, realistic short hair',
    preview: '/avatars/preview/hair-male/buzzcut.png',
  },
  {
    id: 'short-rounded',
    label: 'Curto arredondado',
    description: 'short rounded haircut with natural soft texture, clean but not styled, realistic everyday cut',
    preview: '/avatars/preview/hair-male/short-rounded.png',
  },
  {
    id: 'social-grand',
    label: 'Corte social grande',
    description: 'classic social haircut with longer top and shorter sides, naturally styled with subtle volume',
    preview: '/avatars/preview/hair-male/social-grand.png',
  },
  {
    id: 'side-part',
    label: 'Side part minimalista',
    description: 'minimalist side-part haircut with clean precise parting, naturally styled with realistic texture',
    preview: '/avatars/preview/hair-male/side-part.png',
  },
  {
    id: 'wavy-compact',
    label: 'Ondulado compacto',
    description: 'compact wavy haircut with natural texture and subtle movement, realistic everyday styling',
    preview: '/avatars/preview/hair-male/wavy-compact.png',
  },
  {
    id: 'low-fade-curly',
    label: 'Low fade cacheado',
    description: 'low-fade haircut with naturally curly top, defined fade transition, realistic curl pattern',
    preview: '/avatars/preview/hair-male/low-fade-curly.png',
  },
];

export const HAIR_STYLES_FEMALE = [
  {
    id: 'short-bob',
    label: 'Bob curto (clássico)',
    description: 'classic short bob cut at jawline, natural soft texture with subtle movement, realistic styling',
    preview: '/avatars/preview/hair-female/short-bob.png',
  },
  {
    id: 'long-straight-minimal',
    label: 'Longo liso minimalista',
    description: 'long straight minimalist hairstyle with natural sheen, realistic strand texture, subtle imperfections',
    preview: '/avatars/preview/hair-female/long-straight-minimal.png',
  },
  {
    id: 'long-volume',
    label: 'Longo com volume',
    description: 'long voluminous hair with natural body and subtle wave, realistic texture and movement',
    preview: '/avatars/preview/hair-female/long-volume.png',
  },
  {
    id: 'high-bun',
    label: 'Coque alto (bun)',
    description: 'high bun hairstyle with naturally pulled-back hair, subtle flyaways, realistic everyday styling',
    preview: '/avatars/preview/hair-female/high-bun.png',
  },
  {
    id: 'low-ponytail',
    label: 'Rabo de cavalo baixo',
    description: 'low ponytail with naturally smooth top and subtle flyaways, realistic casual styling',
    preview: '/avatars/preview/hair-female/low-ponytail.png',
  },
  {
    id: 'medium-wavy',
    label: 'Ondulado médio',
    description: 'medium-length naturally wavy hair with realistic curl pattern, soft texture, everyday styling',
    preview: '/avatars/preview/hair-female/medium-wavy.png',
  },
];

// Helper: pega lista correta conforme gênero
export function getHairStylesForGender(gender) {
  return gender === 'female' ? HAIR_STYLES_FEMALE : HAIR_STYLES_MALE;
}

// Helper: busca por id em qualquer lista
export function getHairStyleById(id) {
  return (
    HAIR_STYLES_MALE.find((h) => h.id === id) ||
    HAIR_STYLES_FEMALE.find((h) => h.id === id) ||
    null
  );
}
