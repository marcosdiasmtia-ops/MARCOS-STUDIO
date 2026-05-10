// src/data/pov-styles.js
//
// 8 estilos de apresentação visual da aba POV — diferentes dos estilos da
// aba UGC Falante (./ugc-styles.js). UGC Falante = estilo de FALA da pessoa
// (natural, autoridade, urgente...). POV = estilo de CÂMERA + iluminação +
// interação com o produto (textura, design, escala, rotação...).
//
// Cobrem 4 abordagens de câmera + 4 abordagens de interação:
//   📷 CÂMERA (4): Textura close-up · Design / acabamento · Detalhes premium · Rotação 360°
//   🤝 INTERAÇÃO (4): Tamanho real (escala) · Funcionalidade / em uso · Aplicação / resultado · Revelação da embalagem
//
// Cada estilo tem:
//   - id: slug em snake_case
//   - name: nome em PT-BR pra UI
//   - emoji: emoji representativo
//   - category: 'camera' | 'interaction'
//   - description: 1 frase curta pra UI
//   - cameraDirective: texto em INGLÊS pra direcionar a câmera no Kling
//                      (movimento, ângulo, profundidade, foco)
//   - bestFor: exemplos PT-BR de produtos típicos
//
// Claude sugere top 2 da lista + 1 customizado no botão "✨ Claude sugere"
// (regra geral arquitetural — D1 do doc de Arquitetura).
//
// Referência: 🎬 Arquitetura Aba POV (v1.0) no Notion · seção C5.

export const POV_STYLES = [
  // ── 📷 Câmera (4) ────────────────────────────────────────────────────
  {
    id: 'textura_closeup',
    name: 'Textura close-up',
    emoji: '🔍',
    category: 'camera',
    description: 'Super zoom em fibras, superfície, material — vibe macro.',
    cameraDirective: 'Extreme close-up macro shot focusing on the texture and material of the product, fibers, weave or surface detail filling most of the frame, shallow depth of field with crisp focus on the surface, slight slow drift across the texture.',
    bestFor: 'Tecido, couro, papel, material premium, skincare em pote.',
  },
  {
    id: 'design_acabamento',
    name: 'Design / acabamento',
    emoji: '🎨',
    category: 'camera',
    description: 'Ângulo lateral revelando estética completa — vibe editorial.',
    cameraDirective: 'Side angle medium shot showing the full design aesthetic of the product, balanced composition with the product centered, soft directional lighting accentuating curves and silhouette, editorial photography vibe with refined framing.',
    bestFor: 'Sapato, bolsa, óculos, joia, item de moda.',
  },
  {
    id: 'detalhes_premium',
    name: 'Detalhes premium',
    emoji: '✨',
    category: 'camera',
    description: 'Close-up em pontos finos: zíper, gravação, costura.',
    cameraDirective: 'Tight close-up on premium fine details (zipper teeth, engraved logo, hand stitching, hardware), camera moves slowly across each detail point one by one, sharp focus on small features, luxurious quality emphasis.',
    bestFor: 'Bolsa premium, relógio, item de luxo, peça artesanal.',
  },
  {
    id: 'rotacao_360',
    name: 'Rotação 360°',
    emoji: '🔄',
    category: 'camera',
    description: 'Produto girando lentamente — vibe e-commerce.',
    cameraDirective: 'Product rotating slowly on its vertical axis a full 360 degrees, smooth continuous turntable motion, even all-around lighting eliminating harsh shadows, e-commerce catalog photography vibe with the product fully revealed from every angle.',
    bestFor: 'Qualquer produto que pede catálogo, sapato, bolsa, eletrônico.',
  },

  // ── 🤝 Interação (4) ─────────────────────────────────────────────────
  {
    id: 'tamanho_real',
    name: 'Tamanho real (escala)',
    emoji: '🤏',
    category: 'interaction',
    description: 'Produto na palma da mão dando referência de tamanho.',
    cameraDirective: 'Product placed on an open palm at chest level for natural scale reference, hand visible giving size context, soft directional lighting on both hand and product, casual relatable composition that communicates dimension intuitively.',
    bestFor: 'Gadget pequeno, joia, miniatura, frasco compacto.',
  },
  {
    id: 'funcionalidade',
    name: 'Funcionalidade / em uso',
    emoji: '⚡',
    category: 'interaction',
    description: 'Produto sendo acionado / operado — vibe demo prática.',
    cameraDirective: 'Product being actively used or operated (button being pressed, lid opening, mechanism engaging), camera close enough to capture the functional moment clearly, real-time motion of the action, demonstrative practical vibe.',
    bestFor: 'Eletrônico, gadget, ferramenta, aparelho com função clara.',
  },
  {
    id: 'aplicacao',
    name: 'Aplicação / resultado',
    emoji: '💧',
    category: 'interaction',
    description: 'Borrifo, batom passando, creme aplicando — vibe before/after.',
    cameraDirective: 'Product being applied or activated (perfume mist spraying, lipstick gliding on lips, cream being smoothed onto skin), capturing the application moment in slow controlled motion, immediate visible result revealed.',
    bestFor: 'Perfume, maquiagem, skincare, produto que tem before/after.',
  },
  {
    id: 'revelacao_embalagem',
    name: 'Revelação da embalagem',
    emoji: '📦',
    category: 'interaction',
    description: 'Caixa / embalagem se abrindo lentamente — vibe unboxing.',
    cameraDirective: 'Product packaging opening in a deliberate slow reveal motion (box lid lifting, plastic seal peeling back, drawer sliding open), the product gradually emerging from inside, anticipation moment with focus on the reveal action.',
    bestFor: 'Qualquer produto novo na embalagem original — vibe unboxing.',
  },
];

// ── Categorias de estilos (pra organização visual da UI) ─────────────

export const POV_STYLE_CATEGORIES = [
  {
    id: 'camera',
    name: 'Câmera',
    emoji: '📷',
    description: 'Abordagens de movimento e ângulo de câmera.',
  },
  {
    id: 'interaction',
    name: 'Interação',
    emoji: '🤝',
    description: 'Abordagens de uso ou contato com o produto.',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

export function getStyleById(id) {
  return POV_STYLES.find((s) => s.id === id) || null;
}

export function getStylesByCategory(categoryId) {
  return POV_STYLES.filter((s) => s.category === categoryId);
}

export function getStyleCategoryById(id) {
  return POV_STYLE_CATEGORIES.find((c) => c.id === id) || null;
}

// Atalhos prontos pra UI
export const STYLES_CAMERA = POV_STYLES.filter((s) => s.category === 'camera');
export const STYLES_INTERACTION = POV_STYLES.filter((s) => s.category === 'interaction');

// Lista todos os ids (útil pra validação cruzada)
export function getAllStyleIds() {
  return POV_STYLES.map((s) => s.id);
}
