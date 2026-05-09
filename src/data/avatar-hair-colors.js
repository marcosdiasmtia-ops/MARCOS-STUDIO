// MARCOS-STUDIO v1.0 — Avatar IA — Cor do Cabelo
// 8 cores com swatch hex (Decisão #5).
// Descrições em inglês com vocabulário pró-realismo natural (Decisão #9).

export const HAIR_COLORS = [
  {
    id: 'black',
    label: 'Preto',
    hex: '#1A1414',
    description: 'natural black hair with subtle blue-undertone sheen, realistic strand variation',
  },
  {
    id: 'dark-brown',
    label: 'Castanho escuro',
    hex: '#3B251A',
    description: 'natural dark-brown hair with subtle warm highlights, realistic individual strand color variation',
  },
  {
    id: 'brown',
    label: 'Castanho',
    hex: '#5C3A21',
    description: 'natural medium-brown hair with subtle natural highlights, realistic strand-by-strand variation',
  },
  {
    id: 'light-brown',
    label: 'Castanho claro',
    hex: '#8B5A2B',
    description: 'natural light-brown hair with golden warm undertones, realistic natural highlights',
  },
  {
    id: 'red',
    label: 'Ruivo',
    hex: '#A5421D',
    description: 'natural red hair with copper-orange tones, realistic individual strand variation, freckle-friendly tone',
  },
  {
    id: 'dark-blonde',
    label: 'Loiro escuro',
    hex: '#9B7A47',
    description: 'natural dark-blonde hair with subtle warm honey undertones, realistic strand variation',
  },
  {
    id: 'blonde',
    label: 'Loiro',
    hex: '#D4B27A',
    description: 'natural blonde hair with subtle golden tones and realistic strand variation, lived-in look',
  },
  {
    id: 'gray',
    label: 'Grisalho',
    hex: '#A8A6A3',
    description: 'naturally grey hair with mixed silver-and-darker strands, realistic salt-and-pepper variation',
  },
];

export function getHairColorById(id) {
  return HAIR_COLORS.find((h) => h.id === id) || null;
}
