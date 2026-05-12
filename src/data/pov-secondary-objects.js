// src/data/pov-secondary-objects.js
//
// Objetos secundários automáticos pra POV — NOVO arquivo do Plano v4
// (sessão 11/05/2026). Formato O3: combina categoria UGC + cenário POV
// pra enriquecer o prompt do Nano Banana e/ou Kling com objetos contextuais
// que aparecem AO REDOR do produto (não substituem o produto).
//
// 🎯 OBJETIVO
// Vídeos POV ganham realismo quando o produto não fica isolado no frame.
// Café numa cafeteria fica melhor com pastry + laptop fora de foco;
// perfume num closet fica melhor com gold-tone earrings + silk dress.
// Esses elementos secundários:
//   • dão textura ambiental (contexto visível);
//   • criam variação entre takes (cada take usa objetos diferentes);
//   • NÃO competem com o produto pela atenção (sempre fora de foco
//     ou na periferia da composição).
//
// 📐 FORMATO O3
// Dois mappings simétricos com 3 objetos cada:
//   - SECONDARY_OBJECTS_BY_CATEGORY: 29 categorias × 3 objetos
//   - SECONDARY_OBJECTS_BY_SCENARIO: 37 cenários × 3 objetos
//   - Total: 66 mappings (29 + 37) com 198 strings de objetos.
// Sistema pega 1-2 da categoria + 1-2 do cenário, mistura e injeta.
//
// 🎲 MISTURA DETERMINÍSTICA
// `mixSecondaryObjects(categoryId, scenarioId, { count, seed })` retorna
// um array de strings. O seed garante reprodutibilidade (mesmo seed =
// mesmo resultado) e variação entre takes (seeds diferentes = objetos
// diferentes), sem precisar de aleatoriedade global.
//
// 📝 LINGUAGEM
// Todas as strings estão em INGLÊS e em formato curto (2-5 palavras),
// prontas pra serem injetadas direto no prompt do modelo de imagem/vídeo.
// Exemplo: "car keys, wallet, gold-tone earrings".
//
// 🔁 Retrocompatibilidade: arquivo NOVO. Nenhum consumidor importa ainda.
// pov-kling-prompts.js (Sub-lote B, arquivo 9) vai importar pra injetar
// no prompt. Sub-lote A não muda nada na UI.
//
// Referência: 📋 Sessão 11/05/2026 — Plano consolidado v4 (Notion).

// ─────────────────────────────────────────────────────────────────────
// 📦 SECONDARY_OBJECTS_BY_CATEGORY — 29 categorias UGC × 3 objetos
// ─────────────────────────────────────────────────────────────────────
//
// Keys batem com os ids de UGC_CATEGORIES em ./ugc-categories.js.
// Atualize sincronizado com aquele arquivo se categorias forem
// adicionadas/removidas.

export const SECONDARY_OBJECTS_BY_CATEGORY = {
  // ── Beleza & Cuidados Pessoais (5) ──────────────────────────────────
  skincare_facial:    ['cotton pads stack', 'jade face roller', 'small glass dropper bottle'],
  maquiagem:          ['makeup brushes in holder', 'compact mirror', 'lipstick tubes lined up'],
  cabelos:            ['wide-tooth comb', 'silk hair ribbon', 'tortoise-shell hair clip'],
  perfumes:           ['car keys', 'leather wallet', 'silk neck scarf'],
  corpo:              ['loofah sponge', 'wooden body brush', 'folded white towel'],

  // ── Moda Feminina (7) ───────────────────────────────────────────────
  moda_feminina:      ['paper shopping bag', 'open fashion magazine', 'iced coffee cup'],
  lingerie:           ['silk slip on a hanger', 'delicate padded hanger', 'lace fabric folded'],
  fitness:            ['stainless water bottle', 'rolled gym towel', 'phone with earbuds attached'],
  calcados:           ['crumpled tissue paper', 'shoebox lid open', 'silk drawstring pouch'],
  acessorios:         ['gold-tone earrings', 'matte lipstick tube', 'phone face-down'],
  joias:              ['velvet jewelry box open', 'silk pouch', 'thin gold chain coiled'],
  oculos:             ['microfiber cleaning cloth', 'leather glasses case', 'paperback book'],

  // ── Casa & Decoração (5) ────────────────────────────────────────────
  decoracao:          ['hardcover coffee table book', 'small potted plant', 'unlit pillar candle'],
  cozinha:            ['wooden cutting board', 'small ceramic plate', 'linen tea towel'],
  cama_mesa_banho:    ['cream linen pillow', 'eucalyptus sprig in vase', 'ceramic mug'],
  organizacao:        ['stack of small fabric boxes', 'label maker', 'pocket notebook'],
  iluminacao:         ['dimmer switch wall plate', 'coiled extension cord', 'book on side table'],

  // ── Eletrônicos & Tech (4) ──────────────────────────────────────────
  acessorios_celular: ['braided phone charging cable', 'airpods case', 'half-empty coffee cup'],
  audio:              ['phone face-down', 'vinyl record sleeve', 'ceramic mug'],
  eletrodomesticos:   ['steaming mug', 'striped kitchen towel', 'handwritten recipe card'],
  smart_home:         ['phone on a stand', 'small tablet', 'leafy houseplant'],

  // ── Saúde & Bem-estar (4) ───────────────────────────────────────────
  suplementos:        ['water glass with lemon', 'weekly pill organizer', 'rolled yoga mat'],
  massagem:           ['rolled white towel', 'amber essential oil bottle', 'unlit tea-light candle'],
  saude_intima:       ['linen drawstring pouch', 'cotton pads stack', 'silk slip folded'],
  aromaterapia:       ['wooden incense holder', 'small matchbox', 'smooth river pebble'],

  // ── Outras (4) ──────────────────────────────────────────────────────
  pet_shop:           ['ceramic pet bowl', 'colorful chew toy', 'corner of a pet bed'],
  maternidade:        ['soft pastel baby blanket', 'wooden pacifier clip', 'wooden teether ring'],
  papelaria:          ['ringed notebook', 'set of colored pens', 'roll of washi tape'],
  brinquedos:         ['colorful wooden blocks', 'picture book open', 'small plush stuffed animal'],
};

