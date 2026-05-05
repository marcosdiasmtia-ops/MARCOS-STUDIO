// src/data/ugc-scenarios.js
//
// 26 cenários onde a influencer pode gravar o vídeo UGC Falante.
//
// Organizados em 6 grupos:
//   - home (8): cenários domésticos
//   - lifestyle (7): cenários externos do dia-a-dia
//   - store (5): ⭐ BLOCO LOJA — DIFERENCIAL INÉDITO vs Trendly
//   - work (3): trabalho / estúdio
//   - transport (1): dentro do carro
//   - other (2): spa, evento íntimo
//
// Cada cenário tem:
//   - id: slug em snake_case
//   - name: nome em PT-BR pra UI
//   - description: frase curta pra UI (1 linha)
//   - scenarioPrompt: texto em INGLÊS pro bloco [ENVIRONMENT] do prompt
//                     do Veo 3 (descreve cenário, iluminação, atmosfera)
//   - group: id do grupo macro
//   - bestFor: exemplos PT-BR de quando usar

export const UGC_SCENARIOS = [
  // ── 🏠 Casa (8) ──────────────────────────────────────────────────
  {
    id: 'quarto_cama',
    name: 'Quarto / cama',
    description: 'No quarto, na cama, vibe íntima e relaxante.',
    scenarioPrompt: 'In a bedroom, sitting or laying on the bed. Soft warm lighting, cozy bedding visible, casual and intimate atmosphere with personal touches in the background.',
    group: 'home',
    bestFor: 'Confissão, relaxamento, conversa íntima.',
  },
  {
    id: 'sala_sofa',
    name: 'Sala / sofá',
    description: 'Na sala, no sofá, vibe descontraída de casa.',
    scenarioPrompt: 'In a living room, sitting on a comfortable sofa. Natural daylight from windows, casual home decor visible in the background, relaxed at-home atmosphere.',
    group: 'home',
    bestFor: 'Conversa casual, lifestyle, "tô em casa".',
  },
  {
    id: 'cozinha_bancada',
    name: 'Cozinha (bancada)',
    description: 'Em pé na bancada da cozinha, vibe cooking show.',
    scenarioPrompt: 'Standing at a kitchen counter or island, modern bright kitchen background with appliances and cabinetry visible. Clean countertop, natural daylight from windows.',
    group: 'home',
    bestFor: 'Cozinha, hacks, demonstração de produto culinário.',
  },
  {
    id: 'cozinha_mesa',
    name: 'Cozinha (mesa)',
    description: 'Sentada à mesa de jantar, vibe café da manhã.',
    scenarioPrompt: 'Sitting at a dining table in a cozy kitchen or dining area. Warm morning lighting, breakfast or coffee items visible on the table, relaxed homey atmosphere.',
    group: 'home',
    bestFor: 'Café da manhã, suplementos, alimentos.',
  },
  {
    id: 'banheiro_espelho',
    name: 'Banheiro (espelho)',
    description: 'No banheiro, em frente ao espelho, vibe getting-ready.',
    scenarioPrompt: 'In a clean modern bathroom, standing in front of a vanity mirror. Soft cosmetic lighting, beauty products visible on the counter, getting-ready atmosphere.',
    group: 'home',
    bestFor: 'Skincare, maquiagem, rotina de beleza.',
  },
  {
    id: 'closet_guarda_roupa',
    name: 'Closet / guarda-roupa',
    description: 'No closet com roupas penduradas, vibe OOTD.',
    scenarioPrompt: 'In a walk-in closet or in front of an open wardrobe with clothing visible on hangers. Bright soft lighting, organized fashion-focused atmosphere.',
    group: 'home',
    bestFor: 'OOTD, moda, escolhendo look.',
  },
  {
    id: 'home_office',
    name: 'Home office',
    description: 'Em casa no escritório, vibe trabalho/produtividade.',
    scenarioPrompt: 'In a tidy home office workspace with a desk, laptop, and minimal decor visible. Bright daylight, productive professional but personal atmosphere.',
    group: 'home',
    bestFor: 'Eletrônicos, papelaria, autoridade, produtividade.',
  },
  {
    id: 'varanda_terraco',
    name: 'Varanda / terraço',
    description: 'Na varanda ao ar livre, vibe relaxante.',
    scenarioPrompt: 'On an outdoor balcony or terrace with natural daylight, plants or city/garden view in the background. Relaxed open-air atmosphere with soft natural light.',
    group: 'home',
    bestFor: 'Lifestyle, relaxamento, momento zen.',
  },

  // ── 🌳 Lifestyle externo (7) ─────────────────────────────────────
  {
    id: 'cafeteria',
    name: 'Cafeteria',
    description: 'Em uma cafeteria, vibe café da tarde.',
    scenarioPrompt: 'Inside a stylish coffee shop, sitting at a small table with a coffee cup. Warm ambient lighting, blurred customers and barista activity in the background.',
    group: 'lifestyle',
    bestFor: 'Lifestyle, conversas, "tô tomando um café".',
  },
  {
    id: 'restaurante',
    name: 'Restaurante',
    description: 'Em um restaurante, vibe jantar fora.',
    scenarioPrompt: 'Inside a restaurant, sitting at a nicely set table with food or drinks visible. Warm dim lighting, slightly blurred restaurant ambiance in the background.',
    group: 'lifestyle',
    bestFor: 'Alimentos, lifestyle, momentos especiais.',
  },
  {
    id: 'parque',
    name: 'Parque',
    description: 'Em um parque, vibe ar livre, natureza.',
    scenarioPrompt: 'In a green park outdoors, natural sunlight filtering through trees, grass and greenery visible. Relaxed outdoor atmosphere with soft golden lighting.',
    group: 'lifestyle',
    bestFor: 'Fitness, lifestyle, ar livre.',
  },
  {
    id: 'praia',
    name: 'Praia',
    description: 'Na praia, vibe verão, areia e mar.',
    scenarioPrompt: 'On a sunny beach with sand and ocean visible in the background. Bright natural sunlight, warm summery atmosphere, relaxed vacation vibe.',
    group: 'lifestyle',
    bestFor: 'Verão, biquíni, protetor solar, lifestyle.',
  },
  {
    id: 'rua_urbana',
    name: 'Rua urbana',
    description: 'Andando na rua, vibe cidade vivendo.',
    scenarioPrompt: 'On a city street with blurred urban background — buildings, storefronts, occasional passersby. Natural daylight, energetic city atmosphere.',
    group: 'lifestyle',
    bestFor: 'Moda urbana, lifestyle, "tô na rua".',
  },
  {
    id: 'academia',
    name: 'Academia',
    description: 'Na academia, vibe treino, energia ativa.',
    scenarioPrompt: 'Inside a modern gym or fitness studio with equipment and mirrors visible. Bright clean lighting, athletic energetic atmosphere, workout setting.',
    group: 'lifestyle',
    bestFor: 'Fitness, suplementos, moda fitness.',
  },
  {
    id: 'salao_beleza',
    name: 'Salão de beleza',
    description: 'Em um salão de beleza, vibe profissional.',
    scenarioPrompt: 'Inside a beauty salon with cosmetic stations, mirrors, and hair styling tools visible in the background. Bright cosmetic lighting, professional beauty atmosphere.',
    group: 'lifestyle',
    bestFor: 'Cabelos, maquiagem, autoridade em beleza.',
  },

  // ── 🛍️ LOJA — bloco INÉDITO (5) ──────────────────────────────────
  // Diferencial vs Trendly: simular a influencer DENTRO de uma loja física.
  // Pra TikTok Shop, isso é poderoso porque ancora "compra" no contexto.
  {
    id: 'loja_departamento',
    name: 'Loja (corredor)',
    description: 'Em corredor de loja com prateleiras de produtos.',
    scenarioPrompt: 'Inside a clean modern retail store, walking or standing in an aisle with product shelves visible on both sides. Bright commercial lighting, shopping atmosphere.',
    group: 'store',
    bestFor: 'Comparação, descoberta, "achei na loja".',
  },
  {
    id: 'loja_provador',
    name: 'Loja (provador)',
    description: 'No provador da loja, vibe shopping de roupa.',
    scenarioPrompt: 'Inside a clothing store fitting room, mirror visible, hanging clothes in the background. Soft lighting, intimate trying-on atmosphere with retail context.',
    group: 'store',
    bestFor: 'Moda, calçados, "provei na loja".',
  },
  {
    id: 'loja_balcao',
    name: 'Loja (balcão)',
    description: 'No balcão da loja, vibe atendimento, vitrine.',
    scenarioPrompt: 'At a retail counter or display case in a store, products visible behind glass or on the counter. Focused commercial lighting, attentive shopping atmosphere.',
    group: 'store',
    bestFor: 'Joias, eletrônicos, óculos, perfumes.',
  },
  {
    id: 'farmacia',
    name: 'Farmácia / drogaria',
    description: 'Numa farmácia, vibe corredor de skincare/saúde.',
    scenarioPrompt: 'Inside a pharmacy or drugstore aisle with skincare, health, and beauty products on shelves. Bright clinical-friendly lighting, health-focused retail atmosphere.',
    group: 'store',
    bestFor: 'Skincare, suplementos, achados de farmácia.',
  },
  {
    id: 'mercado',
    name: 'Mercado / supermercado',
    description: 'No supermercado, vibe descobrindo produto.',
    scenarioPrompt: 'Inside a supermarket aisle with grocery items on shelves. Bright fluorescent commercial lighting, shopping cart possibly visible, everyday shopping atmosphere.',
    group: 'store',
    bestFor: 'Alimentos, achados, "comprei no mercado".',
  },

  // ── 🎬 Trabalho / Estúdio (3) ────────────────────────────────────
  {
    id: 'estudio_neutro',
    name: 'Estúdio neutro',
    description: 'Fundo de estúdio neutro, vibe profissional.',
    scenarioPrompt: 'In a clean professional studio setting with a neutral seamless backdrop (white, gray, or beige). Controlled studio lighting, minimal distractions, focused atmosphere.',
    group: 'work',
    bestFor: 'Autoridade, conteúdo educativo, peças de roupa.',
  },
  {
    id: 'coworking',
    name: 'Coworking',
    description: 'Em espaço coworking moderno, vibe produtivo.',
    scenarioPrompt: 'Inside a modern coworking space with open workspace, plants, and contemporary office furniture visible. Bright natural lighting, productive creative atmosphere.',
    group: 'work',
    bestFor: 'Eletrônicos, papelaria, autoridade.',
  },
  {
    id: 'backstage',
    name: 'Backstage',
    description: 'Bastidores, vibe "atrás das câmeras".',
    scenarioPrompt: 'Behind-the-scenes setting with visible production equipment, lights, or wardrobe rack in the background. Mixed lighting, candid behind-the-scenes atmosphere.',
    group: 'work',
    bestFor: 'Storytelling, autenticidade, "real life".',
  },

  // ── 🚗 Transporte (1) ────────────────────────────────────────────
  {
    id: 'carro_dentro',
    name: 'Dentro do carro',
    description: 'No banco do motorista do carro, vibe car chat.',
    scenarioPrompt: 'Inside a car, sitting in the driver\'s or passenger seat. Window visible with daylight outside, dashboard partially in frame, casual car-chat atmosphere.',
    group: 'transport',
    bestFor: 'Confissão, conversa rápida, "saindo de algum lugar".',
  },

  // ── ✨ Outros (2) ────────────────────────────────────────────────
  {
    id: 'spa_zen',
    name: 'Spa / sala zen',
    description: 'Em ambiente zen, vibe relaxamento.',
    scenarioPrompt: 'In a calm spa or wellness room with soft warm lighting, candles, plants, or meditation elements visible. Peaceful zen atmosphere, focus on relaxation.',
    group: 'other',
    bestFor: 'Aromaterapia, autocuidado, skincare premium.',
  },
  {
    id: 'evento_jantar',
    name: 'Jantar com amigos',
    description: 'Em jantar íntimo, vibe celebração tranquila.',
    scenarioPrompt: 'At an intimate dinner gathering with friends, softly lit dinner table with food and drinks visible, warm candlelight, celebratory but cozy atmosphere.',
    group: 'other',
    bestFor: 'Lifestyle, momentos especiais, perfumes.',
  },
];

