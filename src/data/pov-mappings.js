// src/data/pov-mappings.js
//
// Mapeamentos cruzados entre os arquivos de dados da aba POV.
//
// 🔄 Plano v4 (sessão 11/05/2026) — refine completo da aba POV:
//   • TYPE_TO_SCENARIOS_IDEAL expandido pra 22 tipos × 37 cenários
//     (incluindo regra híbrida M3 — automática por motionIntensity +
//     ajustes manuais como reflexo_espelho → closet_espelhado obrigatório).
//   • IMPERFECTION_TO_INTENSITY_DEFAULT novo (mapping Step 6 → Step 9
//     overrideable pelo usuário no PovWizard reformado do C1).
//   • DOCUMENTARIO_INTENSITY_OPTIONS lista as 3 intensidades que o
//     Claude pode escolher quando a imperfeição "documentario" é
//     selecionada (decide baseado no produto/cenário).
//   • validateMappings() expandida pra cobrir os mappings novos
//     (imperfeição e intensidade).
//
// Mappings:
//
//   1. TYPE_TO_SCENARIOS_IDEAL — Tipo → Cenários ideais (filtro inteligente)
//      Cada um dos 22 tipos aponta pra um SUBSET de cenários compatíveis.
//      A UI usa pra DESTACAR ("ideais") os cenários compatíveis com o tipo
//      escolhido — NÃO esconde os outros, só prioriza visualmente.
//      Estratégia híbrida M3: regra automática por motionIntensity +
//      ajustes manuais explícitos.
//
//   2. CATEGORY_TO_TYPE_DEFAULT — Categoria TikTok Shop → Tipo POV default
//      Mapeia as 29 categorias de ./ugc-categories.js pro tipo POV mais
//      natural pra cada uma. Claude pré-seleciona no wizard como sugestão.
//      Usuário pode trocar. NÃO foi alterado no Plano v4 (retrocompat).
//
//   3. IMPERFECTION_TO_INTENSITY_DEFAULT — Imperfeição → Intensidade
//      Quando o usuário escolhe um nível de imperfeição (Step 6 reformado),
//      o PovWizard sugere a intensidade default correspondente (Step 9).
//      O usuário sempre pode trocar. Caso especial: `documentario` mapeia
//      pra `null` — significa que Claude decide entre as 3 opções de
//      DOCUMENTARIO_INTENSITY_OPTIONS baseado no produto/cenário.
//
// VALIDAÇÃO CRUZADA: este arquivo importa ids dos outros pra checar em
// runtime que toda referência aponta pra coisa que existe. Função
// validateMappings() roda os checks e retorna report de inconsistências.
//
// Referência: 🎬 Arquitetura Aba POV (v1.0) no Notion · seções C2 + C3.
//             📋 Sessão 11/05/2026 — Plano consolidado v4 (refine v4).

import { POV_TYPES, getAllTypeIds, getTypeById } from './pov-types.js';
import { POV_SCENARIOS, getAllScenarioIds, getScenarioById } from './pov-scenarios.js';
import { UGC_CATEGORIES } from './ugc-categories.js';
import { POV_IMPERFECTIONS, getAllImperfectionIds } from './pov-styles.js';
import { POV_INTENSITIES, getAllIntensityIds } from './pov-intensities.js';

// ─────────────────────────────────────────────────────────────────────
// 1. TYPE_TO_SCENARIOS_IDEAL — Tipo → Cenários ideais
// ─────────────────────────────────────────────────────────────────────
//
// Cada tipo aponta pra array de scenario_ids ideais. Os cenários NÃO
// listados ficam disponíveis no wizard (não escondemos), só não são
// destacados como "ideais" pra esse tipo.
//
// Critério: combinar a forma física da interação (do tipo) com a
// superfície/atmosfera do cenário, considerando motionIntensity:
//   • motionIntensity 1-2 (estático/leve) → cenários surface close-up
//   • motionIntensity 3 (moderado) → mix surface + environment estático
//   • motionIntensity 4-5 (alta) → cenários environment movement
//
// Ajuste manual M3: reflexo_espelho → closet_espelhado é OBRIGATÓRIO
// (primeira posição), porque o tipo depende do reflexo num espelho.

