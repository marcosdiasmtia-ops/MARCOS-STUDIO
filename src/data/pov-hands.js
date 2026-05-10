// src/data/pov-hands.js
//
// 11 opções de mãos pra POV — 5 femininas + 4 masculinas + 2 especiais.
//
// O wizard tem TOGGLE de modo no passo 5:
//   - 'influencer' (recomendado) — mãos herdam gênero/etnia/pele do perfil
//                                  cadastrado. Marcos só escolhe extras
//                                  (unhas, tatuagem, anel, relógio, pulseira).
//   - 'anonymous' — escolha livre da lista de 11 abaixo.
//
// SEM DEFAULT no toggle: usuário escolhe conscientemente a cada vídeo.
// Confirmado pelo Marcos em 09/05/2026.
//
// Diferencial vs Trendly: modo 'influencer' garante consistência ABSOLUTA
// de marca — "a mão da Lígia" é sempre a mesma em todos os vídeos POV dela.
// Trendly não tem isso (eles só têm mão anônima).
//
// Cada opção tem:
//   - id: slug em snake_case
//   - name: nome em PT-BR pra UI
//   - emoji: emoji representativo
//   - gender: 'female' | 'male' | 'special'
//   - description: 1 frase curta pra UI
//   - handsPrompt: texto em INGLÊS pro prompt do Kling
//                  (descreve a aparência das mãos visíveis no take)
//   - bestFor: exemplos PT-BR de produtos típicos
//
// Referência: 🎬 Arquitetura Aba POV (v1.0) no Notion · seção C4.

// ── Modos do toggle (passo 5 do wizard) ──────────────────────────────

export const POV_HANDS_MODES = [
  {
    id: 'influencer',
    name: 'Da influencer cadastrada',
    emoji: '👤',
    description: 'Mãos herdadas do perfil — consistência absoluta de marca.',
    recommended: true,
  },
  {
    id: 'anonymous',
    name: 'Anônima',
    emoji: '🤚',
    description: 'Escolha livre das 11 opções abaixo.',
    recommended: false,
  },
];

// SEM DEFAULT — Marcos confirmou em 09/05/2026
export const DEFAULT_HANDS_MODE_ID = null;

// ── 11 opções (modo 'anonymous') ─────────────────────────────────────

