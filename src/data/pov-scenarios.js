// src/data/pov-scenarios.js
//
// 37 micro-cenários próprios da aba POV — diferentes dos cenários da aba
// UGC Falante (./ugc-scenarios.js) porque POV é micro-cenário de superfície
// close-up OU ambiente envolvente, enquanto UGC Falante é ambiente macro
// com pessoa visível.
//
// POV foca em superfícies e backgrounds que valorizam o produto e dão
// vibe TikTok Shop autêntica. Iluminação cinematográfica + textura visível.
//
// 🔄 Plano v4 (sessão 11/05/2026) — refine completo da aba POV:
//   • +22 cenários novos em 6 grupos (2 novos: movement, retail).
//   • Novo campo type ('surface' | 'environment') em todos os 37 cenários.
//     - surface: bancada/mesa/balcão close-up, foco em superfície.
//     - environment: ambiente envolvente mais amplo, pessoa em contexto.
//     Os 15 cenários atuais são retrofitted como surface (mantêm vibe).
//   • Cenários do tipo environment combinam melhor com tipos de POV
//     mais dinâmicos (motionIntensity 3-5: caminhando, correndo, entrando,
//     etc.) e tipos sociais — pov-mappings.js fará essa ligação no
//     arquivo 7 do mesmo sub-lote A.
//
// 6 grupos:
//   - beauty (5): superfícies/ambientes pra produtos de beleza
//   - work (4): superfícies tech/escritório pra produtos profissionais
//   - lifestyle (14): superfícies/ambientes casuais de casa/dia-a-dia
//   - special (5): superfícies/ambientes criativos pra produtos com mood
//   - movement (6, NOVO): ambientes em deslocamento (rua, academia, etc.)
//   - retail (3, NOVO): ambientes de decoração/loja com manequim/display
//
// Cada cenário tem:
//   - id: slug em snake_case
//   - name: nome em PT-BR pra UI
//   - emoji: emoji representativo
//   - group: id do grupo macro
//   - type: 'surface' | 'environment' (NOVO no Plano v4)
//   - description: 1 frase curta pra UI
//   - scenarioPrompt: texto em INGLÊS pro prompt do Kling 2.6 Pro
//                     (descreve superfície/ambiente, iluminação,
//                      atmosfera — NÃO o produto)
//   - bestFor: exemplos PT-BR de produtos típicos
//
// Mapeamento Tipo → Cenário ideal fica em ./pov-mappings.js.
// "Personalizado" (textarea livre) é tratado na UI, não como item da lista.
//
// 🔁 Retrocompatibilidade: campo novo (type) é opcional pros consumidores.
// UI/backend atuais ignoram silenciosamente até serem atualizados nos
// sub-lotes B e C.
//
// Referência: 📋 Sessão 11/05/2026 — Plano consolidado v4 (Notion).