// ─────────────────────────────────────────────────────────────────────
// 🎬 SECONDARY_OBJECTS_BY_SCENARIO — 37 cenários POV × 3 objetos
// ─────────────────────────────────────────────────────────────────────
//
// Keys batem com os ids de POV_SCENARIOS em ./pov-scenarios.js.
// Atualize sincronizado com aquele arquivo se cenários forem
// adicionados/removidos.

export const SECONDARY_OBJECTS_BY_SCENARIO = {
  // ── 💄 Beleza (5) ────────────────────────────────────────────────────
  bancada_marmore:     ['gold-rim drinking glass', 'folded silk hand towel', 'pearl stud earrings'],
  vanity:              ['makeup brushes in a holder', 'lipstick tubes scattered', 'silk hair ribbon'],
  pia_banheiro:        ['folded white hand towel', 'glass tumbler', 'small green plant sprig'],
  'banheiro_bagunçado':['crumpled hand towel', 'half-used skincare bottles', 'hair tie on counter'],
  closet_espelhado:    ['silk dress hanging in background', 'leather handbag on shelf', 'velvet hanger'],

  // ── 💼 Trabalho / Tech (4) ───────────────────────────────────────────
  mesa_escritorio:     ['leather notebook', 'half-full coffee cup', 'wireless mouse'],
  setup_gamer:         ['corner of RGB mechanical keyboard', 'gaming mouse', 'opened energy drink can'],
  estudio_neutro:      ['neutral grey backdrop edge', 'soft shadow gradient on floor', 'clean white acrylic surface'],
  mesa_caotica:        ['crumpled sticky notes', 'tangled phone cable', 'half-drunk mug going cold'],

  // ── 🛋 Casa / Lifestyle (14) ─────────────────────────────────────────
  cozinha_clean:       ['fresh herbs in a small pot', 'wooden cooking spoon', 'linen tea towel'],
  mesa_cafe:           ['coffee mug with foam art', 'flaky croissant on a plate', 'open magazine page'],
  cama_lencol_claro:   ['cream linen pillow', 'eucalyptus sprig', 'paperback book face-down'],
  quarto_noturno:      ['bedside warm lamp glow', 'silk eye mask folded', 'glass of water'],
  mesa_ar_livre:       ['sliced lime on a plate', 'straw fedora hat', 'linen napkin'],
  cafeteria:           ['paper coffee cup with sleeve', 'pastry on a saucer', 'out-of-focus laptop'],
  cozinha_em_uso:      ['chopped vegetables on a board', 'wooden spoon resting in a pot', 'striped tea towel'],
  janela_chuva:        ['steaming mug', 'folded wool blanket', 'paperback novel'],
  cozinha_noturna:     ['half-full wine glass', 'dim under-cabinet light strip', 'dark window reflection'],
  sofa_cozy:           ['chunky knit blanket', 'linen accent cushion', 'steaming mug on side table'],
  mat_yoga:            ['stainless water bottle', 'rolled towel', 'small potted plant'],
  lavanderia:          ['folded white towels stack', 'wooden clothespins in a jar', 'small detergent bottle'],
  aparador_hall:       ['ceramic bowl with keys', 'small unlit candle', 'framed photo'],
  gaveta_organizada:   ['fabric drawer dividers', 'neatly folded scarves', 'small velvet pouch'],

  // ── 🌟 Especial / Criativo (5) ───────────────────────────────────────
  mesa_unboxing:       ['crumpled tissue paper', 'branded silk ribbon', 'thank-you card insert'],
  mesa_bar:            ['lowball glass with ice', 'single large ice cube', 'cocktail napkin'],
  loja_showroom:       ['brand label tag dangling', 'polished display stand', 'mannequin foot in frame'],
  estudio_neon:        ['coiled neon cable', 'LED strip reflection on surface', 'dark glass surface'],
  golden_hour:         ['long warm shadow on surface', 'linen curtain edge in light', 'clear water glass'],

  // ── 🚶 Movimento (6) ─────────────────────────────────────────────────
  rua_urbana:          ['paper coffee cup in hand', 'crossbody bag strap', 'passing pedestrian blur'],
  academia:            ['stainless water bottle', 'sweat towel on bench', 'folded gym towel'],
  elevador:            ['floor button panel softly lit', 'mirror reflection edge', 'metallic handrail'],
  corredor_predio:     ['door number plate', 'patterned floor carpet', 'wall sconce light'],
  entrada_loja:        ['paper shopping bag handles', 'receipt held in hand', 'glass door reflection'],
  dentro_carro:        ['car keys hanging from ignition', 'coffee cup in holder', 'dashboard edge'],

  // ── 🛍 Decoração & Varejo (3) ────────────────────────────────────────
  parede_objetos:      ['minimal wall hook', 'floating shelf edge', 'spotlight beam from above'],
  manequim_feminino:   ['mannequin head profile', 'garment price tag dangling', 'boutique wooden hanger'],
  manequim_masculino:  ['mannequin shoulder edge', 'leather garment tag', 'display shoe nearby'],
};

