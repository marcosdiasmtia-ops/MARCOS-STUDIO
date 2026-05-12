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
// 🔄 Plano v4 (sessão 11/05/2026) — refine completo da aba POV:
//   • Step 6 do PovWizard será renomeado pra "Visual do POV" e ganhará
//     2 dimensões NOVAS além de Câmera+Interação:
//       - Nível de Imperfeição (escala 1-6: polido → cru)
//       - Naturalidade Extra (checkbox booleano)
//   • POV_IMPERFECTIONS exportado como CONSTANTE SEPARADA (não como nova
//     categoria de POV_STYLES) pra manter retrocompat com o PovWizard
//     atual que renderiza POV_STYLE_CATEGORIES diretamente. C1 importará
//     POV_IMPERFECTIONS pra montar a seção separada no Step 6 reformado.
//   • NATURALITY_EXTRA_DIRECTIVE exportado como string única — vai ser
//     injetado no cameraDirective final apenas quando o checkbox estiver
//     ON E o nível de imperfeição escolhido não desabilitar (níveis 4-6
//     já têm naturalidade embutida via disablesNaturality: true).
//
// 🔁 Retrocompatibilidade: POV_STYLES e POV_STYLE_CATEGORIES permanecem
// 100% inalterados. Tudo que é novo está em constantes/exports separados,
// invisível pros consumidores atuais até o C1 atualizar a UI.
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
// Cada imperfeição tem:
//   - id: slug em snake_case
//   - name: nome em PT-BR pra UI
//   - emoji: emoji representativo
//   - level: 1-6 (1 = polido premium; 6 = documentário cru)
//   - description: 1 frase curta pra UI
//   - cameraDirective: texto em INGLÊS com 5-7 micro-comportamentos
//   - bestFor: exemplos PT-BR de produtos típicos
//   - disablesNaturality: boolean (true nos níveis 4-6 — naturalidade
//                         extra já está embutida na própria imperfeição,
//                         então o checkbox no Step 6 deve ficar disabled
//                         com tooltip "já incluído neste nível")
//
// Claude sugere top 2 da lista + 1 customizado no botão "✨ Claude sugere"
// (regra geral arquitetural — D1 do doc de Arquitetura).
//
// Referência: 🎬 Arquitetura Aba POV (v1.0) no Notion · seção C5.
//             📋 Sessão 11/05/2026 — Plano consolidado v4 (refine v4).

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

// ─────────────────────────────────────────────────────────────────────
// 🎚️ POV_IMPERFECTIONS — Plano v4 (Step 6 reformado)
// ─────────────────────────────────────────────────────────────────────
//
// Escala progressiva de polimento visual, de 1 (anúncio premium polido)
// a 6 (documentário cru observacional). Cada nível injeta 5-7
// micro-comportamentos de câmera + iluminação + cor no prompt final do
// Kling, dando textura cinematográfica distinta ao take.
//
// Mapping default Imperfeição (Step 6) → Intensidade Humana (Step 9)
// fica em ./pov-mappings.js (arquivo 7 do Sub-lote A). É overrideable.
//
// 🚦 Compatibilidade com backends: o backend `api/pov-kling-prompts.js`
// será atualizado no Sub-lote B (arquivo 9) pra receber `imperfectionId`
// e injetar o cameraDirective correspondente. Até lá, este array existe
// no frontend mas não é enviado pro backend (frontend ignora silenciosamente).