export const TYPE_TO_SCENARIOS_IDEAL = {
  // ── 🤲 HANDHELD (6) — motionIntensity 1 (estático) ────────────────
  frasco: [
    'bancada_marmore', 'vanity', 'pia_banheiro', 'mesa_cafe',
    'cama_lencol_claro', 'mesa_bar', 'banheiro_bagunçado',
    'aparador_hall', 'gaveta_organizada', 'golden_hour',
  ],
  pote: [
    'bancada_marmore', 'vanity', 'pia_banheiro', 'cozinha_clean',
    'banheiro_bagunçado', 'sofa_cozy', 'cozinha_em_uso',
  ],
  sapatos: [
    'mesa_ar_livre', 'loja_showroom', 'estudio_neutro',
    'closet_espelhado', 'manequim_feminino', 'manequim_masculino',
    'dentro_carro',
  ],
  capinha: [
    'mesa_escritorio', 'setup_gamer', 'estudio_neutro',
    'estudio_neon', 'mesa_caotica', 'dentro_carro',
  ],
  pequeno: [
    'vanity', 'mesa_escritorio', 'setup_gamer', 'estudio_neutro',
    'mesa_unboxing', 'loja_showroom', 'gaveta_organizada',
    'mesa_caotica',
  ],
  close_tatil: [
    // m1 — extreme close-up, surface close-ups
    'bancada_marmore', 'mesa_caotica', 'gaveta_organizada',
    'estudio_neutro', 'aparador_hall',
  ],

  // ── 👔 WORN (3) — motionIntensity 1-2 ──────────────────────────────
  cabide: [
    'cama_lencol_claro', 'loja_showroom', 'estudio_neon',
    'estudio_neutro', 'closet_espelhado',
    'manequim_feminino', 'manequim_masculino', 'parede_objetos',
  ],
  pulso: [
    'bancada_marmore', 'mesa_escritorio', 'mesa_bar',
    'loja_showroom', 'closet_espelhado', 'sofa_cozy',
    'golden_hour',
  ],
  vestindo: [
    'estudio_neutro', 'loja_showroom', 'estudio_neon',
    'mesa_ar_livre', 'closet_espelhado',
    'manequim_feminino', 'manequim_masculino',
  ],

  // ── 🍽 ORAL (1) — motionIntensity 2 ────────────────────────────────
  mordida: [
    'cozinha_clean', 'mesa_cafe', 'mesa_ar_livre', 'mesa_bar',
    'cafeteria', 'sofa_cozy', 'cozinha_em_uso',
    'cozinha_noturna', 'mat_yoga',
  ],

  // ── 🎁 SPECIAL (2) — motionIntensity 1-2 ───────────────────────────
  superficie: [
    'estudio_neutro', 'mesa_escritorio', 'cozinha_clean',
    'loja_showroom', 'mesa_unboxing', 'aparador_hall',
    'gaveta_organizada', 'golden_hour', 'parede_objetos',
  ],
  unboxing: [
    'mesa_unboxing', 'mesa_cafe', 'estudio_neutro', 'sofa_cozy',
  ],

  // ── 🚶 MOVEMENT (3 NOVOS) — motionIntensity 3-5 ────────────────────
  caminhando: [
    // m4 — environments com movimento
    'rua_urbana', 'corredor_predio', 'entrada_loja',
    'cafeteria', 'mesa_ar_livre',
  ],
  correndo: [
    // m5 — atlético/outdoor
    'academia', 'rua_urbana', 'mat_yoga',
  ],
  entrando_ambiente: [
    // m3 — threshold entre fora e dentro
    'entrada_loja', 'corredor_predio', 'dentro_carro',
    'cafeteria', 'rua_urbana',
  ],

  // ── 👋 SOCIAL (2 NOVOS) — motionIntensity 2 ────────────────────────
  mostrando_amigo: [
    'cafeteria', 'mesa_cafe', 'sofa_cozy', 'mat_yoga',
    'cozinha_em_uso', 'mesa_ar_livre',
  ],
  recebendo_produto: [
    'mesa_unboxing', 'cafeteria', 'sofa_cozy', 'dentro_carro',
    'aparador_hall', 'entrada_loja',
  ],

  // ── 🎬 CINEMATIC (1 NOVO) — motionIntensity 2 ──────────────────────
  reflexo_espelho: [
    // 🔒 AJUSTE MANUAL M3: closet_espelhado OBRIGATÓRIO em 1º
    'closet_espelhado', 'banheiro_bagunçado', 'vanity',
    'pia_banheiro', 'elevador',
  ],

  // ── 📖 STORYTELLING (2 NOVOS) — motionIntensity 2-3 ────────────────
  antes_depois: [
    // m3 — 2 estados visuais, ideal pra rotinas skincare/limpeza
    'vanity', 'pia_banheiro', 'banheiro_bagunçado',
    'bancada_marmore', 'mat_yoga', 'cozinha_clean',
  ],
  testando_primeira: [
    // m2 — primeira experiência sensorial
    'mesa_cafe', 'cafeteria', 'cozinha_em_uso',
    'cama_lencol_claro', 'sofa_cozy', 'bancada_marmore',
  ],

  // ── 🛒 SHOPPING (2 NOVOS) — motionIntensity 2-3 ────────────────────
  pegando_prateleira: [
    // m3 — retail/store context
    'loja_showroom', 'parede_objetos', 'manequim_feminino',
    'manequim_masculino', 'cozinha_clean', 'gaveta_organizada',
  ],
  tirando_mochila: [
    // m2 — saca produto de bolsa
    'corredor_predio', 'cafeteria', 'mesa_escritorio',
    'cama_lencol_claro', 'dentro_carro', 'mesa_caotica',
  ],
};