// ─────────────────────────────────────────────────────────────────────
// 🎲 HELPERS DE MISTURA
// ─────────────────────────────────────────────────────────────────────

// Gera um índice pseudo-aleatório determinístico a partir de um seed.
// Linear Congruential Generator (LCG) simples — repetível e leve.
// Usado internamente por pickN pra escolher elementos sem random global.
function lcgNext(seed) {
  return (seed * 9301 + 49297) % 233280;
}

// Pega N elementos distintos de um array, determinístico por seed.
// Se n >= arr.length, retorna o array todo (copiado).
// Se n <= 0 ou arr vazio, retorna [].
//
// Aplica Knuth multiplicative hash inicial no seed pra distribuir
// seeds consecutivos (0, 1, 2 entre takes) em índices bem diferentes,
// dando variação real entre takes sem precisar de seeds grandes.
function pickN(arr, n, seed) {
  if (!Array.isArray(arr) || arr.length === 0 || n <= 0) return [];
  if (n >= arr.length) return [...arr];
  const result = [];
  const used = new Set();
  // Knuth multiplicative hash (× fração áurea de 2^32) — espalha
  // seeds próximos. `>>> 0` força unsigned 32-bit.
  let s = ((seed + 1) * 2654435761) >>> 0;
  // Salvaguarda: limita iterações pra evitar loop infinito (não deveria
  // acontecer já que `used.size < arr.length` é verificado, mas defensivo).
  let safety = arr.length * 10;
  while (result.length < n && used.size < arr.length && safety-- > 0) {
    s = lcgNext(s);
    const idx = Math.floor((s / 233280) * arr.length);
    if (!used.has(idx)) {
      used.add(idx);
      result.push(arr[idx]);
    }
  }
  return result;
}

// Retorna os 3 objetos secundários de uma categoria (ou [] se id inválido).
export function getSecondaryObjectsForCategory(categoryId) {
  return SECONDARY_OBJECTS_BY_CATEGORY[categoryId] || [];
}

// Retorna os 3 objetos secundários de um cenário (ou [] se id inválido).
export function getSecondaryObjectsForScenario(scenarioId) {
  return SECONDARY_OBJECTS_BY_SCENARIO[scenarioId] || [];
}