export const POV_HANDS = [
  // ── 🤚 Femininas (5) ─────────────────────────────────────────────────
  {
    id: 'fem_natural',
    name: 'Femininas naturais',
    emoji: '🤚',
    gender: 'female',
    description: 'Mãos femininas naturais — unhas curtas, sem adornos.',
    handsPrompt: 'Natural feminine hands with neatly trimmed short nails, no nail polish or minimal clear coat, smooth skin texture, no jewelry visible, slim relaxed fingers.',
    bestFor: 'Produto neutro, skincare, alimento, item universal.',
  },
  {
    id: 'fem_unhas_decoradas',
    name: 'Femininas com unhas decoradas',
    emoji: '💅',
    gender: 'female',
    description: 'Unhas longas com nail art colorida ou design moderno.',
    handsPrompt: 'Feminine hands with long manicured nails featuring colorful nail art design, glossy finish catching the light, well-groomed cuticles, no rings, expressive fingertip presence.',
    bestFor: 'Produto trendy, beleza, gadget jovem, vibe TikTok pop.',
  },
  {
    id: 'fem_francesinha',
    name: 'Femininas com francesinha',
    emoji: '💗',
    gender: 'female',
    description: 'Unhas com francesinha clássica — vibe elegante atemporal.',
    handsPrompt: 'Feminine hands with classic French manicure: white tips on a soft pink natural base, medium-length almond shape, glossy clean finish, refined elegant aesthetic, smooth skin.',
    bestFor: 'Joia, perfume, item premium, produto wedding/eventos.',
  },
  {
    id: 'fem_pulseiras_aneis',
    name: 'Femininas com pulseiras / anéis',
    emoji: '💍',
    gender: 'female',
    description: 'Acessórios delicados nas mãos — vibe estilosa.',
    handsPrompt: 'Feminine hands wearing one or two delicate gold or silver thin rings on different fingers, a subtle thin chain bracelet on the wrist, neat short or medium nails, polished refined styling.',
    bestFor: 'Joia, perfume, acessório, item moda.',
  },
  {
    id: 'fem_tatuagem',
    name: 'Femininas com tatuagem delicada',
    emoji: '🌿',
    gender: 'female',
    description: 'Tatuagem fininha discreta no pulso ou dedo.',
    handsPrompt: 'Feminine hands with one delicate fine-line tattoo on the wrist or side of finger (small minimalist design like a thin line, dot or tiny symbol), neat natural nails, modern artistic vibe.',
    bestFor: 'Item alternativo, gadget jovem, produto edgy/cool.',
  },

  // ── 👍 Masculinas (4) ────────────────────────────────────────────────
  {
    id: 'masc_natural',
    name: 'Masculinas naturais',
    emoji: '👍',
    gender: 'male',
    description: 'Mãos masculinas naturais — sem tatuagem nem acessório.',
    handsPrompt: 'Natural masculine hands, well-groomed short nails, no jewelry, no tattoos visible, defined knuckles and fingers, healthy skin texture, neutral relaxed grip.',
    bestFor: 'Produto neutro masculino, eletrônico, ferramenta.',
  },
  {
    id: 'masc_tatuadas',
    name: 'Masculinas tatuadas',
    emoji: '🖤',
    gender: 'male',
    description: 'Tatuagens visíveis na mão ou pulso — vibe edgy.',
    handsPrompt: 'Masculine hands with bold visible tattoos on the back of the hand and wrist (geometric, line work or traditional designs), short clean nails, defined fingers, modern edgy aesthetic.',
    bestFor: 'Gadget tech, gaming, item streetwear, produto urbano.',
  },
  {
    id: 'masc_relogio',
    name: 'Masculinas com relógio',
    emoji: '⌚',
    gender: 'male',
    description: 'Relógio prata ou aço escovado no pulso — vibe profissional.',
    handsPrompt: 'Masculine hands wearing a refined silver or brushed steel wristwatch on the left wrist, watch face partially visible, clean short nails, professional polished aesthetic, no other accessories.',
    bestFor: 'Item premium, eletrônico high-end, perfume masculino.',
  },
  {
    id: 'masc_pulseira',
    name: 'Masculinas com pulseira couro / metal',
    emoji: '🤝',
    gender: 'male',
    description: 'Pulseira de couro marrom ou de elos metálicos.',
    handsPrompt: 'Masculine hands wearing a brown leather wrist cuff or a metal chain bracelet, slightly worn aesthetic suggesting daily use, defined hands, no rings, casual styled vibe.',
    bestFor: 'Item lifestyle, acessório masculino, vibe casual cool.',
  },

  // ── 🧤 Especiais (2) ─────────────────────────────────────────────────
  {
    id: 'luvas_brancas',
    name: 'Luvas brancas',
    emoji: '🧤',
    gender: 'special',
    description: 'Luvas brancas estilo concierge — vibe premium / unboxing.',
    handsPrompt: 'Hands wearing pristine white cotton or satin gloves, no skin visible, premium concierge or jewelry-presentation aesthetic, careful deliberate handling, no creases or wrinkles in the fabric.',
    bestFor: 'Joia premium, item de luxo, unboxing aspiracional.',
  },
  {
    id: 'sem_maos',
    name: 'Sem mãos',
    emoji: '🚫',
    gender: 'special',
    description: 'Produto sozinho em frame — sem mãos visíveis.',
    handsPrompt: 'No hands visible in the frame, product appears alone or moves on its own (placed on surface, suspended by invisible support, or shown in catalog-style isolation), clean professional product photography vibe.',
    bestFor: 'Produto estático, catálogo, vibe e-commerce, decoração.',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

export function getHandsById(id) {
  return POV_HANDS.find((h) => h.id === id) || null;
}

export function getHandsByGender(gender) {
  return POV_HANDS.filter((h) => h.gender === gender);
}

export function getHandsModeById(id) {
  return POV_HANDS_MODES.find((m) => m.id === id) || null;
}

// Atalhos prontos pra UI
export const HANDS_FEMALE = POV_HANDS.filter((h) => h.gender === 'female');
export const HANDS_MALE = POV_HANDS.filter((h) => h.gender === 'male');
export const HANDS_SPECIAL = POV_HANDS.filter((h) => h.gender === 'special');

// Lista todos os ids (útil pra validação cruzada)
export function getAllHandsIds() {
  return POV_HANDS.map((h) => h.id);
}