// ─────────────────────────────────────────────────────────────────────
// 2. CATEGORY_TO_TYPE_DEFAULT — Categoria TikTok Shop → Tipo POV default
// ─────────────────────────────────────────────────────────────────────
//
// Sugestão pré-selecionada no passo 3 do wizard quando Marcos escolhe
// uma categoria no passo 2. Usuário pode trocar livremente.
//
// 29 categorias mapeadas (todas as de ugc-categories.js).
// ⚠️ Não foi alterado no Plano v4 — retrocompat 100% com Sub-lote A.

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

// ─────────────────────────────────────────────────────────────────────
// 3. IMPERFECTION_TO_INTENSITY_DEFAULT — Plano v4
// ─────────────────────────────────────────────────────────────────────
//
// Quando o usuário escolhe um nível de Imperfeição no Step 6 reformado
// (POV_IMPERFECTIONS de pov-styles.js), o PovWizard sugere a intensidade
// default correspondente no Step 9 (POV_INTENSITIES de pov-intensities.js).
// O usuário sempre pode trocar.
//
// 🎲 Caso especial `documentario`:
// Quando o usuário escolhe imperfeição `documentario`, o mapping é
// `null` — não há intensidade default fixa. Em vez disso, Claude
// decide entre as 3 opções de DOCUMENTARIO_INTENSITY_OPTIONS baseado
// no produto e cenário escolhidos. Isso porque documentario funciona
// bem com várias vibes vocais diferentes (noturna, contemplativa,
// review honesto).

export const IMPERFECTION_TO_INTENSITY_DEFAULT = {
  comercial_limpo:   'comercial_limpo',
  influencer_polido: 'influencer_natural',
  tiktok_natural:    'tiktok_casual',
  handheld_cru:      'iphone_cru',
  iphone_caseiro:    'amigo_empolgado',
  documentario:      null, // → Claude decide entre DOCUMENTARIO_INTENSITY_OPTIONS
};

// Opções pra Claude escolher quando imperfeição === 'documentario'.
// Todas as 3 são intensidades válidas em POV_INTENSITIES.
export const DOCUMENTARIO_INTENSITY_OPTIONS = [
  'noturna_calma',          // 🌙 soft baixo íntimo
  'luxo_contemplativo',     // 💎 premium sofisticado
  'recomendacao_confiavel', // 🤝 review honesto
];

// ── Helpers — TYPE_TO_SCENARIOS_IDEAL ────────────────────────────────

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

// ── Helpers — CATEGORY_TO_TYPE_DEFAULT ───────────────────────────────

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

// ── Helpers NOVOS (Plano v4) ─────────────────────────────────────────

