// MARCOS-STUDIO v1.0 — Avatar IA — Cor dos Olhos
// 12 cores com swatch hex (Decisão #5).
// Descrições em inglês com vocabulário pró-realismo natural (Decisão #9).

export const EYE_COLORS = [
  {
    id: 'blue',
    label: 'Azul',
    hex: '#3D5A80',
    description: 'natural blue eyes with subtle iris variation, realistic specular highlights',
  },
  {
    id: 'light-blue',
    label: 'Azul Claro',
    hex: '#7EAACC',
    description: 'natural light-blue eyes with delicate iris pattern, realistic depth',
  },
  {
    id: 'green',
    label: 'Verde',
    hex: '#3F6B43',
    description: 'natural green eyes with subtle hazel flecks, realistic iris texture',
  },
  {
    id: 'light-green',
    label: 'Verde Claro',
    hex: '#7BAB7E',
    description: 'natural light-green eyes with golden inner ring, realistic iris detail',
  },
  {
    id: 'light-brown',
    label: 'Castanho Claro',
    hex: '#8C6239',
    description: 'natural light-brown eyes with warm honey flecks, realistic iris pattern',
  },
  {
    id: 'dark-brown',
    label: 'Castanho Escuro',
    hex: '#3E2415',
    description: 'natural dark-brown eyes with deep iris texture, subtle warm undertones',
  },
  {
    id: 'gray',
    label: 'Cinza',
    hex: '#7A7E84',
    description: 'natural grey eyes with subtle steel-blue undertones, realistic iris depth',
  },
  {
    id: 'black',
    label: 'Preto',
    hex: '#1C1614',
    description: 'naturally very dark brown eyes appearing nearly black, deep iris detail',
  },
  {
    id: 'honey',
    label: 'Mel',
    hex: '#B58A3D',
    description: 'natural honey-colored eyes with golden-amber tones, warm realistic iris',
  },
  {
    id: 'amber',
    label: 'Âmbar',
    hex: '#C77B2A',
    description: 'natural amber eyes with rich golden-orange tones, distinctive realistic iris',
  },
  {
    id: 'red',
    label: 'Vermelho',
    hex: '#8B2B2B',
    description: 'rare reddish-brown eyes (unusual but real albinism variant), distinctive appearance',
  },
  {
    id: 'white',
    label: 'Branco',
    hex: '#D9D9D9',
    description: 'pale icy-blue eyes appearing nearly colorless, distinctive uncommon look',
  },
];

export function getEyeColorById(id) {
  return EYE_COLORS.find((e) => e.id === id) || null;
}
