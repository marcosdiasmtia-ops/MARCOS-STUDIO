// src/data/ugc-categories.js
//
// 29 categorias do TikTok Shop BR cobertas pela aba UGC Falante.
// Organizadas em 6 grupos macro pra UI: beauty, fashion, home, electronics,
// health, other.
//
// Cada categoria tem:
//   - id: slug em snake_case (id interno)
//   - name: nome em PT-BR pra UI
//   - emoji: emoji representativo (visual rápido na UI)
//   - group: id do grupo macro
//   - recommendedStyleId: id do estilo default em ugc-styles.js (OPCIONAL)
//
// 11 categorias têm recommendedStyleId (1 por estilo, cobrindo os 11
// estilos UGC). As outras 18 não têm — caem em 'natural' como fallback,
// conforme arquitetura UGC Falante v3.0.
//
// O recommendedStyleId é só uma SUGESTÃO pré-selecionada no wizard.
// O usuário sempre pode trocar.

export const UGC_CATEGORIES = [
  // ── Beleza & Cuidados Pessoais (5) ──────────────────────────────────
  { id: 'skincare_facial',  name: 'Skincare facial',          emoji: '🧴',     group: 'beauty', recommendedStyleId: 'autoridade' },
  { id: 'maquiagem',        name: 'Maquiagem',                emoji: '💄',     group: 'beauty', recommendedStyleId: 'amigavel' },
  { id: 'cabelos',          name: 'Cabelos',                  emoji: '💇‍♀️',   group: 'beauty', recommendedStyleId: 'natural' },
  { id: 'perfumes',         name: 'Perfumes',                 emoji: '🌸',     group: 'beauty' },
  { id: 'corpo',            name: 'Cuidado corporal',         emoji: '🧖‍♀️',   group: 'beauty' },

  // ── Moda Feminina (7) ───────────────────────────────────────────────
  { id: 'moda_feminina',    name: 'Roupas femininas',         emoji: '👗',     group: 'fashion' },
  { id: 'lingerie',         name: 'Lingerie e moda íntima',   emoji: '👙',     group: 'fashion', recommendedStyleId: 'confissao' },
  { id: 'fitness',          name: 'Moda fitness',             emoji: '🏋️‍♀️',   group: 'fashion' },
  { id: 'calcados',         name: 'Calçados',                 emoji: '👠',     group: 'fashion', recommendedStyleId: 'comparacao' },
  { id: 'acessorios',       name: 'Acessórios (bolsa, cinto)',emoji: '👜',     group: 'fashion' },
  { id: 'joias',            name: 'Joias e bijuterias',       emoji: '💍',     group: 'fashion', recommendedStyleId: 'urgente' },
  { id: 'oculos',           name: 'Óculos',                   emoji: '🕶️',    group: 'fashion' },

  // ── Casa & Decoração (5) ────────────────────────────────────────────
  { id: 'decoracao',        name: 'Decoração',                emoji: '🛋️',    group: 'home', recommendedStyleId: 'storytelling' },
  { id: 'cozinha',          name: 'Cozinha e utensílios',     emoji: '🍳',     group: 'home', recommendedStyleId: 'hack' },
  { id: 'cama_mesa_banho',  name: 'Cama, mesa e banho',       emoji: '🛏️',    group: 'home' },
  { id: 'organizacao',      name: 'Organização',              emoji: '📦',     group: 'home' },
  { id: 'iluminacao',       name: 'Iluminação',               emoji: '💡',     group: 'home' },

  // ── Eletrônicos & Tech (4) ──────────────────────────────────────────
  { id: 'acessorios_celular', name: 'Acessórios de celular',  emoji: '📱',     group: 'electronics' },
  { id: 'audio',            name: 'Áudio (fones, caixas)',    emoji: '🎧',     group: 'electronics' },
  { id: 'eletrodomesticos', name: 'Eletrodomésticos pequenos',emoji: '☕',     group: 'electronics', recommendedStyleId: 'custo_beneficio' },
  { id: 'smart_home',       name: 'Smart home',               emoji: '🏡',     group: 'electronics', recommendedStyleId: 'curioso' },

  // ── Saúde & Bem-estar (4) ───────────────────────────────────────────
  { id: 'suplementos',      name: 'Suplementos',              emoji: '💊',     group: 'health', recommendedStyleId: 'alerta' },
  { id: 'massagem',         name: 'Massagem e relaxamento',   emoji: '💆‍♀️',   group: 'health' },
  { id: 'saude_intima',     name: 'Saúde íntima feminina',    emoji: '🌷',     group: 'health' },
  { id: 'aromaterapia',     name: 'Aromaterapia',             emoji: '🕯️',    group: 'health' },

  // ── Outras (4) ──────────────────────────────────────────────────────
  { id: 'pet_shop',         name: 'Pet shop',                 emoji: '🐾',     group: 'other' },
  { id: 'maternidade',      name: 'Maternidade e bebê',       emoji: '👶',     group: 'other' },
  { id: 'papelaria',        name: 'Papelaria criativa',       emoji: '✏️',    group: 'other' },
  { id: 'brinquedos',       name: 'Brinquedos e hobbies',     emoji: '🧸',     group: 'other' },
];

// ── Grupos macro (pra organização visual da UI) ──────────────────────

export const UGC_CATEGORY_GROUPS = [
  { id: 'beauty',      name: 'Beleza & Cuidados',     emoji: '💄' },
  { id: 'fashion',     name: 'Moda Feminina',         emoji: '👗' },
  { id: 'home',        name: 'Casa & Decoração',      emoji: '🏠' },
  { id: 'electronics', name: 'Eletrônicos & Tech',    emoji: '📱' },
  { id: 'health',      name: 'Saúde & Bem-estar',     emoji: '💪' },
  { id: 'other',       name: 'Outras',                emoji: '📦' },
];

// ── Helpers ──────────────────────────────────────────────────────────

export function getCategoryById(id) {
  return UGC_CATEGORIES.find((c) => c.id === id) || null;
}

export function getCategoriesByGroup(groupId) {
  return UGC_CATEGORIES.filter((c) => c.group === groupId);
}

export function getCategoryGroupById(id) {
  return UGC_CATEGORY_GROUPS.find((g) => g.id === id) || null;
}

// Pega o estilo recomendado pra uma categoria. Retorna apenas o id do estilo.
// Se a categoria não tiver mapping, retorna 'natural' (fallback seguro).
// Para pegar o objeto-estilo completo, combine com getStyleById de ugc-styles.js.
export function getDefaultStyleIdForCategory(categoryId) {
  const cat = getCategoryById(categoryId);
  return cat?.recommendedStyleId || 'natural';
}

// Quantas categorias têm mapping default explícito (espera-se 11)
export function countMappedCategories() {
  return UGC_CATEGORIES.filter((c) => c.recommendedStyleId).length;
}