// Pega o id da intensidade default sugerida pra uma imperfeição.
// Retorna:
//   • intensityId (string) — pra mappings 1-5 (caso normal)
//   • null — pra `documentario` ou imperfeição inexistente
//
// Quando retorna null pra `documentario`, o caller deve chamar
// pickDocumentarioIntensity() ou deixar Claude decidir.
export function getDefaultIntensityIdForImperfection(imperfectionId) {
  // `in` distingue "mappeada explicitamente pra null" (documentario)
  // de "não existe no mapping" (id inválido) — mas pro caller o
  // retorno é o mesmo: null. Útil pra debug.
  return IMPERFECTION_TO_INTENSITY_DEFAULT[imperfectionId] ?? null;
}

// Indica se uma imperfeição é o caso especial "documentario" (que
// requer escolha entre múltiplas intensidades em DOCUMENTARIO_INTENSITY_OPTIONS).
export function isDocumentarioImperfection(imperfectionId) {
  return imperfectionId === 'documentario';
}

// Retorna a lista de intensity_ids válidos quando a imperfeição é
// `documentario`. Útil pro PovWizard mostrar destaque visual nos
// 3 cards de intensidade e pro pov-recommend pedir pro Claude escolher.
export function getDocumentarioIntensityOptions() {
  return [...DOCUMENTARIO_INTENSITY_OPTIONS];
}

// ── Validação cruzada ────────────────────────────────────────────────
//
// Roda em runtime pra garantir que todo id referenciado nos mappings
// realmente existe nos arquivos de origem. Útil pra pegar quebra
// silenciosa quando alguém renomeia um id num arquivo e esquece aqui.
//
// Retorna { ok: bool, errors: [...], summary: {...} }.

export function validateMappings() {
  const errors = [];
  const validTypeIds = new Set(getAllTypeIds());
  const validScenarioIds = new Set(getAllScenarioIds());
  const validCategoryIds = new Set(UGC_CATEGORIES.map((c) => c.id));
  const validImperfectionIds = new Set(getAllImperfectionIds());
  const validIntensityIds = new Set(getAllIntensityIds());

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

  // ── Checks NOVOS (Plano v4) ────────────────────────────────────────

  // 7. IMPERFECTION_TO_INTENSITY_DEFAULT — keys devem existir em POV_IMPERFECTIONS
  Object.keys(IMPERFECTION_TO_INTENSITY_DEFAULT).forEach((impId) => {
    if (!validImperfectionIds.has(impId)) {
      errors.push(`IMPERFECTION_TO_INTENSITY_DEFAULT: imperfection_id "${impId}" não existe em POV_IMPERFECTIONS`);
    }
  });

  // 8. IMPERFECTION_TO_INTENSITY_DEFAULT — values devem existir em POV_INTENSITIES (ou ser null)
  Object.entries(IMPERFECTION_TO_INTENSITY_DEFAULT).forEach(([impId, intId]) => {
    if (intId !== null && !validIntensityIds.has(intId)) {
      errors.push(`IMPERFECTION_TO_INTENSITY_DEFAULT[${impId}]: intensity_id "${intId}" não existe em POV_INTENSITIES`);
    }
  });

  // 9. Coverage — toda imperfeição tem mapping (mesmo que pra null)?
  POV_IMPERFECTIONS.forEach((imp) => {
    if (!(imp.id in IMPERFECTION_TO_INTENSITY_DEFAULT)) {
      errors.push(`POV_IMPERFECTIONS: imperfection "${imp.id}" não tem intensidade default mapeada`);
    }
  });

  // 10. DOCUMENTARIO_INTENSITY_OPTIONS — todos devem existir em POV_INTENSITIES
  DOCUMENTARIO_INTENSITY_OPTIONS.forEach((intId) => {
    if (!validIntensityIds.has(intId)) {
      errors.push(`DOCUMENTARIO_INTENSITY_OPTIONS: intensity_id "${intId}" não existe em POV_INTENSITIES`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      typesWithIdealScenarios: Object.keys(TYPE_TO_SCENARIOS_IDEAL).length,
      categoriesWithTypeDefault: Object.keys(CATEGORY_TO_TYPE_DEFAULT).length,
      totalIdealAssociations: Object.values(TYPE_TO_SCENARIOS_IDEAL).reduce((sum, arr) => sum + arr.length, 0),
      imperfectionsWithIntensityDefault: Object.keys(IMPERFECTION_TO_INTENSITY_DEFAULT).length,
      documentarioOptions: DOCUMENTARIO_INTENSITY_OPTIONS.length,
    },
  };
}
