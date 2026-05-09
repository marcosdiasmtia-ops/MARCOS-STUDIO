// MARCOS-STUDIO v1.0 — Avatar IA — Acessórios (Etapa 6/7)
// Óculos: binário (com / sem)
// Piercings: opcional, multi-select (5 opções), pode ser nenhum
// Descrições em inglês com vocabulário pró-realismo natural (Decisão #9).

export const GLASSES_OPTIONS = [
  {
    id: 'with',
    label: 'Com óculos',
    description: 'wearing realistic everyday eyeglasses with subtle frame, natural lens reflections',
  },
  {
    id: 'without',
    label: 'Sem óculos',
    description: 'no eyewear, natural unobstructed eyes',
  },
];

export const PIERCINGS = [
  {
    id: 'septum',
    label: 'Septo',
    description: 'small septum piercing on nose center, realistic minimal jewelry',
    preview: '/avatars/preview/piercings/septum.png',
  },
  {
    id: 'nostril',
    label: 'Nostril',
    description: 'small nostril piercing on one side, realistic discrete stud or hoop',
    preview: '/avatars/preview/piercings/nostril.png',
  },
  {
    id: 'eyebrow',
    label: 'Eyebrow piercing',
    description: 'subtle eyebrow piercing with small barbell, realistic placement',
    preview: '/avatars/preview/piercings/eyebrow.png',
  },
  {
    id: 'labret',
    label: 'Labret',
    description: 'labret piercing below lower lip, realistic small stud, natural placement',
    preview: '/avatars/preview/piercings/labret.png',
  },
  {
    id: 'lobe',
    label: 'Lóbulo',
    description: 'classic earlobe piercings with realistic small studs, natural everyday style',
    preview: '/avatars/preview/piercings/lobe.png',
  },
];

export function getPiercingById(id) {
  return PIERCINGS.find((p) => p.id === id) || null;
}

// Helper: descrição combinada de N piercings selecionados
export function describePiercings(piercingIds) {
  if (!piercingIds || piercingIds.length === 0) return null;
  const items = PIERCINGS.filter((p) => piercingIds.includes(p.id));
  if (items.length === 0) return null;
  return items.map((p) => p.description).join('; ');
}
