// MARCOS-STUDIO v1.0 — Avatar IA — Tipos de Lábios
// 4 opções (sem swatch — preview é foto).
// Descrições em inglês com vocabulário pró-realismo natural (Decisão #9).

export const LIPS = [
  {
    id: 'thin',
    label: 'Finos',
    description: 'naturally thin lips with subtle definition, realistic lip texture and natural color',
  },
  {
    id: 'medium',
    label: 'Médios',
    description: 'medium-sized natural lips with balanced upper and lower fullness, realistic texture',
  },
  {
    id: 'full',
    label: 'Carnudos',
    description: 'naturally full lips with soft definition, realistic lip texture and slight asymmetry',
  },
  {
    id: 'very-full',
    label: 'Muito carnudos',
    description: 'naturally very full plump lips with prominent shape, realistic texture and natural lip lines',
  },
];

export function getLipsById(id) {
  return LIPS.find((l) => l.id === id) || null;
}
