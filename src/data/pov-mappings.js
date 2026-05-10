// src/data/pov-mappings.js
//
// Mapeamentos cruzados entre os arquivos de dados da aba POV:
//
//   1. TYPE_TO_SCENARIOS_IDEAL — Tipo → Cenários ideais (filtro inteligente)
//      Cada um dos 11 tipos aponta pra um SUBSET de cenários compatíveis.
//      A UI usa pra DESTACAR ("ideais") os cenários compatíveis com o tipo
//      escolhido — NÃO esconde os outros, só prioriza visualmente.
//
//   2. CATEGORY_TO_TYPE_DEFAULT — Categoria TikTok Shop → Tipo POV default
//      Mapeia as 29 categorias de ./ugc-categories.js pro tipo POV mais
//      natural pra cada uma. Claude pré-seleciona no wizard como sugestão.
//      Usuário pode trocar.
//
// VALIDAÇÃO CRUZADA: este arquivo importa ids dos outros pra checar em
// runtime que toda referência aponta pra coisa que existe. Função
// validateMappings() roda os checks e retorna report de inconsistências.
//
// Referência: 🎬 Arquitetura Aba POV (v1.0) no Notion · seções C2 + C3.

import { POV_TYPES, getAllTypeIds, getTypeById } from './pov-types.js';
import { POV_SCENARIOS, getAllScenarioIds, getScenarioById } from './pov-scenarios.js';
import { UGC_CATEGORIES } from './ugc-categories.js';

// ── 1. Tipo → Cenários ideais ────────────────────────────────────────
//
// Cada tipo aponta pra array de scenario_ids ideais. Os cenários NÃO
// listados ficam disponíveis no wizard (não escondemos), só não são
// destacados como "ideais" pra esse tipo.
//
// Critério: combinar a forma física da interação (do tipo) com a
// superfície/atmosfera do cenário.

export const TYPE_TO_SCENARIOS_IDEAL = {
  // 🤲 Mão segurando
  frasco:     ['bancada_marmore', 'vanity', 'pia_banheiro', 'mesa_cafe', 'cama_lencol_claro', 'mesa_bar'],
  pote:       ['bancada_marmore', 'vanity', 'pia_banheiro', 'cozinha_clean'],
  sapatos:    ['mesa_ar_livre', 'loja_showroom', 'estudio_neutro'],
  capinha:    ['mesa_escritorio', 'setup_gamer', 'estudio_neutro', 'estudio_neon'],
  pequeno:    ['vanity', 'mesa_escritorio', 'setup_gamer', 'estudio_neutro', 'mesa_unboxing', 'loja_showroom'],

  // 👔 Vestido / usado
  cabide:     ['cama_lencol_claro', 'loja_showroom', 'estudio_neon', 'estudio_neutro'],
  pulso:      ['bancada_marmore', 'mesa_escritorio', 'mesa_bar', 'loja_showroom'],
  vestindo:   ['estudio_neutro', 'loja_showroom', 'estudio_neon', 'mesa_ar_livre'],

  // 🍽 Uso oral
  mordida:    ['cozinha_clean', 'mesa_cafe', 'mesa_ar_livre', 'mesa_bar'],

  // 🎁 Sem mãos / especiais
  superficie: ['estudio_neutro', 'mesa_escritorio', 'cozinha_clean', 'loja_showroom', 'mesa_unboxing'],
  unboxing:   ['mesa_unboxing', 'mesa_cafe', 'estudio_neutro'],
};

// ── 2. Categoria TikTok Shop → Tipo POV default ──────────────────────
//
// Sugestão pré-selecionada no passo 3 do wizard quando Marcos escolhe
// uma categoria no passo 2. Usuário pode trocar livremente.
//
// 29 categorias mapeadas (todas as de ugc-categories.js).

export const CATEGORY_TO_TYPE_DEFAULT = {
  // ── Beleza & Cuidados (5) ─────────────────────────────────────────
  skincare_facial:    'pote',     // creme em pote dominante
  maquiagem:          'pequeno',  // batom, base, paleta
  cabelos:            'frasco',   // shampoo, condicionador
  perfumes:           'frasco',   // frasco clássico
  corpo:              'pote',     // hidratante em pote

  // ── Moda Feminina (7) ─────────────────────────────────────────────
  moda_feminina:      'cabide',   // roupa pendurada
  lingerie:           'cabide',   // peça pendurada
  fitness:            'cabide',   // legging/top no cabide
  calcados:           'sapatos',  // óbvio
  acessorios:         'pequeno',  // bolsa, cinto pequeno
  joias:              'pulso',    // anel/pulseira no pulso
  oculos:             'vestindo', // óculos sendo colocado

  // ── Casa & Decoração (5) ──────────────────────────────────────────
  decoracao:          'superficie',
  cozinha:            'superficie',  // utensílio na bancada
  cama_mesa_banho:    'superficie',
  organizacao:        'unboxing',    // organizador novo na caixa
  iluminacao:         'superficie',  // luminária na mesa

  // ── Eletrônicos & Tech (4) ────────────────────────────────────────
  acessorios_celular: 'capinha',   // óbvio
  audio:              'pequeno',   // fones em estojo
  eletrodomesticos:   'superficie',
  smart_home:         'superficie',

  // ── Saúde & Bem-estar (4) ─────────────────────────────────────────
  suplementos:        'frasco',    // pote de cápsulas
  massagem:           'pequeno',   // massageador na mão
  saude_intima:       'pequeno',
  aromaterapia:       'frasco',    // óleo essencial

  // ── Outras (4) ────────────────────────────────────────────────────
  pet_shop:           'superficie',
  maternidade:        'superficie',
  papelaria:          'superficie',
  brinquedos:         'unboxing',  // brinquedo novo na caixa
};