export const POV_SCENARIOS = [
  // ── 💄 Beleza (5) ────────────────────────────────────────────────────
  {
    id: 'bancada_marmore',
    name: 'Bancada de mármore',
    emoji: '🪨',
    group: 'beauty',
    type: 'surface',
    description: 'Bancada branca de mármore com veios sutis — vibe spa premium.',
    scenarioPrompt: 'Clean white marble countertop with subtle grey veining, soft diffused natural daylight from above creating gentle highlights on the surface, minimal aesthetic with no clutter, premium spa-like atmosphere, slight reflection of the product on the polished marble.',
    bestFor: 'Skincare, perfume, sérum, produtos premium de beleza.',
  },
  {
    id: 'vanity',
    name: 'Vanity / mesa de maquiagem',
    emoji: '💄',
    group: 'beauty',
    type: 'surface',
    description: 'Mesa de maquiagem com luzes Hollywood ao redor de espelho.',
    scenarioPrompt: 'Vanity makeup table surface with warm Hollywood-style ring light reflection in the background, soft pink or beige base tone, brushes and small beauty items slightly out of focus around the edges, getting-ready atmosphere with intimate warm lighting.',
    bestFor: 'Maquiagem, batom, base, paleta, pincel, espelho de bolsa.',
  },
  {
    id: 'pia_banheiro',
    name: 'Pia de banheiro',
    emoji: '🚿',
    group: 'beauty',
    type: 'surface',
    description: 'Pia clean de banheiro moderno com toalha branca e luz natural.',
    scenarioPrompt: 'Clean modern bathroom sink area with white ceramic surface, fresh white folded towel visible at the edge, soft cosmetic lighting from above, slight humidity in the air suggesting morning routine, minimal Scandinavian aesthetic.',
    bestFor: 'Skincare, shampoo, sabonete, produtos de higiene.',
  },
  {
    id: 'banheiro_bagunçado',
    name: 'Banheiro bagunçado',
    emoji: '🛁',
    group: 'beauty',
    type: 'environment',
    description: 'Banheiro real meio bagunçado — vibe rotina autêntica.',
    scenarioPrompt: 'Lived-in modern bathroom with white tiles slightly steamed up after a shower, used hand towels casually draped over a rail, a few products grouped naturally on the counter edge, warm vanity-mirror lighting creating a real morning-routine atmosphere, slight humidity hanging in the air, authentic everyday vibe with no overproduced styling.',
    bestFor: 'Skincare casual, produto de higiene, cuidados diários reais.',
  },
  {
    id: 'closet_espelhado',
    name: 'Closet espelhado',
    emoji: '🪞',
    group: 'beauty',
    type: 'environment',
    description: 'Closet com espelho de corpo inteiro — vibe getting ready.',
    scenarioPrompt: 'Walk-in closet space with a full-length mirror reflecting both the protagonist and the product, warm tungsten or LED dressing-room lighting on the rails, hanging clothes softly out of focus framing the mirror, polished hardwood floor catching gentle highlights, intimate getting-dressed atmosphere with reflection as the main visual element.',
    bestFor: 'Perfume, moda, óculos, joia, peça de vestir, skincare.',
  },

  // ── 💼 Trabalho / Tech (4) ───────────────────────────────────────────
  {
    id: 'mesa_escritorio',
    name: 'Mesa de escritório',
    emoji: '💼',
    group: 'work',
    type: 'surface',
    description: 'Mesa minimalista com laptop fechado e caderno — vibe produtividade.',
    scenarioPrompt: 'Minimalist office desk surface in light wood or matte white, closed laptop slightly out of focus in the background, leather notebook and a coffee cup at the edge of the frame, soft natural daylight from a window on the side, productive professional atmosphere.',
    bestFor: 'Eletrônicos, papelaria, acessórios de escritório, agenda.',
  },
  {
    id: 'setup_gamer',
    name: 'Setup gamer / tech',
    emoji: '🎮',
    group: 'work',
    type: 'surface',
    description: 'Mesa com luz RGB ao fundo — vibe gamer / tech enthusiast.',
    scenarioPrompt: 'Dark gamer desk surface with RGB ambient lighting in purple and cyan tones in the background, mechanical keyboard and headphones slightly out of focus, modern tech-enthusiast aesthetic with deep contrast between bright product highlights and dark surroundings.',
    bestFor: 'Acessórios gamer, fones, mouse, teclado, controle, gadget.',
  },
  {
    id: 'estudio_neutro',
    name: 'Estúdio neutro',
    emoji: '🎬',
    group: 'work',
    type: 'surface',
    description: 'Fundo neutro estilo estúdio fotográfico — foco total no produto.',
    scenarioPrompt: 'Seamless neutral studio backdrop in soft grey or beige, product placed on a matching surface, controlled three-point studio lighting eliminating harsh shadows, professional product photography atmosphere with no environmental distractions.',
    bestFor: 'Qualquer produto que pede foco máximo, e-commerce, catálogo.',
  },
  {
    id: 'mesa_caotica',
    name: 'Mesa caótica',
    emoji: '🗂️',
    group: 'work',
    type: 'surface',
    description: 'Mesa real bagunçada de uso — vibe creator autêntico no fluxo.',
    scenarioPrompt: 'Real working desk surface with controlled chaos: scattered papers, a half-drunk coffee mug, sticky notes around the monitor base softly out of focus, a tangled phone cable visible at the edge, late afternoon ambient lighting from a window, authentic lived-in productivity atmosphere with no perfect styling, real-creator workspace vibe.',
    bestFor: 'Tech, papelaria, snack de mesa, item de produtividade, livro.',
  },

  // ── 🛋 Casa / Lifestyle (14) ─────────────────────────────────────────
  {
    id: 'cozinha_clean',
    name: 'Cozinha bancada limpa',
    emoji: '🍳',
    group: 'lifestyle',
    type: 'surface',
    description: 'Bancada de cozinha clara e limpa — vibe doméstica luminosa.',
    scenarioPrompt: 'Clean light kitchen countertop in white or light wood, modern kitchen utensils and a fresh herb plant slightly out of focus in the background, bright natural daylight from a window, fresh and welcoming home atmosphere.',
    bestFor: 'Alimento, bebida, utensílio de cozinha, suplemento líquido.',
  },
  {
    id: 'mesa_cafe',
    name: 'Mesa de café',
    emoji: '☕',
    group: 'lifestyle',
    type: 'surface',
    description: 'Mesa pequena com xícara de café e croissant — vibe brunch cozy.',
    scenarioPrompt: 'Small wooden cafe table surface with a warm cappuccino cup and a fresh croissant on a ceramic plate slightly out of focus, soft morning light filtering through a nearby window, cozy intimate brunch atmosphere with warm tones.',
    bestFor: 'Suplemento, snack, bebida funcional, livro, joia delicada.',
  },
  {
    id: 'cama_lencol_claro',
    name: 'Cama com lençol claro',
    emoji: '🛏️',
    group: 'lifestyle',
    type: 'surface',
    description: 'Lençol branco amassado naturalmente — vibe íntima de manhã.',
    scenarioPrompt: 'Crisp white bedsheet softly wrinkled on a made bed, late morning sunlight casting gentle diagonal patterns across the fabric, intimate bedroom atmosphere with cozy warmth, slight blur on the background pillows for depth.',
    bestFor: 'Lingerie, perfume, livro, joia, item de auto-cuidado.',
  },
  {
    id: 'quarto_noturno',
    name: 'Quarto noturno cozy',
    emoji: '🌙',
    group: 'lifestyle',
    type: 'surface',
    description: 'Quarto noturno com luz quente baixa — vibe rotina noturna.',
    scenarioPrompt: 'Bedside table surface with a soft warm bedside lamp casting amber light, dim cozy bedroom in the background slightly out of focus, intimate night-time routine atmosphere with deep warm shadows and golden highlights on the product.',
    bestFor: 'Cosmético noturno, vela, óleo essencial, livro, suplemento sleep.',
  },
  {
    id: 'mesa_ar_livre',
    name: 'Mesa ao ar livre',
    emoji: '🌿',
    group: 'lifestyle',
    type: 'surface',
    description: 'Mesa de jardim com folhagem ao fundo — vibe outdoor verão.',
    scenarioPrompt: 'Outdoor wooden garden table surface, lush green foliage softly out of focus in the background, dappled natural sunlight filtering through leaves creating gentle highlights and shadows on the product, fresh summery outdoor atmosphere.',
    bestFor: 'Bebida refrescante, protetor solar, óculos, sandália, item verão.',
  },
  {
    id: 'cafeteria',
    name: 'Cafeteria',
    emoji: '🏪',
    group: 'lifestyle',
    type: 'environment',
    description: 'Cafeteria urbana com pessoas e steam ao fundo — vibe third place.',
    scenarioPrompt: 'Mid-sized urban cafeteria interior with brushed wood tables and exposed brick or concrete walls slightly out of focus, soft warm pendant lighting from above, ambient background of people chatting and steam rising from cups, the table where the product sits is in clear focus, vibrant social third-place atmosphere with morning warmth.',
    bestFor: 'Café take-away, livro, fone, gadget de bolso, snack, agenda.',
  },
  {
    id: 'cozinha_em_uso',
    name: 'Cozinha em uso',
    emoji: '👨‍🍳',
    group: 'lifestyle',
    type: 'environment',
    description: 'Cozinha em uso real — fogão acesso, ingredientes, vapor.',
    scenarioPrompt: 'Active kitchen scene with a stovetop simmering in the background out of focus, chopping board with fresh ingredients visible at the edge, steam rising from a pot, warm under-cabinet lighting, hands moving naturally in the workspace, real cooking moment atmosphere with sensory cues of food preparation.',
    bestFor: 'Tempero, utensílio, ingrediente premium, suplemento, panela.',
  },
  {
    id: 'janela_chuva',
    name: 'Janela com chuva',
    emoji: '🌧️',
    group: 'lifestyle',
    type: 'surface',
    description: 'Mesinha junto à janela com chuva — vibe melancólica cozy.',
    scenarioPrompt: 'Wooden window-side surface (windowsill or small table) with a rain-streaked window behind, soft grey overcast daylight filtering through the wet glass, rain droplets visible on the pane creating diffused light patterns, cozy melancholic indoor-on-a-rainy-day atmosphere, the product sitting peacefully on the surface as a calm contrast to the weather outside.',
    bestFor: 'Livro, chá, vela, perfume noturno, item de auto-cuidado, joia.',
  },
  {
    id: 'cozinha_noturna',
    name: 'Cozinha noturna',
    emoji: '🌃',
    group: 'lifestyle',
    type: 'environment',
    description: 'Cozinha à noite com luz baixa — vibe quiet ritual.',
    scenarioPrompt: 'Dimly lit kitchen at night with only the under-cabinet LED strip and a small pendant lamp casting warm pools of light, dark windows reflecting the interior, a glass of water or wine softly out of focus on the counter, intimate quiet night atmosphere, the product placed in a circle of warm light against the dark surrounding kitchen.',
    bestFor: 'Bebida, suplemento noturno, snack, chá, item de ritual.',
  },
  {
    id: 'sofa_cozy',
    name: 'Sofá cozy',
    emoji: '🛋️',
    group: 'lifestyle',
    type: 'environment',
    description: 'Sofá com manta e cushões — vibe hygge sala de estar.',
    scenarioPrompt: 'Plush sofa with chunky knitted blanket draped naturally over the armrest, soft cushions piled in the background, a steaming mug placed on a side table beside it, warm yellow floor-lamp lighting creating golden highlights on the fabric textures, cozy hygge living-room atmosphere with the product placed casually on the sofa or blanket.',
    bestFor: 'Livro, fone, manta, chá, vela, item de relax doméstico.',
  },
  {
    id: 'mat_yoga',
    name: 'Mat de yoga',
    emoji: '🧘',
    group: 'lifestyle',
    type: 'environment',
    description: 'Mat de yoga estendido no chão — vibe mindful matinal.',
    scenarioPrompt: 'Yoga mat unrolled on a wooden floor with a small plant and a soft towel beside it, soft morning natural daylight from a large window casting long gentle shadows across the floor, minimal mindful interior with neutral tones, peaceful pre-workout meditation atmosphere, the product placed at the corner of the mat as part of the wellness ritual.',
    bestFor: 'Suplemento, garrafa, óleo essencial, roupa fitness leve, livro.',
  },
  {
    id: 'lavanderia',
    name: 'Lavanderia',
    emoji: '🧺',
    group: 'lifestyle',
    type: 'environment',
    description: 'Área de serviço com máquinas e roupa dobrada — vibe utility.',
    scenarioPrompt: 'Bright modern laundry room with a stacked washer and dryer in the background slightly out of focus, neatly folded clothes on a counter, soft daylight through a small window, fresh detergent fragrance suggested by visual cues like a folded towel, clean and orderly utility atmosphere with the product placed on the counter or near the folded laundry.',
    bestFor: 'Produto de limpeza, perfume de tecido, sabão, fragrância, organizador.',
  },
  {
    id: 'aparador_hall',
    name: 'Aparador no hall',
    emoji: '🗝️',
    group: 'lifestyle',
    type: 'surface',
    description: 'Aparador na entrada de casa com chaveiro e espelho — vibe arrival.',
    scenarioPrompt: 'Narrow entryway console table surface in dark wood or matte black, a small ceramic bowl with keys and a candle softly out of focus beside it, a framed mirror behind reflecting the natural light from a nearby door, refined elegant home-entrance atmosphere, the product placed prominently on the console as a centerpiece.',
    bestFor: 'Perfume, vela, chaveiro, joia, vasinho, item decorativo.',
  },
  {
    id: 'gaveta_organizada',
    name: 'Gaveta organizada',
    emoji: '🗄️',
    group: 'lifestyle',
    type: 'surface',
    description: 'Gaveta aberta com compartimentos arrumados — vibe KonMari.',
    scenarioPrompt: 'Open drawer interior shot from above showing neatly arranged compartments with soft fabric liners, items grouped by category around the empty space where the product sits, soft top-down natural light revealing the organization, satisfying-organization atmosphere with KonMari-style aesthetic, the product fitting perfectly into its designated slot.',
    bestFor: 'Skincare em frasco, joia, óculos, gadget pequeno, organizador.',
  },

  // ── 🌟 Especial / Criativo (5) ───────────────────────────────────────
  {
    id: 'mesa_unboxing',
    name: 'Mesa de unboxing',
    emoji: '📦',
    group: 'special',
    type: 'surface',
    description: 'Mesa neutra com caixa fechada — superfície dedicada ao reveal.',
    scenarioPrompt: 'Clean neutral surface (light wood or matte white) prepared for an unboxing moment, sealed product packaging centered in frame, soft even lighting eliminating shadows on the box, anticipation atmosphere with focus entirely on the package.',
    bestFor: 'Qualquer produto novo na embalagem — vibe reveal de unboxing.',
  },
  {
    id: 'mesa_bar',
    name: 'Mesa de bar / cocktail',
    emoji: '🍸',
    group: 'special',
    type: 'surface',
    description: 'Bar escuro com luz ambiente colorida — vibe noturna sofisticada.',
    scenarioPrompt: 'Dark bar countertop in deep wood or marble with soft amber and red ambient bar lighting in the background, blurred bottles and glassware slightly visible behind, sophisticated night-out atmosphere with cinematic moody tones.',
    bestFor: 'Perfume masculino, relógio, joia, bebida alcoólica, item premium noturno.',
  },
  {
    id: 'loja_showroom',
    name: 'Loja / showroom',
    emoji: '🏬',
    group: 'special',
    type: 'surface',
    description: 'Showroom com prateleira ao fundo — vibe varejo aspiracional.',
    scenarioPrompt: 'Bright retail showroom counter with elegantly displayed products on shelves softly out of focus in the background, polished display lighting, premium retail atmosphere with clean minimalist branding cues, aspirational shopping vibe.',
    bestFor: 'Roupa em cabide, sapato, óculos, bolsa, item de moda.',
  },
  {
    id: 'estudio_neon',
    name: 'Estúdio com LED neon',
    emoji: '💜',
    group: 'special',
    type: 'surface',
    description: 'Fundo escuro com LEDs coloridos — vibe pop, viral, jovem.',
    scenarioPrompt: 'Dark studio surface with vibrant LED neon lighting in pink, purple and cyan creating bold colored reflections on the product surface, contemporary pop aesthetic with high contrast and saturated colors, viral TikTok energy.',
    bestFor: 'Gadget tech, fone, capinha colorida, produto Gen Z, item viral.',
  },
  {
    id: 'golden_hour',
    name: 'Golden hour',
    emoji: '🌅',
    group: 'special',
    type: 'surface',
    description: 'Luz dourada de fim de tarde — vibe cinematográfica mágica.',
    scenarioPrompt: 'Outdoor or window-side surface bathed in dramatic golden hour sunlight, long warm orange-amber light rays casting elongated shadows, the product catching a beautiful warm rim-light highlight, simple uncluttered background, cinematic magic-hour atmosphere with high warmth and contrast, photographer dream lighting on the product.',
    bestFor: 'Perfume, óculos, joia, bebida, item premium, peça de moda.',
  },

  // ── 🚶 Movimento (6 NOVOS, todos environment) ─────────────────────────
  {
    id: 'rua_urbana',
    name: 'Rua urbana',
    emoji: '🏙️',
    group: 'movement',
    type: 'environment',
    description: 'Rua de cidade com pedestres e fachadas — vibe street style.',
    scenarioPrompt: 'Urban street scene with a mix of pedestrians and storefronts slightly out of focus behind, soft late-afternoon sunlight bouncing off building facades, ambient city movement with cars passing in the far background, authentic street-style influencer atmosphere with mild motion blur on the surroundings while the foreground stays sharp.',
    bestFor: 'Bolsa, fone, óculos, café take-away, sapato, perfume on-the-go.',
  },
  {
    id: 'academia',
    name: 'Academia',
    emoji: '💪',
    group: 'movement',
    type: 'environment',
    description: 'Interior de academia com equipamentos e espelhos — vibe fitness intenso.',
    scenarioPrompt: 'Modern gym interior with dark equipment and mirror walls slightly out of focus in the background, focused spot lighting on the workout area, faint atmosphere of other gym-goers training out of focus, energetic fitness atmosphere with sweat-glistening highlights and visible intensity, the product staying in focus during the workout motion.',
    bestFor: 'Suplemento, garrafa térmica, fone, relógio, tênis esportivo, fitness.',
  },
  {
    id: 'elevador',
    name: 'Elevador',
    emoji: '🛗',
    group: 'movement',
    type: 'environment',
    description: 'Cabine de elevador com espelho — vibe lift-selfie contida.',
    scenarioPrompt: 'Inside a modern elevator cabin with metallic walls or mirror surface reflecting the protagonist holding the product, soft overhead recessed lighting, the floor indicator faintly visible at the top edge, contained intimate moment-in-transit atmosphere, lift-selfie aesthetic with the reflection element framing the product clearly.',
    bestFor: 'Perfume, bolsa, look completo, óculos, item compacto premium.',
  },
  {
    id: 'corredor_predio',
    name: 'Corredor de prédio',
    emoji: '🚪',
    group: 'movement',
    type: 'environment',
    description: 'Corredor com portas em perspectiva — vibe chegando em casa.',
    scenarioPrompt: 'Building corridor or hallway with patterned carpet and a row of identical doors stretching into perspective, soft warm hallway lighting from sconces or recessed fixtures, architectural depth atmosphere, the product visible being carried down the corridor, that arriving-at-the-apartment moment with subtle motion forward.',
    bestFor: 'Bolsa, sacola de compras, pacote de entrega, peça de moda, café.',
  },
  {
    id: 'entrada_loja',
    name: 'Entrada de loja / mercado',
    emoji: '🛍️',
    group: 'movement',
    type: 'environment',
    description: 'Threshold entre rua e loja — vibe acabei de comprar.',
    scenarioPrompt: 'Storefront entrance with a clean glass door, soft natural daylight from outside contrasting with the warmer interior store lighting, retail-arrival atmosphere, brief threshold moment of entering or leaving with a purchase, slight motion of the door swinging, the product visible held or inside a shopping bag.',
    bestFor: 'Sacola de compras, produto de mercado, item de loja, café take-away.',
  },
  {
    id: 'dentro_carro',
    name: 'Dentro do carro',
    emoji: '🚗',
    group: 'movement',
    type: 'environment',
    description: 'Interior de carro vista do passageiro — vibe on-the-go.',
    scenarioPrompt: 'Car interior shot from the passenger seat angle, dashboard slightly visible at the bottom of the frame, soft daylight through the side window creating contoured highlights, comfortable cabin atmosphere with steering wheel partially in frame, that on-the-go moment of having just bought or unwrapped the product, intimate solo travel vibe.',
    bestFor: 'Perfume, óculos, café take-away, snack, gadget, produto recém-comprado.',
  },

  // ── 🛍 Decoração & Varejo (3 NOVOS, todos environment) ────────────────
  {
    id: 'parede_objetos',
    name: 'Parede de objetos',
    emoji: '🖼️',
    group: 'retail',
    type: 'environment',
    description: 'Parede de boutique com produtos curados — vibe display editorial.',
    scenarioPrompt: 'Display wall in a styled boutique or pop-up store with a curated arrangement of products on minimal floating shelves or pegboards softly out of focus, warm accent spotlights highlighting each piece, the protagonist standing slightly in front holding their selected product, curated-retail atmosphere with editorial styling, the product being the chosen one from the display.',
    bestFor: 'Item de moda, decoração, gadget design, perfume, peça curada.',
  },
  {
    id: 'manequim_feminino',
    name: 'Manequim feminino',
    emoji: '👗',
    group: 'retail',
    type: 'environment',
    description: 'Loja feminina com manequim estilizado — vibe try-on aspiracional.',
    scenarioPrompt: 'Fashion store interior with a styled female mannequin in the background wearing a complete look, soft retail spotlight illuminating the display, the protagonist standing nearby holding or comparing the product (clothing, accessory) to the mannequin outfit, premium try-on atmosphere with optional mirror element, aspirational shopping vibe.',
    bestFor: 'Vestido, blusa, bolsa, joia, sapato feminino, conjunto.',
  },
  {
    id: 'manequim_masculino',
    name: 'Manequim masculino',
    emoji: '🤵',
    group: 'retail',
    type: 'environment',
    description: 'Loja masculina com manequim estilizado — vibe fitting confiante.',
    scenarioPrompt: 'Menswear store interior with a styled male mannequin in the background wearing a complete look, focused retail lighting on the display, the protagonist standing nearby holding or comparing the product to the mannequin outfit, masculine shopping atmosphere with neutral tones, that menswear-fitting-room confidence vibe.',
    bestFor: 'Camisa, blazer, sapato masculino, relógio, perfume masculino.',
  },
];

