// src/data/pov-types.js
//
// 22 tipos de POV organizados em 9 grupos pela forma física da interação
// entre mão/corpo/câmera e produto. Dimensão NOVA inédita vs Trendly (eles
// têm presets, não dimensão filtrável).
//
// 🔄 Plano v4 (sessão 11/05/2026) — refine completo da aba POV:
//   • +11 tipos novos em 5 grupos novos (movement, social, cinematic,
//     storytelling, shopping) + 1 retrofit no grupo handheld existente.
//   • Novo campo motionIntensity (1-5) em todos os 22 tipos — controla
//     a intensidade do movimento corporal/da câmera no take.
//   • Micro-ações injetadas em cada promptHint pra dar ao Kling pistas
//     concretas de gestos e ritmos compatíveis com a intensidade.
//
// Cada tipo serve como anchor visual pro prompt do Kling 2.6 Pro: descreve
// como a mão/corpo segura, veste, usa, recebe ou se desloca com o produto.
// Combinado com o cenário (passo 4), o visual (passo 6) e a intensidade
// humana de voz (passo 9), forma a base do vídeo.
//
// Mapeamento Tipo → Cenário continua em ./pov-mappings.js (filtra
// automaticamente os cenários compatíveis no wizard, agora considerando
// também motionIntensity — a partir do arquivo 7 do mesmo sub-lote A).
//
// Cada tipo tem:
//   - id: slug em snake_case (id interno, estável)
//   - name: nome em PT-BR pra UI
//   - emoji: emoji representativo
//   - group: id do grupo macro (handheld | worn | oral | special |
//            movement | social | cinematic | storytelling | shopping)
//   - motionIntensity: 1-5 (1 = quase estático; 5 = atlético intenso)
//   - description: 1 frase explicando o tipo
//   - promptHint: texto em INGLÊS pra direcionar o prompt do Kling
//                 (descreve forma física da interação + micro-ações)
//   - bestFor: exemplos PT-BR de produtos típicos
//
// 🔁 Retrocompatibilidade: campos novos (motionIntensity) são opcionais
// pros consumidores. UI/backend atuais ignoram silenciosamente até serem
// atualizados nos sub-lotes B e C.
//
// Referência: 📋 Sessão 11/05/2026 — Plano consolidado v4 (Notion).

