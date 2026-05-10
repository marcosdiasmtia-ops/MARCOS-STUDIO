// src/data/pov-types.js
//
// 11 tipos de POV organizados em 4 grupos pela forma física da interação
// entre mão e produto. Dimensão NOVA inédita vs Trendly (eles têm presets,
// não dimensão filtrável).
//
// Cada tipo serve como anchor visual pro prompt do Kling 2.6 Pro: descreve
// como a mão segura/vesti/usa o produto. Combinado com o cenário (passo 4)
// e o estilo (passo 6), forma a base visual do vídeo.
//
// Mapeamento Tipo → Cenário fica em ./pov-mappings.js (filtra automaticamente
// os cenários compatíveis no wizard, sem esconder os outros).
//
// Cada tipo tem:
//   - id: slug em snake_case (id interno)
//   - name: nome em PT-BR pra UI
//   - emoji: emoji representativo
//   - group: id do grupo macro (handheld | worn | oral | special)
//   - description: 1 frase explicando o tipo
//   - promptHint: texto em INGLÊS pra direcionar o prompt do Kling
//                 (descreve a forma física da interação mão↔produto)
//   - bestFor: exemplos PT-BR de produtos típicos
//
// Referência: 🎬 Arquitetura Aba POV (v1.0) no Notion · seção C2.

export const POV_TYPES = [
  // ── 🤲 Mão segurando (5) ─────────────────────────────────────────────
  {
    id: 'frasco',
    name: 'Frasco / Garrafa',
    emoji: '🍶',
    group: 'handheld',
    description: 'Mão segurando frasco ou garrafa — pegada lateral firme.',
    promptHint: 'Hand grasping a bottle or flask firmly from the side, fingers wrapped around the body of the container, product label clearly visible, smooth deliberate movements showing the product weight and shape.',
    bestFor: 'Perfume, sérum, bebida, suplemento líquido, óleo essencial.',
  },
  {
    id: 'pote',
    name: 'Pote / Jar',
    emoji: '🥄',
    group: 'handheld',
    description: 'Mão segurando pote pelo corpo — outra mão abre a tampa.',
    promptHint: 'One hand holding a jar steady from below, the other hand unscrewing or removing the lid in a smooth motion, product opening clearly visible, content texture revealed naturally.',
    bestFor: 'Creme facial, manteiga corporal, alimento em pote, bálsamo.',
  },
  {
    id: 'sapatos',
    name: 'Sapatos',
    emoji: '👟',
    group: 'handheld',
    description: 'Mão erguendo um sapato — exibindo lateral, sola e detalhes.',
    promptHint: 'Hand lifting a single shoe by the heel or upper, rotating slowly to show the side profile, sole, stitching and material detail, product fully in focus against a clean background.',
    bestFor: 'Tênis, sandália, sapatilha, sapato social.',
  },
  {
    id: 'capinha',
    name: 'Capinha / Telefone',
    emoji: '📱',
    group: 'handheld',
    description: 'Mão segurando capinha ou gadget retangular — exibe frente e detalhes.',
    promptHint: 'Hand holding a rectangular phone case or compact gadget vertically, fingers gripping the edges, slight rotation revealing the back design, camera cutouts and material texture clearly visible.',
    bestFor: 'Capinha de celular, power bank, controle pequeno, gadget compacto.',
  },
  {
    id: 'pequeno',
    name: 'Produto pequeno',
    emoji: '🎧',
    group: 'handheld',
    description: 'Estojo aberto na mão revelando produto pequeno dentro.',
    promptHint: 'Hand holding a small open case or box at chest level, product nested inside clearly visible, fingers framing the case without covering the product, soft natural lighting on the contents.',
    bestFor: 'Fones de ouvido, joia em estojo, miniatura, anel, brinco.',
  },

  // ── 👔 Vestido / usado (3) ───────────────────────────────────────────
  {
    id: 'cabide',
    name: 'Cabide',
    emoji: '👗',
    group: 'worn',
    description: 'Roupa pendurada num cabide — mão revela tecido e caimento.',
    promptHint: 'Hand holding a clothing hanger at eye level, garment hanging naturally, the other hand smoothing the fabric or revealing texture details, full piece visible from collar to hem.',
    bestFor: 'Vestido, blusa, conjunto, roupa fitness no cabide.',
  },
  {
    id: 'pulso',
    name: 'Pulso',
    emoji: '⌚',
    group: 'worn',
    description: 'Produto no pulso — relógio, pulseira ou anel sendo exibido.',
    promptHint: 'Wrist or hand wearing the product, slight rotation showing the piece from multiple angles, skin texture and product detail in sharp focus, natural arm position with relaxed posture.',
    bestFor: 'Relógio, pulseira, anel, bracelete.',
  },
  {
    id: 'vestindo',
    name: 'Vestindo',
    emoji: '🕶️',
    group: 'worn',
    description: 'Produto sendo colocado — gesto de vestir óculos, chapéu, brinco.',
    promptHint: 'Hands bringing the wearable product toward the body and putting it on in a smooth motion (glasses lifting to the eyes, hat onto the head, earring to the lobe), product clearly visible during the action.',
    bestFor: 'Óculos, chapéu, brincos, bandana, headphone.',
  },

  // ── 🍽 Uso oral (1) ──────────────────────────────────────────────────
  {
    id: 'mordida',
    name: 'Mordida / Comer / Beber',
    emoji: '🍔',
    group: 'oral',
    description: 'Produto sendo mordido, comido ou bebido — interação oral direta.',
    promptHint: 'Hand bringing the food or drink product toward the mouth, lips parting naturally as the product approaches, controlled bite or sip moment, product partially consumed visible.',
    bestFor: 'Comida, bebida, suplemento mastigável, snack, café.',
  },

  // ── 🎁 Sem mãos / especiais (2) ──────────────────────────────────────
  {
    id: 'superficie',
    name: 'Sobre superfície',
    emoji: '🪑',
    group: 'special',
    description: 'Produto estático em mesa ou bancada — vibe catálogo / e-commerce.',
    promptHint: 'Product placed on a clean surface (counter, table, shelf), camera circling slowly or zooming in for detail, no hands in frame, professional product photography lighting, multiple angles revealed.',
    bestFor: 'Decoração, eletrodoméstico pequeno, item de organização, brinquedo.',
  },
  {
    id: 'unboxing',
    name: 'Unboxing',
    emoji: '📦',
    group: 'special',
    description: 'Caixa fechada → mãos abrindo → revelação do produto interno.',
    promptHint: 'Hands opening a sealed product box from the top, lifting the lid carefully, revealing the product inside with anticipation, packaging material and product surface clearly visible during the reveal.',
    bestFor: 'Qualquer produto novo na embalagem original — eletrônicos, beleza, presentes.',
  },
];

// ── Grupos (pra organização visual da UI) ────────────────────────────

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