// ── Helpers ──────────────────────────────────────────────────────────

// Pega array de scenario_ids ideais pra um tipo. Retorna [] se tipo inválido.
export function getIdealScenarioIdsForType(typeId) {
  return TYPE_TO_SCENARIOS_IDEAL[typeId] || [];
}

// Pega array de objetos-cenário ideais pra um tipo (já hidratados).
export function getIdealScenariosForType(typeId) {
  return getIdealScenarioIdsForType(typeId)
    .map((id) => getScenarioById(id))
    .filter(Boolean);
}

// Verifica se um cenário específico é ideal pra um tipo.
export function isScenarioIdealForType(scenarioId, typeId) {
  return getIdealScenarioIdsForType(typeId).includes(scenarioId);
}

// Pega o tipo POV default sugerido pra uma categoria TikTok Shop.
// Retorna o objeto-tipo completo ou null se categoria não tiver mapping.
export function getDefaultTypeForCategory(categoryId) {
  const typeId = CATEGORY_TO_TYPE_DEFAULT[categoryId];
  return typeId ? getTypeById(typeId) : null;
}

// Pega só o id do tipo default pra uma categoria.
export function getDefaultTypeIdForCategory(categoryId) {
  return CATEGORY_TO_TYPE_DEFAULT[categoryId] || null;
}

// ── Validação cruzada ────────────────────────────────────────────────
//
// Roda em runtime pra garantir que todo id referenciado nos mappings
// realmente existe nos arquivos de origem. Útil pra pegar quebra
// silenciosa quando alguém renomeia um id num arquivo e esquece aqui.
//
// Retorna { ok: bool, errors: [...] }.

export function validateMappings() {
  const errors = [];
  const validTypeIds = new Set(getAllTypeIds());
  const validScenarioIds = new Set(getAllScenarioIds());
  const validCategoryIds = new Set(UGC_CATEGORIES.map((c) => c.id));

  // 1. TYPE_TO_SCENARIOS_IDEAL — keys devem existir em POV_TYPES
  Object.keys(TYPE_TO_SCENARIOS_IDEAL).forEach((typeId) => {
    if (!validTypeIds.has(typeId)) {
      errors.push(`TYPE_TO_SCENARIOS_IDEAL: type_id "${typeId}" não existe em POV_TYPES`);
    }
  });

  // 2. TYPE_TO_SCENARIOS_IDEAL — values (scenario_ids) devem existir em POV_SCENARIOS
  Object.entries(TYPE_TO_SCENARIOS_IDEAL).forEach(([typeId, scenarioIds]) => {
    scenarioIds.forEach((scenarioId) => {
      if (!validScenarioIds.has(scenarioId)) {
        errors.push(`TYPE_TO_SCENARIOS_IDEAL[${typeId}]: scenario_id "${scenarioId}" não existe em POV_SCENARIOS`);
      }
    });
  });

  // 3. CATEGORY_TO_TYPE_DEFAULT — keys devem existir em UGC_CATEGORIES
  Object.keys(CATEGORY_TO_TYPE_DEFAULT).forEach((categoryId) => {
    if (!validCategoryIds.has(categoryId)) {
      errors.push(`CATEGORY_TO_TYPE_DEFAULT: category_id "${categoryId}" não existe em UGC_CATEGORIES`);
    }
  });

  // 4. CATEGORY_TO_TYPE_DEFAULT — values devem existir em POV_TYPES
  Object.entries(CATEGORY_TO_TYPE_DEFAULT).forEach(([categoryId, typeId]) => {
    if (!validTypeIds.has(typeId)) {
      errors.push(`CATEGORY_TO_TYPE_DEFAULT[${categoryId}]: type_id "${typeId}" não existe em POV_TYPES`);
    }
  });

  // 5. Coverage — todo tipo POV tem ao menos 1 cenário ideal?
  POV_TYPES.forEach((type) => {
    const ideals = TYPE_TO_SCENARIOS_IDEAL[type.id];
    if (!ideals || ideals.length === 0) {
      errors.push(`POV_TYPES: type "${type.id}" não tem cenários ideais mapeados`);
    }
  });

  // 6. Coverage — toda categoria UGC tem tipo POV mapeado?
  UGC_CATEGORIES.forEach((category) => {
    if (!CATEGORY_TO_TYPE_DEFAULT[category.id]) {
      errors.push(`UGC_CATEGORIES: category "${category.id}" não tem tipo POV mapeado`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      typesWithIdealScenarios: Object.keys(TYPE_TO_SCENARIOS_IDEAL).length,
      categoriesWithTypeDefault: Object.keys(CATEGORY_TO_TYPE_DEFAULT).length,
      totalIdealAssociations: Object.values(TYPE_TO_SCENARIOS_IDEAL).reduce((sum, arr) => sum + arr.length, 0),
    },
  };
}
