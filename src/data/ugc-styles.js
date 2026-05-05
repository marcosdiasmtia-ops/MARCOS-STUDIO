// src/data/ugc-styles.js
//
// 11 estilos de apresentação da aba UGC Falante (v3.0).
// 5 origem Trendly + 6 novos virais TikTok BR (fechados na sessão de 01/05/2026).
//
// Cada estilo tem:
//   - id: slug interno em snake_case (usado em mapeamentos, persistência, props)
//   - name: nome em PT-BR pra UI (com acentos)
//   - description: 1 frase explicando como o estilo soa pro usuário
//   - behaviorVibe: texto em INGLÊS usado dentro do bloco [BEHAVIOR] do
//                   prompt do Veo 3. (todo o prompt vai em inglês — só a
//                   fala em si fica em PT-BR no bloco [SPEECH])
//   - tooltip: texto curto pra tooltip da UI
//   - origin: 'trendly' (5 estilos) ou 'tiktok-br' (6 estilos)
//
// IMPORTANTE: ordem importa. Trendly primeiro (familiar), TikTok BR depois
// (diferenciais nossos). Se mudar a ordem aqui, a UI reflete.

export const UGC_STYLES = [
  // ── 5 estilos do Trendly ──────────────────────────────────────────────
  {
    id: 'natural',
    name: 'Natural',
    description: 'Conversa autêntica, como se estivesse falando com uma amiga.',
    behaviorVibe: 'Casual, calm, conversational tone. Talking like to a close friend. Low-key energy, genuine smile, natural pauses between sentences.',
    tooltip: 'Vibe relax, sem pressão. Funciona pra quase tudo.',
    origin: 'trendly',
  },
  {
    id: 'autoridade',
    name: 'Autoridade',
    description: 'Postura de especialista que entende profundamente do produto.',
    behaviorVibe: 'Confident and knowledgeable, slightly serious. Speaks with authority and expertise. Direct eye contact with the camera, measured and deliberate gestures.',
    tooltip: 'Pra produtos onde credibilidade pesa (skincare, suplementos, eletrônicos).',
    origin: 'trendly',
  },
  {
    id: 'amigavel',
    name: 'Amigável',
    description: 'Animada e calorosa, contagiando boa energia.',
    behaviorVibe: 'Warm, smiling, high energy but not over the top. Enthusiastic and welcoming. Frequent smile, light laughter, open and inviting body language.',
    tooltip: 'Pra criar conexão emocional rápida.',
    origin: 'trendly',
  },
  {
    id: 'urgente',
    name: 'Urgente',
    description: 'Sensação de "compre agora ou perca", FOMO ativado.',
    behaviorVibe: 'Energetic and fast-paced speech with mild urgency in the voice. Hand gestures emphasizing "now" and "limited". Confident but slightly rushed delivery.',
    tooltip: 'Pra promoções, ofertas relâmpago, lançamentos com prazo.',
    origin: 'trendly',
  },
  {
    id: 'curioso',
    name: 'Curioso',
    description: 'Tom de descoberta, "olha que coisa interessante eu achei".',
    behaviorVibe: 'Intrigued, exploring expression. Tone of "look what I just found". Slightly raised eyebrows, examining the product with light surprise and genuine curiosity.',
    tooltip: 'Pra produtos novos ou pouco conhecidos pelo público.',
    origin: 'trendly',
  },

  // ── 6 estilos novos virais TikTok BR ──────────────────────────────────
  {
    id: 'storytelling',
    name: 'Storytelling',
    description: 'Conta uma micro-história pessoal antes de revelar o produto.',
    behaviorVibe: 'Narrative voice, like telling a personal story. Pauses for effect to build anticipation. Emotional arc from a problem to a solution. Engaged, drawing the viewer in.',
    tooltip: '"Outro dia aconteceu uma coisa..." — abre o vídeo com gancho de história.',
    origin: 'tiktok-br',
  },
  {
    id: 'comparacao',
    name: 'Comparação',
    description: 'Confronta este produto com um similar ou com o "antes vs depois".',
    behaviorVibe: 'Analytical and slightly playful tone. Visual gestures showing "this vs that". Confident in the comparison verdict. Mild side-eye on the losing option.',
    tooltip: '"Antes eu usava X, agora uso Y..." ou "X vs Y, qual ganha?".',
    origin: 'tiktok-br',
  },
  {
    id: 'confissao',
    name: 'Confissão',
    description: 'Tom de "vou te contar uma coisa", proximidade íntima.',
    behaviorVibe: 'Slightly lowered voice, as if sharing a secret. Closer to the camera. Confidential and conspiratorial tone. Light knowing smile.',
    tooltip: '"Olha, gente, vou confessar uma coisa..." — quebra a 4ª parede.',
    origin: 'tiktok-br',
  },
  {
    id: 'alerta',
    name: 'Alerta',
    description: 'Adverte o público sobre algo importante, urgência leve.',
    behaviorVibe: 'Attention-grabbing opening, slightly serious. Warning tone without being alarmist. Direct eye contact, pointed and emphatic gestures.',
    tooltip: '"Atenção mulheres entre 25-40..." — abre com gancho de alerta.',
    origin: 'tiktok-br',
  },
  {
    id: 'hack',
    name: 'Hack',
    description: 'Mostra um truque ou atalho que economiza tempo, dinheiro ou esforço.',
    behaviorVibe: 'Excited about a discovered trick. "I found out..." vibe. Quick, demonstrative energy. Satisfied smile at the reveal moment.',
    tooltip: '"Descobri esse hack..." — formato de dica/atalho prático.',
    origin: 'tiktok-br',
  },
  {
    id: 'custo_beneficio',
    name: 'Custo-benefício',
    description: 'Foca em quanto vale a pena pelo preço cobrado.',
    behaviorVibe: 'Practical, no-nonsense tone. Talks numbers and value. Slightly impressed by the deal. Calculating gestures, occasional approving nod.',
    tooltip: '"Por esse preço..." — comparação de valor recebido vs preço pago.',
    origin: 'tiktok-br',
  },
];

// ── Mapeamento Categoria → Estilo recomendado (default) ────────────────
// TODO: preencher após definir as 29 categorias em ./ugc-categories.js
// Estrutura final:
//   STYLE_BY_CATEGORY_DEFAULT = { 'category_id': 'style_id', ... }
// (a sessão de arquitetura previu 11 mapeamentos — não 29 — então
//  nem toda categoria precisa default; UI cai em 'natural' se não houver)
export const STYLE_BY_CATEGORY_DEFAULT = {
  // a preencher quando ugc-categories.js estiver pronto
};

// ── Helpers ───────────────────────────────────────────────────────────

export function getStyleById(id) {
  return UGC_STYLES.find((s) => s.id === id) || null;
}

export function getStylesByOrigin(origin) {
  return UGC_STYLES.filter((s) => s.origin === origin);
}

// Pega o estilo recomendado pra uma categoria. Se a categoria não tiver
// mapping explícito, devolve 'natural' como fallback seguro.
export function getDefaultStyleForCategory(categoryId) {
  const styleId = STYLE_BY_CATEGORY_DEFAULT[categoryId] || 'natural';
  return getStyleById(styleId);
}

// Atalhos prontos pra UI (filtros por origem, exibição)
export const STYLES_TRENDLY = UGC_STYLES.filter((s) => s.origin === 'trendly');
export const STYLES_TIKTOK_BR = UGC_STYLES.filter((s) => s.origin === 'tiktok-br');