// Mistura objetos secundários de categoria + cenário em proporção
// equilibrada. Default: 1 da categoria + 1 do cenário (total 2 objetos).
//
// opts:
//   count: quantos objetos retornar no total (default 2)
//   seed: número pra reprodutibilidade (default 0)
//
// Retorna array de strings. Se id de cat/cen inválido, retorna o que
// conseguir do que for válido (graceful degradation).
//
// Uso típico em pov-kling-prompts.js (Sub-lote B):
//   const objects = mixSecondaryObjects(productCategoryId, scenarioId, {
//     count: 2,
//     seed: takeIndex,  // varia entre takes
//   });
//   const objectsStr = objects.join(', ');
//   // injeta em "background includes: ${objectsStr}, all softly out of focus"
export function mixSecondaryObjects(categoryId, scenarioId, opts = {}) {
  const { count = 2, seed = 0 } = opts;
  const catObjects = getSecondaryObjectsForCategory(categoryId);
  const scnObjects = getSecondaryObjectsForScenario(scenarioId);

  // Divide quase pela metade (ceil pra categoria, floor pra cenário).
  // count=2 → 1+1; count=3 → 2+1; count=4 → 2+2; count=1 → 1+0.
  const fromCat = Math.ceil(count / 2);
  const fromScn = Math.floor(count / 2);

  // Seeds diferentes pros 2 picks pra dar variação real.
  const pickedCat = pickN(catObjects, fromCat, seed);
  const pickedScn = pickN(scnObjects, fromScn, seed + 17);

  return [...pickedCat, ...pickedScn];
}

// Atalho que devolve a string pronta pra injetar no prompt
// (junta com ', '). Equivalente a:
//   mixSecondaryObjects(...).join(', ')
export function mixSecondaryObjectsAsString(categoryId, scenarioId, opts = {}) {
  return mixSecondaryObjects(categoryId, scenarioId, opts).join(', ');
}

// ─────────────────────────────────────────────────────────────────────
// 🧪 VALIDAÇÃO DE COBERTURA
// ─────────────────────────────────────────────────────────────────────

// Valida que todo categoryId e todo scenarioId conhecidos têm mapping.
// Recebe os arrays de IDs pra evitar dependência circular com
// ugc-categories.js e pov-scenarios.js.
//
// Retorna { ok: boolean, errors: string[], summary: {...} }.
// Útil pra rodar no console em dev quando arquivos forem alterados.
export function validateSecondaryObjectsCoverage(allCategoryIds = [], allScenarioIds = []) {
  const errors = [];

  allCategoryIds.forEach((id) => {
    if (!SECONDARY_OBJECTS_BY_CATEGORY[id]) {
      errors.push(`SECONDARY_OBJECTS_BY_CATEGORY: missing category "${id}"`);
    } else if (SECONDARY_OBJECTS_BY_CATEGORY[id].length < 3) {
      errors.push(`SECONDARY_OBJECTS_BY_CATEGORY[${id}]: has only ${SECONDARY_OBJECTS_BY_CATEGORY[id].length} objects (expected ≥3)`);
    }
  });

  allScenarioIds.forEach((id) => {
    if (!SECONDARY_OBJECTS_BY_SCENARIO[id]) {
      errors.push(`SECONDARY_OBJECTS_BY_SCENARIO: missing scenario "${id}"`);
    } else if (SECONDARY_OBJECTS_BY_SCENARIO[id].length < 3) {
      errors.push(`SECONDARY_OBJECTS_BY_SCENARIO[${id}]: has only ${SECONDARY_OBJECTS_BY_SCENARIO[id].length} objects (expected ≥3)`);
    }
  });

  // Sobras: keys que existem aqui mas não nos arrays passados
  const extraCats = Object.keys(SECONDARY_OBJECTS_BY_CATEGORY).filter(
    (k) => !allCategoryIds.includes(k)
  );
  const extraScns = Object.keys(SECONDARY_OBJECTS_BY_SCENARIO).filter(
    (k) => !allScenarioIds.includes(k)
  );

  extraCats.forEach((k) =>
    errors.push(`SECONDARY_OBJECTS_BY_CATEGORY: orphan key "${k}" (not in UGC_CATEGORIES)`)
  );
  extraScns.forEach((k) =>
    errors.push(`SECONDARY_OBJECTS_BY_SCENARIO: orphan key "${k}" (not in POV_SCENARIOS)`)
  );

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      categoriesCovered: Object.keys(SECONDARY_OBJECTS_BY_CATEGORY).length,
      scenariosCovered: Object.keys(SECONDARY_OBJECTS_BY_SCENARIO).length,
      totalMappings:
        Object.keys(SECONDARY_OBJECTS_BY_CATEGORY).length +
        Object.keys(SECONDARY_OBJECTS_BY_SCENARIO).length,
      totalObjects:
        Object.values(SECONDARY_OBJECTS_BY_CATEGORY).reduce((s, a) => s + a.length, 0) +
        Object.values(SECONDARY_OBJECTS_BY_SCENARIO).reduce((s, a) => s + a.length, 0),
    },
  };
}

// Atalho — lista todas as keys de categoria mapeadas.
export function getAllMappedCategoryIds() {
  return Object.keys(SECONDARY_OBJECTS_BY_CATEGORY);
}

// Atalho — lista todas as keys de cenário mapeadas.
export function getAllMappedScenarioIds() {
  return Object.keys(SECONDARY_OBJECTS_BY_SCENARIO);
}