export const POV_TYPES = [
  // ── 🤲 HANDHELD — Mão segurando (6) ───────────────────────────────────
  {
    id: 'frasco',
    name: 'Frasco / Garrafa',
    emoji: '🍶',
    group: 'handheld',
    motionIntensity: 1,
    description: 'Mão segurando frasco ou garrafa — pegada lateral firme.',
    promptHint: 'Hand grasping a bottle or flask firmly from the side, fingers wrapped around the body of the container, product label clearly visible, smooth deliberate movements showing the product weight and shape, with slight thumb glides along the label and gentle wrist rotations revealing the bottle silhouette.',
    bestFor: 'Perfume, sérum, bebida, suplemento líquido, óleo essencial.',
  },
  {
    id: 'pote',
    name: 'Pote / Jar',
    emoji: '🥄',
    group: 'handheld',
    motionIntensity: 1,
    description: 'Mão segurando pote pelo corpo — outra mão abre a tampa.',
    promptHint: 'One hand holding a jar steady from below, the other hand unscrewing or removing the lid in a smooth motion, product opening clearly visible, content texture revealed naturally, with a delicate lid twisting motion and a brief content peek with minimal arm tension.',
    bestFor: 'Creme facial, manteiga corporal, alimento em pote, bálsamo.',
  },
  {
    id: 'sapatos',
    name: 'Sapatos',
    emoji: '👟',
    group: 'handheld',
    motionIntensity: 1,
    description: 'Mão erguendo um sapato — exibindo lateral, sola e detalhes.',
    promptHint: 'Hand lifting a single shoe by the heel or upper, rotating slowly to show the side profile, sole, stitching and material detail, product fully in focus against a clean background, with subtle wrist tilts and gentle finger repositioning on the upper.',
    bestFor: 'Tênis, sandália, sapatilha, sapato social.',
  },
  {
    id: 'capinha',
    name: 'Capinha / Telefone',
    emoji: '📱',
    group: 'handheld',
    motionIntensity: 1,
    description: 'Mão segurando capinha ou gadget retangular — exibe frente e detalhes.',
    promptHint: 'Hand holding a rectangular phone case or compact gadget vertically, fingers gripping the edges, slight rotation revealing the back design, camera cutouts and material texture clearly visible, with light fingertip taps on edges and slow vertical rotation showing camera cutouts.',
    bestFor: 'Capinha de celular, power bank, controle pequeno, gadget compacto.',
  },
  {
    id: 'pequeno',
    name: 'Produto pequeno',
    emoji: '🎧',
    group: 'handheld',
    motionIntensity: 1,
    description: 'Estojo aberto na mão revelando produto pequeno dentro.',
    promptHint: 'Hand holding a small open case or box at chest level, product nested inside clearly visible, fingers framing the case without covering the product, soft natural lighting on the contents, with careful case tilting and subtle finger spread framing the contents.',
    bestFor: 'Fones de ouvido, joia em estojo, miniatura, anel, brinco.',
  },
  {
    id: 'close_tatil',
    name: 'Close tátil (apertar)',
    emoji: '👆',
    group: 'handheld',
    motionIntensity: 1,
    description: 'Mão apertando a textura do produto — extreme close-up tátil.',
    promptHint: 'Extreme close-up of fingers pressing or squeezing the product to test its texture and material quality, slow pressing motion, subtle finger compression on the surface, gentle release showing material rebound or bounce-back, every micro-detail of the surface visible (fabric weave, foam compression, leather grain, packaging finish).',
    bestFor: 'Tecido, espuma, couro, embalagem premium, pão, almofada.',
  },

  // ── 👔 WORN — Vestido / usado (3) ─────────────────────────────────────
  {
    id: 'cabide',
    name: 'Cabide',
    emoji: '👗',
    group: 'worn',
    motionIntensity: 1,
    description: 'Roupa pendurada num cabide — mão revela tecido e caimento.',
    promptHint: 'Hand holding a clothing hanger at eye level, garment hanging naturally, the other hand smoothing the fabric or revealing texture details, full piece visible from collar to hem, with gentle fabric brushing and a soft sway of the hanger.',
    bestFor: 'Vestido, blusa, conjunto, roupa fitness no cabide.',
  },
  {
    id: 'pulso',
    name: 'Pulso',
    emoji: '⌚',
    group: 'worn',
    motionIntensity: 1,
    description: 'Produto no pulso — relógio, pulseira ou anel sendo exibido.',
    promptHint: 'Wrist or hand wearing the product, slight rotation showing the piece from multiple angles, skin texture and product detail in sharp focus, natural arm position with relaxed posture, with slow wrist rotation and gentle forearm angle adjustments.',
    bestFor: 'Relógio, pulseira, anel, bracelete.',
  },
  {
    id: 'vestindo',
    name: 'Vestindo',
    emoji: '🕶️',
    group: 'worn',
    motionIntensity: 2,
    description: 'Produto sendo colocado — gesto de vestir óculos, chapéu, brinco.',
    promptHint: 'Hands bringing the wearable product toward the body and putting it on in a smooth motion (glasses lifting to the eyes, hat onto the head, earring to the lobe), product clearly visible during the action, with a smooth lifting motion and a brief settling adjustment after placement.',
    bestFor: 'Óculos, chapéu, brincos, bandana, headphone.',
  },

  // ── 🍽 ORAL — Uso oral (1) ────────────────────────────────────────────
  {
    id: 'mordida',
    name: 'Mordida / Comer / Beber',
    emoji: '🍔',
    group: 'oral',
    motionIntensity: 2,
    description: 'Produto sendo mordido, comido ou bebido — interação oral direta.',
    promptHint: 'Hand bringing the food or drink product toward the mouth, lips parting naturally as the product approaches, controlled bite or sip moment, product partially consumed visible, with a brief lip parting moment and a controlled chew or sip immediately after contact.',
    bestFor: 'Comida, bebida, suplemento mastigável, snack, café.',
  },

  // ── 🎁 SPECIAL — Sem mãos / especiais (2) ─────────────────────────────
  {
    id: 'superficie',
    name: 'Sobre superfície',
    emoji: '🪑',
    group: 'special',
    motionIntensity: 1,
    description: 'Produto estático em mesa ou bancada — vibe catálogo / e-commerce.',
    promptHint: 'Product placed on a clean surface (counter, table, shelf), camera circling slowly or zooming in for detail, no hands in frame, professional product photography lighting, multiple angles revealed, with no body motion in frame and a slow controlled camera glide around the product.',
    bestFor: 'Decoração, eletrodoméstico pequeno, item de organização, brinquedo.',
  },
  {
    id: 'unboxing',
    name: 'Unboxing',
    emoji: '📦',
    group: 'special',
    motionIntensity: 2,
    description: 'Caixa fechada → mãos abrindo → revelação do produto interno.',
    promptHint: 'Hands opening a sealed product box from the top, lifting the lid carefully, revealing the product inside with anticipation, packaging material and product surface clearly visible during the reveal, with an anticipation pause before the reveal and a controlled lid lift.',
    bestFor: 'Qualquer produto novo na embalagem original — eletrônicos, beleza, presentes.',
  },

  // ── 🚶 MOVEMENT — Movimento (3 NOVOS) ─────────────────────────────────
  {
    id: 'caminhando',
    name: 'Caminhando',
    emoji: '🚶',
    group: 'movement',
    motionIntensity: 4,
    description: 'Andando enquanto exibe o produto na mão — vibe street style.',
    promptHint: 'Person walking forward holding the product visible in one hand, subtle arm swing, natural step rhythm, occasional weight shift between legs, urban or domestic setting slightly blurring in the background from forward motion, product staying clearly framed and in focus throughout the walk.',
    bestFor: 'Café, perfume, bolsa, fone, óculos, sacola, copo take-away.',
  },
  {
    id: 'correndo',
    name: 'Correndo / academia',
    emoji: '🏃',
    group: 'movement',
    motionIntensity: 5,
    description: 'Movimento intenso (corrida, treino) com produto visível.',
    promptHint: 'Person in athletic motion (running, lifting, training), product visible held in hand or worn on body, intense breathing rhythm, sweat-glistening skin highlights, dynamic arm pumping motion, gym or outdoor athletic setting with motion blur on the background, product staying in sharp focus despite the high-energy movement.',
    bestFor: 'Suplemento, fone, fitness, relógio, garrafa térmica, tênis esportivo.',
  },
  {
    id: 'entrando_ambiente',
    name: 'Entrando no ambiente',
    emoji: '🚪',
    group: 'movement',
    motionIntensity: 3,
    description: 'Chegando em casa/trabalho/loja com o produto na mão.',
    promptHint: 'Person entering a space (home doorway, office reception, store front) holding or carrying the product, purposeful step into the room, slight door interaction with shoulder or elbow, natural body rotation entering the frame, product visible in hand or on body during the arrival moment.',
    bestFor: 'Bolsa, sacola, sapato, perfume, café take-away, pacote de entrega.',
  },

  // ── 👋 SOCIAL — Social (2 NOVOS) ──────────────────────────────────────
  {
    id: 'mostrando_amigo',
    name: 'Mostrando pra amigo',
    emoji: '👋',
    group: 'social',
    motionIntensity: 2,
    description: 'Câmera vira pra um amigo que reage ao ver o produto.',
    promptHint: 'Camera turning toward another person who reacts to the product, slight camera turn revealing a friend in frame, brief eye contact moment between the protagonist and the friend, casual gesture offering or showing the product, reaction of surprise or delight on the friends face, product framed naturally between the two people.',
    bestFor: 'Gadget, presente, comida nova, lançamento, item viral.',
  },
  {
    id: 'recebendo_produto',
    name: 'Recebendo produto',
    emoji: '🎁',
    group: 'social',
    motionIntensity: 2,
    description: 'Outra mão entrega o produto — vibe presente ou handoff.',
    promptHint: 'Another hand extending from off-frame to deliver the product into the protagonists open hand, subtle hand opening to receive, brief weight shift accepting the product, gentle grip closure around it, gift exchange or handoff context, both hands visible during the transfer moment.',
    bestFor: 'Presente, item de luxo, skincare premium, comida em entrega, mimo.',
  },

  // ── 🎬 CINEMATIC — Cinemático (1 NOVO) ────────────────────────────────
  {
    id: 'reflexo_espelho',
    name: 'Reflexo no espelho',
    emoji: '🪞',
    group: 'cinematic',
    motionIntensity: 2,
    description: 'Produto aparece pelo reflexo num espelho — vibe editorial.',
    promptHint: 'Product appearing through a mirror reflection (bathroom mirror, vanity, dressing-room mirror, closet mirror), slow camera turn revealing the reflection, subtle body angle shift in front of the mirror, momentary eye contact with the reflection, the mirror showing both the person and the product cleanly framed together.',
    bestFor: 'Perfume, moda, skincare, joia, óculos, peça de vestir.',
  },

  // ── 📖 STORYTELLING — Storytelling (2 NOVOS) ──────────────────────────
  {
    id: 'antes_depois',
    name: 'Antes → Depois',
    emoji: '⏪',
    group: 'storytelling',
    motionIntensity: 3,
    description: '2 takes mostrando transformação com o produto como catalisador.',
    promptHint: 'Two distinct visual states shown sequentially with the product as the catalyst, clear before-state moment in the first beat, transition gesture using the product in between, distinct after-state reveal in the second beat, the contrast between before and after clearly visible in the same composition or with a smooth match cut.',
    bestFor: 'Skincare, cabelo, limpeza, organização, maquiagem, transformação.',
  },
  {
    id: 'testando_primeira',
    name: 'Testando 1ª vez',
    emoji: '🧪',
    group: 'storytelling',
    motionIntensity: 2,
    description: 'Primeira experiência com o produto — descoberta autêntica.',
    promptHint: 'First-time experience with the product, tentative first touch or sniff or taste, brief hesitation pause before the reaction, micro-expressions of discovery on the face (surprise, curiosity, satisfaction), careful interaction revealing the initial impression honestly, product handled with attention and presence.',
    bestFor: 'Perfume novo, snack, bebida, suplemento, item de lançamento.',
  },

  // ── 🛒 SHOPPING — Compra (2 NOVOS) ────────────────────────────────────
  {
    id: 'pegando_prateleira',
    name: 'Pegando da prateleira',
    emoji: '🛒',
    group: 'shopping',
    motionIntensity: 3,
    description: 'Mão tirando o produto de prateleira de loja ou armário.',
    promptHint: 'Hand reaching toward a product on a store shelf or kitchen cabinet, reaching motion toward the shelf with arm extension, brief product selection pause comparing nearby options, deliberate grab and pull motion, product extracted cleanly from a row of similar items, retail or pantry context visible around the hand.',
    bestFor: 'Alimento, cosmético, utilidade doméstica, produto de supermercado.',
  },
  {
    id: 'tirando_mochila',
    name: 'Tirando da mochila',
    emoji: '🎒',
    group: 'shopping',
    motionIntensity: 2,
    description: 'Mão puxando o produto de mochila, bolsa ou pochete.',
    promptHint: 'Hand pulling the product out of a bag (backpack, tote, purse, fanny pack), casual bag opening motion with the other hand holding the bag open, hand searching briefly inside, gentle product extraction with controlled reveal, product emerging from inside the bag clearly into view.',
    bestFor: 'Tech, item escolar, gadget, papelaria, snack de bolso, carteira.',
  },
];