// ── Grupos (pra organização visual da UI) ────────────────────────────
//
// Ordem: 4 grupos atuais primeiro (preserva render existente do PovWizard
// Step 4), seguido dos 2 grupos novos. Cada grupo é renderizado como uma
// seção separada com header de grupo no Step 4.

export const POV_SCENARIO_GROUPS = [
  {
    id: 'beauty',
    name: 'Beleza',
    emoji: '💄',
    description: 'Superfícies e ambientes pra produtos de beleza.',
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
    description: 'Superfícies e ambientes casuais de casa e dia-a-dia.',
  },
  {
    id: 'special',
    name: 'Especial / Criativo',
    emoji: '🌟',
    description: 'Cenários criativos que pedem mood específico.',
  },
  // ── Grupos NOVOS (Plano v4) ───────────────────────────────────────────
  {
    id: 'movement',
    name: 'Movimento',
    emoji: '🚶',
    description: 'Ambientes em deslocamento — rua, academia, transporte.',
  },
  {
    id: 'retail',
    name: 'Decoração & Varejo',
    emoji: '🛍️',
    description: 'Ambientes de loja com manequim, display, parede curada.',
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

// ── Helper NOVO (Plano v4) ────────────────────────────────────────────

// Retorna todos os cenários de determinado type ('surface' | 'environment').
// Útil pro PovWizard distinguir visualmente surface (close-up) de environment
// (cenário amplo) na UI, e pro pov-mappings.js fazer regra híbrida
// considerando que motionIntensity alta combina melhor com environment.
export function getScenariosByType(type) {
  return POV_SCENARIOS.filter((s) => s.type === type);
}