// ── Grupos macro ─────────────────────────────────────────────────────

export const UGC_SCENARIO_GROUPS = [
  { id: 'home',      name: 'Casa',                emoji: '🏠' },
  { id: 'lifestyle', name: 'Lifestyle externo',   emoji: '🌳' },
  { id: 'store',     name: 'Loja (inédito)',      emoji: '🛍️' },
  { id: 'work',      name: 'Trabalho / Estúdio',  emoji: '🎬' },
  { id: 'transport', name: 'Transporte',          emoji: '🚗' },
  { id: 'other',     name: 'Outros',              emoji: '✨' },
];

// ── Helpers ──────────────────────────────────────────────────────────

export function getScenarioById(id) {
  return UGC_SCENARIOS.find((s) => s.id === id) || null;
}

export function getScenariosByGroup(groupId) {
  return UGC_SCENARIOS.filter((s) => s.group === groupId);
}

export function getScenarioGroupById(id) {
  return UGC_SCENARIO_GROUPS.find((g) => g.id === id) || null;
}

// Default sugerido — sala/sofá funciona pra praticamente qualquer estilo
// e é o cenário mais comum em UGC TikTok caseiro.
export const DEFAULT_SCENARIO_ID = 'sala_sofa';

export function getDefaultScenario() {
  return getScenarioById(DEFAULT_SCENARIO_ID);
}

// Atalho pro bloco loja (diferencial vs Trendly — destaque na UI)
export const STORE_SCENARIOS = UGC_SCENARIOS.filter((s) => s.group === 'store');