// ── Grupos (pra organização visual da UI) ────────────────────────────
//
// Ordem: 4 grupos atuais primeiro (preserva render existente do PovWizard
// Step 3), seguido dos 5 grupos novos. Cada grupo é renderizado como uma
// seção separada com header de grupo no Step 3.

export const POV_TYPE_GROUPS = [
  {
    id: 'handheld',
    name: 'Mão segurando',
    emoji: '🤲',
    description: 'Produto na mão, exibido por gesto de pegar.',
  },
  {
    id: 'worn',
    name: 'Vestido / usado',
    emoji: '👔',
    description: 'Produto vestido no corpo, no pulso ou no rosto.',
  },
  {
    id: 'oral',
    name: 'Uso oral',
    emoji: '🍽️',
    description: 'Produto comido, bebido ou mordido.',
  },
  {
    id: 'special',
    name: 'Sem mãos / especiais',
    emoji: '🎁',
    description: 'Sem mão visível ou padrões especiais (unboxing, catálogo).',
  },
  // ── Grupos NOVOS (Plano v4) ───────────────────────────────────────────
  {
    id: 'movement',
    name: 'Movimento',
    emoji: '🚶',
    description: 'Corpo em deslocamento — caminhada, corrida, chegada.',
  },
  {
    id: 'social',
    name: 'Social',
    emoji: '👋',
    description: 'Interação com outra pessoa — mostrar ou receber o produto.',
  },
  {
    id: 'cinematic',
    name: 'Cinemático',
    emoji: '🎬',
    description: 'Recurso visual cinematográfico — reflexo, espelho, frame.',
  },
  {
    id: 'storytelling',
    name: 'Storytelling',
    emoji: '📖',
    description: 'Narrativa em 2 tempos — antes/depois, descoberta, jornada.',
  },
  {
    id: 'shopping',
    name: 'Compra',
    emoji: '🛒',
    description: 'Contexto de compra — prateleira de loja ou retirada de bolsa.',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

export function getTypeById(id) {
  return POV_TYPES.find((t) => t.id === id) || null;
}

export function getTypesByGroup(groupId) {
  return POV_TYPES.filter((t) => t.group === groupId);
}

export function getTypeGroupById(id) {
  return POV_TYPE_GROUPS.find((g) => g.id === id) || null;
}

// Lista todos os ids dos tipos (útil pra validação cruzada em pov-mappings.js)
export function getAllTypeIds() {
  return POV_TYPES.map((t) => t.id);
}

// ── Helpers NOVOS (Plano v4) ──────────────────────────────────────────

// Retorna todos os tipos com determinado motionIntensity (1-5).
// Útil pro PovWizard filtrar tipos por intensidade selecionada,
// ou pro pov-mappings.js fazer regra híbrida automática (M3).
export function getTypesByMotionIntensity(intensity) {
  return POV_TYPES.filter((t) => t.motionIntensity === intensity);
}

// Retorna todos os tipos com motionIntensity dentro de um range [min, max]
// (inclusivo nos dois lados). Útil pra filtros do tipo "qualquer coisa
// até intensidade média" ou "movimento alto pra cima".
export function getTypesByMotionRange(min, max) {
  return POV_TYPES.filter(
    (t) => t.motionIntensity >= min && t.motionIntensity <= max
  );
}
