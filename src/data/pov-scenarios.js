// src/data/pov-scenarios.js
//
// 15 micro-cenários próprios da aba POV — diferentes dos cenários da aba
// UGC Falante (./ugc-scenarios.js) porque POV é micro-cenário de superfície
// close-up, enquanto UGC Falante é ambiente macro com pessoa visível.
//
// POV foca em superfícies e backgrounds que valorizam o produto e dão
// vibe TikTok Shop autêntica. Iluminação cinematográfica + textura visível.
//
// 4 grupos:
//   - beauty (3): superfícies neutras com luz suave pra produtos de beleza
//   - work (3): superfícies tech/escritório pra produtos profissionais
//   - lifestyle (5): superfícies casuais de casa/dia-a-dia
//   - special (4): superfícies criativas pra produtos que pedem mood
//
// Cada cenário tem:
//   - id: slug em snake_case
//   - name: nome em PT-BR pra UI
//   - emoji: emoji representativo
//   - group: id do grupo macro
//   - description: 1 frase curta pra UI
//   - scenarioPrompt: texto em INGLÊS pro prompt do Kling 2.6 Pro
//                     (descreve superfície, iluminação, atmosfera, NÃO o produto)
//   - bestFor: exemplos PT-BR de produtos típicos
//
// Mapeamento Tipo → Cenário ideal fica em ./pov-mappings.js.
// "Personalizado" (textarea livre) é tratado na UI, não como item da lista.
//
// Referência: 🎬 Arquitetura Aba POV (v1.0) no Notion · seção C3.