export const POV_IMPERFECTIONS = [
  {
    id: 'comercial_limpo',
    name: 'Comercial limpo',
    emoji: '🎬',
    level: 1,
    description: 'Anúncio premium polido, zero handheld.',
    cameraDirective: 'Pristine commercial cinematography: locked-off tripod stability, smooth motorized push-in or slow dolly, precise rack-focus pulls between subject and product, controlled three-point studio lighting, flawless framing with rule-of-thirds, color-graded for premium polish, zero handheld feel.',
    bestFor: 'Produto premium, luxo, perfume, joia, relógio, item top-tier.',
    disablesNaturality: false,
  },
  {
    id: 'influencer_polido',
    name: 'Influencer polido',
    emoji: '✨',
    level: 2,
    description: 'Creator profissional alta produção — vibe top creator.',
    cameraDirective: 'Polished influencer aesthetic: gimbal-stabilized smooth motion, gentle slow push-ins with cinematic deceleration, deliberate slow-pan reveals, soft beauty lighting from a key softbox, clean composition with branded styling, color-graded warm and bright, sense of high-effort production.',
    bestFor: 'Skincare, maquiagem, moda, fitness premium, item aspiracional.',
    disablesNaturality: false,
  },
  {
    id: 'tiktok_natural',
    name: 'TikTok natural',
    emoji: '📱',
    level: 3,
    description: 'Vibe creator real sem polimento — feed orgânico.',
    cameraDirective: 'Real creator TikTok aesthetic: handheld phone framing with light natural movement, single ambient room light source, casual eye-level angle, slight reframing mid-take, no post-color-grading just natural exposure, lived-in vibe without overproduction, social-feed authentic energy.',
    bestFor: 'Snack, bebida, gadget, item viral, moda casual, dia-a-dia.',
    disablesNaturality: false,
  },
  {
    id: 'handheld_cru',
    name: 'Handheld cru',
    emoji: '🤳',
    level: 4,
    description: 'Handheld bem visível, orgânico — vibe primeira pessoa.',
    cameraDirective: 'Visible handheld energy: organic shake on every movement, off-axis tilts during pans, motion blur on quick gestures, micro-adjustments in framing as the operator follows the action, slight horizon drift, raw uncorrected color, unrehearsed observational feel.',
    bestFor: 'Produto street, esporte, gadget de uso real, item testado de verdade.',
    disablesNaturality: true,
  },
  {
    id: 'iphone_caseiro',
    name: 'iPhone caseiro',
    emoji: '📸',
    level: 5,
    description: 'Auto-foco e exposição ajustando — vibe filmagem caseira.',
    cameraDirective: 'Home-iPhone aesthetic: visible autofocus hunting between subjects, exposure shifting as the camera moves between light and shadow, mild lens flare from indoor bulbs, slight motion blur from quick movements, vertical framing with occasional crooked angle, no professional polish at all, candid moment.',
    bestFor: 'Comida caseira, descoberta autêntica, item de família, momento espontâneo.',
    disablesNaturality: true,
  },
  {
    id: 'documentario',
    name: 'Documentário',
    emoji: '📺',
    level: 6,
    description: 'Granular, observacional — vibe fly-on-the-wall.',
    cameraDirective: 'Documentary observational aesthetic: visible film grain or sensor noise in low-light areas, wider master-shot framing leaving negative space, fly-on-the-wall passive observation feel, slow rack focus between background and product, natural ambient sound suggestion, longer slower takes, no choreographed motion, unfiltered authenticity.',
    bestFor: 'Storytelling profundo, item artesanal, processo de criação, produto de origem.',
    disablesNaturality: true,
  },
];

// ─────────────────────────────────────────────────────────────────────
// ✨ NATURALIDADE EXTRA — checkbox booleano no Step 6 reformado
// ─────────────────────────────────────────────────────────────────────
//
// Quando ON, esta string é apendada ao cameraDirective final (separada
// por vírgula+espaço) pra dar uma camada extra de naturalidade ao take.
// Equivale ao "N2 — médio" do plano: nem muito polido nem cru demais.
//
// Regra de UX (C1): o checkbox no Step 6 deve ficar DISABLED quando o
// nível de imperfeição escolhido tem disablesNaturality === true
// (níveis 4-6 já incluem naturalidade nativa), com tooltip explicativo.

export const NATURALITY_EXTRA_DIRECTIVE =
  'subtle handheld camera with natural slight shake, minimal motion blur on quick moves, organic micro-adjustments in framing, slight focus breathing on close-ups';

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

// ── Helpers NOVOS (Plano v4) ──────────────────────────────────────────

// Retorna a imperfeição pelo id, ou null.
export function getImperfectionById(id) {
  return POV_IMPERFECTIONS.find((i) => i.id === id) || null;
}

// Retorna a imperfeição por nível (1-6), ou null.
export function getImperfectionByLevel(level) {
  return POV_IMPERFECTIONS.find((i) => i.level === level) || null;
}

// Lista todos os ids de imperfeições (útil pra validação cruzada em
// pov-mappings.js e pra dropdowns no C1).
export function getAllImperfectionIds() {
  return POV_IMPERFECTIONS.map((i) => i.id);
}

// Indica se um id de imperfeição já embute naturalidade nativa.
// True nos níveis 4-6 (handheld_cru, iphone_caseiro, documentario).
// Quando true, o checkbox de Naturalidade Extra deve ficar DISABLED
// na UI do Step 6 (C1) com tooltip explicativo.
export function imperfectionDisablesNaturality(id) {
  const imp = getImperfectionById(id);
  return imp ? !!imp.disablesNaturality : false;
}