export const POV_SCENARIOS = [
  // ── 💄 Beleza (3) ────────────────────────────────────────────────────
  {
    id: 'bancada_marmore',
    name: 'Bancada de mármore',
    emoji: '🪨',
    group: 'beauty',
    description: 'Bancada branca de mármore com veios sutis — vibe spa premium.',
    scenarioPrompt: 'Clean white marble countertop with subtle grey veining, soft diffused natural daylight from above creating gentle highlights on the surface, minimal aesthetic with no clutter, premium spa-like atmosphere, slight reflection of the product on the polished marble.',
    bestFor: 'Skincare, perfume, sérum, produtos premium de beleza.',
  },
  {
    id: 'vanity',
    name: 'Vanity / mesa de maquiagem',
    emoji: '💄',
    group: 'beauty',
    description: 'Mesa de maquiagem com luzes Hollywood ao redor de espelho.',
    scenarioPrompt: 'Vanity makeup table surface with warm Hollywood-style ring light reflection in the background, soft pink or beige base tone, brushes and small beauty items slightly out of focus around the edges, getting-ready atmosphere with intimate warm lighting.',
    bestFor: 'Maquiagem, batom, base, paleta, pincel, espelho de bolsa.',
  },
  {
    id: 'pia_banheiro',
    name: 'Pia de banheiro',
    emoji: '🚿',
    group: 'beauty',
    description: 'Pia clean de banheiro moderno com toalha branca e luz natural.',
    scenarioPrompt: 'Clean modern bathroom sink area with white ceramic surface, fresh white folded towel visible at the edge, soft cosmetic lighting from above, slight humidity in the air suggesting morning routine, minimal Scandinavian aesthetic.',
    bestFor: 'Skincare, shampoo, sabonete, produtos de higiene.',
  },

  // ── 💼 Trabalho / Tech (3) ───────────────────────────────────────────
  {
    id: 'mesa_escritorio',
    name: 'Mesa de escritório',
    emoji: '💼',
    group: 'work',
    description: 'Mesa minimalista com laptop fechado e caderno — vibe produtividade.',
    scenarioPrompt: 'Minimalist office desk surface in light wood or matte white, closed laptop slightly out of focus in the background, leather notebook and a coffee cup at the edge of the frame, soft natural daylight from a window on the side, productive professional atmosphere.',
    bestFor: 'Eletrônicos, papelaria, acessórios de escritório, agenda.',
  },
  {
    id: 'setup_gamer',
    name: 'Setup gamer / tech',
    emoji: '🎮',
    group: 'work',
    description: 'Mesa com luz RGB ao fundo — vibe gamer / tech enthusiast.',
    scenarioPrompt: 'Dark gamer desk surface with RGB ambient lighting in purple and cyan tones in the background, mechanical keyboard and headphones slightly out of focus, modern tech-enthusiast aesthetic with deep contrast between bright product highlights and dark surroundings.',
    bestFor: 'Acessórios gamer, fones, mouse, teclado, controle, gadget.',
  },
  {
    id: 'estudio_neutro',
    name: 'Estúdio neutro',
    emoji: '🎬',
    group: 'work',
    description: 'Fundo neutro estilo estúdio fotográfico — foco total no produto.',
    scenarioPrompt: 'Seamless neutral studio backdrop in soft grey or beige, product placed on a matching surface, controlled three-point studio lighting eliminating harsh shadows, professional product photography atmosphere with no environmental distractions.',
    bestFor: 'Qualquer produto que pede foco máximo, e-commerce, catálogo.',
  },

  // ── 🛋 Casa / Lifestyle (5) ─────────────────────────────────────────
  {
    id: 'cozinha_clean',
    name: 'Cozinha bancada limpa',
    emoji: '🍳',
    group: 'lifestyle',
    description: 'Bancada de cozinha clara e limpa — vibe doméstica luminosa.',
    scenarioPrompt: 'Clean light kitchen countertop in white or light wood, modern kitchen utensils and a fresh herb plant slightly out of focus in the background, bright natural daylight from a window, fresh and welcoming home atmosphere.',
    bestFor: 'Alimento, bebida, utensílio de cozinha, suplemento líquido.',
  },
  {
    id: 'mesa_cafe',
    name: 'Mesa de café',
    emoji: '☕',
    group: 'lifestyle',
    description: 'Mesa pequena com xícara de café e croissant — vibe brunch cozy.',
    scenarioPrompt: 'Small wooden cafe table surface with a warm cappuccino cup and a fresh croissant on a ceramic plate slightly out of focus, soft morning light filtering through a nearby window, cozy intimate brunch atmosphere with warm tones.',
    bestFor: 'Suplemento, snack, bebida funcional, livro, joia delicada.',
  },
  {
    id: 'cama_lencol_claro',
    name: 'Cama com lençol claro',
    emoji: '🛏️',
    group: 'lifestyle',
    description: 'Lençol branco amassado naturalmente — vibe íntima de manhã.',
    scenarioPrompt: 'Crisp white bedsheet softly wrinkled on a made bed, late morning sunlight casting gentle diagonal patterns across the fabric, intimate bedroom atmosphere with cozy warmth, slight blur on the background pillows for depth.',
    bestFor: 'Lingerie, perfume, livro, joia, item de auto-cuidado.',
  },
  {
    id: 'quarto_noturno',
    name: 'Quarto noturno cozy',
    emoji: '🌙',
    group: 'lifestyle',
    description: 'Quarto noturno com luz quente baixa — vibe rotina noturna.',
    scenarioPrompt: 'Bedside table surface with a soft warm bedside lamp casting amber light, dim cozy bedroom in the background slightly out of focus, intimate night-time routine atmosphere with deep warm shadows and golden highlights on the product.',
    bestFor: 'Cosmético noturno, vela, óleo essencial, livro, suplemento sleep.',
  },
  {
    id: 'mesa_ar_livre',
    name: 'Mesa ao ar livre',
    emoji: '🌿',
    group: 'lifestyle',
    description: 'Mesa de jardim com folhagem ao fundo — vibe outdoor verão.',
    scenarioPrompt: 'Outdoor wooden garden table surface, lush green foliage softly out of focus in the background, dappled natural sunlight filtering through leaves creating gentle highlights and shadows on the product, fresh summery outdoor atmosphere.',
    bestFor: 'Bebida refrescante, protetor solar, óculos, sandália, item verão.',
  },

  // ── 🌟 Especial / Criativo (4) ───────────────────────────────────────
  {
    id: 'mesa_unboxing',
    name: 'Mesa de unboxing',
    emoji: '📦',
    group: 'special',
    description: 'Mesa neutra com caixa fechada — superfície dedicada ao reveal.',
    scenarioPrompt: 'Clean neutral surface (light wood or matte white) prepared for an unboxing moment, sealed product packaging centered in frame, soft even lighting eliminating shadows on the box, anticipation atmosphere with focus entirely on the package.',
    bestFor: 'Qualquer produto novo na embalagem — vibe reveal de unboxing.',
  },
  {
    id: 'mesa_bar',
    name: 'Mesa de bar / cocktail',
    emoji: '🍸',
    group: 'special',
    description: 'Bar escuro com luz ambiente colorida — vibe noturna sofisticada.',
    scenarioPrompt: 'Dark bar countertop in deep wood or marble with soft amber and red ambient bar lighting in the background, blurred bottles and glassware slightly visible behind, sophisticated night-out atmosphere with cinematic moody tones.',
    bestFor: 'Perfume masculino, relógio, joia, bebida alcoólica, item premium noturno.',
  },
  {
    id: 'loja_showroom',
    name: 'Loja / showroom',
    emoji: '🏬',
    group: 'special',
    description: 'Showroom com prateleira ao fundo — vibe varejo aspiracional.',
    scenarioPrompt: 'Bright retail showroom counter with elegantly displayed products on shelves softly out of focus in the background, polished display lighting, premium retail atmosphere with clean minimalist branding cues, aspirational shopping vibe.',
    bestFor: 'Roupa em cabide, sapato, óculos, bolsa, item de moda.',
  },
  {
    id: 'estudio_neon',
    name: 'Estúdio com LED neon',
    emoji: '💜',
    group: 'special',
    description: 'Fundo escuro com LEDs coloridos — vibe pop, viral, jovem.',
    scenarioPrompt: 'Dark studio surface with vibrant LED neon lighting in pink, purple and cyan creating bold colored reflections on the product surface, contemporary pop aesthetic with high contrast and saturated colors, viral TikTok energy.',
    bestFor: 'Gadget tech, fone, capinha colorida, produto Gen Z, item viral.',
  },
];

// ── Grupos (pra organização visual da UI) ────────────────────────────

export const POV_SCENARIO_GROUPS = [
  {
    id: 'beauty',
    name: 'Beleza',
    emoji: '💄',
    description: 'Superfícies neutras com luz suave — produtos de beleza.',
  },
  {
    id: 'work',
    name: 'Trabalho / Tech',
    emoji: '💼',
    description: 'Superfícies tech/escritório — produtos profissionais.',
  },
  {
    id: 'lifestyle',
    name: 'Casa / Lifestyle',
    emoji: '🛋️',
    description: 'Superfícies casuais de casa e dia-a-dia.',
  },
  {
    id: 'special',
    name: 'Especial / Criativo',
    emoji: '🌟',
    description: 'Superfícies criativas que pedem mood específico.',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

export function getScenarioById(id) {
  return POV_SCENARIOS.find((s) => s.id === id) || null;
}

export function getScenariosByGroup(groupId) {
  return POV_SCENARIOS.filter((s) => s.group === groupId);
}

export function getScenarioGroupById(id) {
  return POV_SCENARIO_GROUPS.find((g) => g.id === id) || null;
}

// Lista todos os ids dos cenários (útil pra validação cruzada em pov-mappings.js)
export function getAllScenarioIds() {
  return POV_SCENARIOS.map((s) => s.id);
}
