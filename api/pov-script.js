// api/pov-script.js (v3.5 — target em CARACTERES + audio tags reduzidas)
//
// CHANGELOG v3.5 (18/05/2026 — abandono da métrica de palavras):
//   🎯 MUDANÇA FUNDAMENTAL: target do voiceText sai de "palavras" pra
//      "CARACTERES" (~230-250 chars incluindo pontuação + audio tags).
//
//      MOTIVO: 4 versões consecutivas (v3.1 → v3.4) erraram a calibração
//      porque "palavras" engana — a duração real do TTS depende de
//      caracteres totais (incluindo pontuação que vira pausa + audio tags
//      que viram modulação). Dados empíricos da v3.3 vs v3.4:
//        v3.3: 32 palavras / pontuação simples / 2 tags = ~12s áudio
//        v3.4: 37 palavras / pontuação extensa / 3 tags = ~19s áudio
//      Mesmo "palavra média" inflou 60% em duração só por causa de
//      pontuação + tags. Referência oficial ElevenLabs: 1000 chars/min
//      em speed 1.0. Com speed 1.08, 230-250 chars = ~13-14s no slot 15s.
//
//   🎯 AUDIO TAGS REDUZIDAS: 2-4 por voiceText → 1-2 por voiceText.
//      Cada audio tag ([excited], [softly], [gasps]) adiciona ~0.5-1s de
//      pausa/modulação no TTS. 3-4 tags por take somam 2-4s de overflow.
//      1-2 tags mantêm expressividade sem estourar slot.
//
//   📌 Mantém: speed 1.08 (validado natural), estrutura intratake do v3.4
//      (gancho 4s + demo 7s + CTA 3s + 1s respiração), regras de qualidade
//      narrativa (escrever como fala, vírgulas reais, números redondos).
//
//   📌 Retrocompat 100%: schema de input/output inalterado.
//
// CHANGELOG v3.4 (18/05/2026 — refinamento com referência empírica externa):
//   🎯 CALIBRAÇÃO PALAVRAS×TEMPO baseada em referência empírica trazida
//      pelo Marcos: 34-40 palavras = 14-15s em speed 1.0 (vozes BR
//      ElevenLabs). Com speed 1.08 (mantido), vira ~13-14s, deixando 1-2s
//      de respiração natural no slot de 15s. Substitui as estimativas
//      anteriores (v3.3: 30-35 palavras gerou silêncio sobrando).
//
//   🆕 ESTRUTURA INTRATAKE realinhada com referência do TikTok POV:
//      Antes: 0-2s entrada / 2-10s ação CAPS / 10-13s gancho / 13-15s respiro
//      Agora: 0-4s GANCHO / 4-11s DEMO/BENEFÍCIO / 11-14s CTA / 14-15s respiro
//      (gancho mais longo prende viewer mute, CTA curto entrega ação)
//
//   🆕 NOVO BLOCO "QUALIDADE DA NARRAÇÃO" no system prompt — diretrizes
//      pro ElevenLabs PT-BR soar NATURAL (não como anúncio escrito):
//        - Escreve como alguém fala, não como anúncio
//        - Frases curtas com vírgulas reais de respiração
//        - Evita números seguidos sem pausa
//        - Números redondos naturalmente ("cento e setenta" vs "169,99")
//        - Pontuação que respira (vírgula/ponto/reticências bem usadas)
//        - 1 informação por frase
//      Cada regra tem exemplo ✅/❌ pro Claude calibrar bem.
//
//   📌 Retrocompat 100%: schema de input/output inalterado.
//
// CHANGELOG v3.3 (18/05/2026 — ajuste fino pós-validação Parte B):
//   🎯 AJUSTE FINO do voiceText: 26-32 palavras → 30-35 palavras.
//      v3.2 + speed 1.08 (Parte B) resolveu o freeze frame mas inverteu
//      o problema: smoke test gerou áudio total de 24s pra 30s de vídeo
//      (6s silêncio final). Encurtamos roteiro 30% E aceleramos 8% — pressão
//      demais combinada.
//
//      v3.3 sobe pra 30-35 palavras (~12-13s real com speed 1.08), deixando
//      margem de 2-3s no slot que vira respiração natural entre takes, não
//      silêncio percebido. Speed 1.08 mantido (validado como natural no teste).
//
//   📌 Estrutura INTRATAKE re-escalada:
//      0-2s entrada / 2-10s ação CAPS / 10-13s gancho / 13-15s respiração
//
//   📌 Retrocompat 100%: schema de input/output inalterado.
//
// CHANGELOG v3.2 (18/05/2026 — fix pós-smoke-test):
//   🐛 RECALIBRAÇÃO empírica do voiceText após teste em produção:
//      v3.0 estimava "35-45 palavras ≈ 12-14s em PT-BR". Estimativa otimista.
//      Vozes BR (ElevenLabs PT-BR nativas) na verdade levam 14-18s pra ler
//      35-45 palavras (devido a entonação portuguesa + audio tags Eleven v3
//      que adicionam pausas). Resultado: overflow de 4-5s por take ainda
//      gerava freeze frame no final (vídeo 30s + áudio 39s reportado).
//
//      v3.2 ajusta pra ~26-32 palavras (queda de ~30%), calibrado em ~10-12s
//      de fala real. Deixa margem de 3-5s no slot de 15s, mesmo nas vozes
//      mais lentas. Combina com Parte B desta sessão (speed: 1.08 no TTS).
//
//   📌 Estrutura INTRATAKE ajustada pra refletir nova fala (não 100% do slot):
//      0-2s entrada / 2-9s ação CAPS / 9-12s gancho / 12-15s respiração
//
//   📌 Retrocompat 100%: schema de input/output inalterado.
//
// CHANGELOG v3.1 (18/05/2026 — HOTFIX):
//   🐛 FIX BUG INTRODUZIDO NA v3.0:
//      A constante interna DURATION_CONFIG ainda tinha os ids antigos
//      ('20s', '40s') e os counts de takes antigos ('30s': 3, '60s': 6).
//      Resultado: frontend novo pedia '30s' (= 2 takes), backend gerava
//      3 takes, PovOutput dava throw "Roteiro retornou 3 takes, esperado 2".
//
//      Fix: DURATION_CONFIG agora bate 1:1 com src/data/pov-durations.js v2.0:
//        '15s' → 1 take · '30s' → 2 takes · '45s' → 3 takes · '60s' → 4 takes
//      Mensagem de erro da validação e comentário do schema também atualizados.
//
//      Lição: duplicação entre data file e backend é frágil. Idealmente o
//      backend deveria importar de pov-durations.js (mas como é Node em
//      Vercel serverless e o data file é ESM frontend, não dá direto).
//      Refator futuro: extrair pra api/_shared/pov-durations.js.
//
// CHANGELOG v3.0 (18/05/2026):
//   🆕 RECALIBRA voiceText pra 35-45 palavras (≈12-14s de fala PT-BR)
//      Era: 25-30 palavras (≈8-10s) calibrado pra slot de 10s do Kling 2.6 Pro.
//      Agora: 35-45 palavras (≈12-14s) calibrado pra slot de 15s do Kling v3 Std.
//
//      MOTIVO ESTRUTURAL: vozes BR migradas em 13/05/2026 falam ~50% mais
//      devagar que as vozes anglo do core. As mesmas 25-30 palavras em PT-BR
//      duravam 12-15s — estouravam o slot de 10s e geravam freeze frame no
//      final. A migração pra Kling v3 Std 15s (em paralelo nessa sessão)
//      sobe o teto pra 15s, então o voiceText pode crescer proporcionalmente.
//
//      RESULTADO ESPERADO: áudio cabe dentro do slot, vídeo termina junto
//      com a fala, sem freeze frame e sem silêncio sobrando.
//
//   🆕 Estrutura INTRATAKE escalada pra 15s:
//      Antes: 0-2s entrada / 2-7s ação CAPS / 7-10s gancho
//      Agora: 0-3s entrada / 3-11s ação CAPS / 11-15s gancho
//
//   📌 Retrocompat 100%:
//      - Schema de input/output inalterado.
//      - Mudanças são SÓ instruções textuais pro Claude no system prompt.
//      - PovOutput chama esse endpoint exatamente igual.
//
// CHANGELOG v2.0 (12/05/2026 — Plano v4, Sub-lote B):
//   🆕 Aceita `intensityId` (opcional, só relevante se audioMode='voiced').
//      Quando fornecido, injeta o speechStyle correspondente no system
//      prompt — orientando Claude sobre tom/ritmo/energia da fala.
//      9 intensidades reconhecidas (de POV_INTENSITIES, pov-intensities.js).
//   🆕 Schema de output EXPANDIDO (com retrocompat completa):
//      • descriptions: array de 3 com vibes diferentes (descoberta, solução, estética)
//      • ctaVariants: array de 3 com strategies (direto, engajamento, fomo)
//      • tagline: frase de posicionamento (5-8 palavras)
//      • capcut: { hookCapa, headline, popCaptions[5], suggestedComments[3] }
//      • Mantém `description`, `ctaWritten`, `hashtags`, `script`,
//        `audioMode`, `voiceId` exatamente como antes (PovOutput atual
//        continua funcionando sem mudar).
//   🆕 Prompt do Claude REESCRITO pra produzir roteiro com formato
//      TikTok falado autêntico (Camada 1 do Plano v4):
//      • Frases QUEBRADAS em blocos de 4-8 palavras (separadas por '...' ou '—')
//      • 1-2 reações por take ('mano', 'tipo', 'pera', 'olha isso', 'nossa', 'CARA')
//      • CAPS em palavras de ênfase (ex: 'isso aqui é MUITO bom')
//      • Audio tags Eleven v3: 2-4 por take (era 1-2)
//      • Estrutura intratake (0-2s entrada → 2-7s ação CAPS → 7-10s gancho)
//      • Texto deve REAGIR/antecipar ao que aparece visualmente
//      • ZERO frase explicativa estilo "produto possui acabamento premium"
//   🆕 TYPE_DESCRIPTIONS expandido pra 22 tipos (era 11) — inclui os
//      11 tipos novos do Plano v4 (close_tatil, caminhando, correndo,
//      entrando_ambiente, mostrando_amigo, recebendo_produto,
//      reflexo_espelho, antes_depois, testando_primeira,
//      pegando_prateleira, tirando_mochila).
//   🆕 max_tokens aumentado pra 4096 (era 2048) porque o output cresceu.
//
// CHANGELOG v1.1 (10/05/2026):
//   - Fix dimensionamento do voiceText: 8-15 palavras → 25-30 palavras (~8-10s).
//
// Endpoint que gera o ROTEIRO COMPLETO + PACOTE PÓS-PRODUÇÃO pro vídeo POV.
// Claude analisa (produto, tipo, cenário, estilo, duração, modo de áudio,
// intensidade opcional) e devolve:
//   - script: array de N takes (cada um com voiceText? + onScreenPhrase? + purpose)
//   - description + descriptions (3 vibes)
//   - hashtags: 6-10 hashtags PT-BR
//   - ctaWritten + ctaVariants (3 strategies)
//   - tagline (5-8 palavras de posicionamento)
//   - capcut: pacote pra produção no CapCut (hookCapa, headline, popCaptions, suggestedComments)
//
// MODO DE ÁUDIO (decisão crítica que muda o roteiro inteiro):
//   - 'silent'  → vídeo MUDO. voiceText sempre null. Conteúdo nas onScreenPhrases.
//   - 'voiced'  → narração off com Eleven v3 + audio tags inline.
//
// Espelha o padrão de api/ugc-script.js (validado em produção).
//
// REQUEST:
//   POST /api/pov-script
//   Body: {
//     productName: string,
//     productDescription?: string,
//     productPrice?: string,
//     productOriginalPrice?: string,
//     categoryId: string,                    // de ugc-categories.js
//     typeId: string,                        // de pov-types.js (22 ids válidos)
//     scenarioId: string,                    // de pov-scenarios.js
//     styleId: string,                       // de pov-styles.js
//     durationId: '15s' | '30s' | '45s' | '60s',
//     audioMode: 'silent' | 'voiced',
//     voiceId?: string,                      // só se audioMode='voiced'
//     intensityId?: string,                  // 🆕 só se audioMode='voiced' (9 ids válidos)
//     influencer?: { name?, gender? },       // pra contexto
//     previousScripts?: array,               // não repetir scripts anteriores
//     trendData?: string,                    // dados de tendências (futuro)
//   }
//
// RESPONSE:
//   200: {
//     audioMode, voiceId?, intensityId?,
//     script: [...],
//     description, descriptions: [...3],
//     hashtags: [...],
//     ctaWritten, ctaVariants: [...3],
//     tagline,
//     capcut: { hookCapa, headline, popCaptions: [...5], suggestedComments: [...3] },
//     source
//   }
//   400: { error: <mensagem> }
//   500: { error: <mensagem> }

// ════════════════════════════════════════════════════════════════════════
// Constantes
// ════════════════════════════════════════════════════════════════════════

// durationId → { takes, hookCount, demoMin, demoMax, ctaCount }
// v3.1 (18/05/2026): alinhado com pov-durations.js v2.0 (Kling v3 Standard 15s).
const DURATION_CONFIG = {
  '15s': { takes: 1, hookCount: 1, demoMin: 0, demoMax: 0, ctaCount: 1 },
  '30s': { takes: 2, hookCount: 1, demoMin: 0, demoMax: 1, ctaCount: 1 },
  '45s': { takes: 3, hookCount: 1, demoMin: 1, demoMax: 1, ctaCount: 1 },
  '60s': { takes: 4, hookCount: 1, demoMin: 1, demoMax: 2, ctaCount: 1 },
};

const VALID_AUDIO_MODES = ['silent', 'voiced'];

// Audio tags válidas Eleven v3 (espelho de pov-elevenlabs-voices.js)
const VALID_AUDIO_TAGS = [
  // emotional
  'happy', 'sad', 'excited', 'angry', 'sarcastically', 'nervous', 'confident',
  // delivery
  'whispers', 'shouting', 'slowly', 'quickly', 'softly',
  // nonVerbal
  'laughs', 'chuckles', 'sighs', 'gasps', 'coughs', 'gulps', 'applause',
];

// Descrições curtas pro Claude (pra ele escrever no tom certo do estilo)
// 8 estilos POV (pov-styles.js — não mudou no Plano v4).
const STYLE_DESCRIPTIONS = {
  textura_closeup:     'super zoom em fibras/superfície/material — vibe macro observacional',
  design_acabamento:   'ângulo lateral revelando estética — vibe editorial refinada',
  detalhes_premium:    'close em zíper/gravação/costura — vibe luxo storytelling',
  rotacao_360:         'produto girando 360° — vibe e-commerce / catálogo',
  tamanho_real:        'produto na palma da mão pra dar referência de tamanho',
  funcionalidade:      'produto sendo acionado/operado — vibe demo prática',
  aplicacao:           'borrifo/passando/aplicando — vibe before/after expressivo',
  revelacao_embalagem: 'caixa abrindo lentamente — vibe unboxing anticipation',
};

// Descrições curtas dos 22 tipos POV (espelho de pov-types.js Plano v4).
// Os 11 originais + 11 novos.
const TYPE_DESCRIPTIONS = {
  // 🤲 HANDHELD (6)
  frasco:               'mão segurando frasco/garrafa pelo corpo',
  pote:                 'pote sendo aberto, tampa removida',
  sapatos:              'sapato exibido na mão',
  capinha:              'gadget/capinha segurado pela borda',
  pequeno:              'estojo aberto revelando produto pequeno',
  close_tatil:          'mão apertando/comprimindo textura do produto (close-up extremo)',
  // 👔 WORN (3)
  cabide:               'roupa pendurada no cabide',
  pulso:                'produto no pulso (relógio/pulseira/anel)',
  vestindo:             'produto sendo colocado/vestido',
  // 🍽 ORAL (1)
  mordida:              'produto sendo mordido/comido/bebido',
  // 🎁 SPECIAL (2)
  superficie:           'produto estático em superfície (sem mãos)',
  unboxing:             'caixa sendo aberta, produto revelado',
  // 🚶 MOVEMENT (3)
  caminhando:           'pessoa andando com produto na mão (street style)',
  correndo:             'pessoa em movimento atlético com produto visível',
  entrando_ambiente:    'pessoa entrando em ambiente carregando o produto',
  // 👋 SOCIAL (2)
  mostrando_amigo:      'mostrando o produto pra outra pessoa que reage',
  recebendo_produto:    'recebendo o produto de outra pessoa (presente/handoff)',
  // 🎬 CINEMATIC (1)
  reflexo_espelho:      'produto aparece pelo reflexo num espelho',
  // 📖 STORYTELLING (2)
  antes_depois:         '2 takes mostrando transformação com o produto',
  testando_primeira:    'primeira experiência sensorial com o produto',
  // 🛒 SHOPPING (2)
  pegando_prateleira:   'mão pegando produto numa prateleira/loja',
  tirando_mochila:      'mão tirando produto de bolsa/mochila',
};

// 🆕 Intensidades de voz (9 níveis — espelho de pov-intensities.js).
// Cada chave mapeia pra um speechStyle em inglês que orienta Claude
// sobre o tom/ritmo/energia da fala. Só relevante se audioMode='voiced'.
const INTENSITY_SPEECH_STYLES = {
  comercial_limpo:
    'Polished commercial voice-over delivery with controlled pacing, neutral confident emotion, crisp articulation, broadcast quality. Smooth even cadence, no slang or hesitation, no reactions or filler words. The voice should feel like a professional ad spot.',
  influencer_natural:
    'Polished influencer delivery with warm friendly energy, careful articulation, controlled enthusiasm, conversational but produced. Some natural inflection on key words, occasional smile in the voice, no rough edges or sudden volume jumps. The voice should feel like a top creator on a sponsored post.',
  tiktok_casual:
    'Real creator TikTok delivery: conversational and casual, broken sentences with natural pauses, occasional small reactions like "olha", "tipo", "mano", words emphasized naturally without screaming, energetic but not overproduced. The voice should feel like a real TikTok creator on a non-sponsored post talking to friends.',
  iphone_cru:
    'Spontaneous home-iPhone delivery: unrehearsed first-take feel, light verbal stumbling, mid-sentence corrections, genuine in-the-moment reactions ("nossa", "pera", "espera"), variable volume as if moving the phone around, candid moment vibe with zero polish. The voice should feel like someone recording on their phone without thinking.',
  amigo_empolgado:
    'Enthusiastic-friend delivery: high energy excitement, lots of words in CAPS for emphasis ("CARA", "OLHA ISSO", "GENTE"), quick reactive pace, natural laughs and gasps sprinkled in, infectious sharing-a-discovery vibe. The voice should feel like a friend who just found something amazing and is texting you to come see.',
  noturna_calma:
    'Calm-night-routine delivery: soft low volume close to a whisper, slow contemplative pacing with deliberate pauses, intimate close-to-microphone feel, occasional small sighs of contentment, ASMR-adjacent texture. The voice should feel like winding down at the end of the day, low-energy and self-care focused.',
  luxo_contemplativo:
    'Luxury-contemplative delivery: refined sophisticated pacing with deliberate dramatic pauses between phrases, premium magazine voice-over quality, low-mid volume with rich tonal depth, selective vocabulary, observational reverence for the product. The voice should feel like a high-end editorial narrating an object of desire.',
  hype_urgente:
    'Hype-urgency delivery: fast rapid pace, urgent shouting energy on key phrases ("VAI ACABAR", "CORRE", "ÚLTIMA UNIDADE"), short staccato phrases, FOMO pressure with breath-skipping rhythm, viral drop atmosphere. The voice should feel like a streetwear drop reveal — urgent, exclusive, time-pressured.',
  recomendacao_confiavel:
    'Trusted-recommendation delivery: honest balanced tone, measured confident pacing, conversational "I tested this and here is what I think" vibe, occasional softer reflective moments showing genuine thought, friend-giving-honest-advice atmosphere. The voice should feel like a knowledgeable friend who would not recommend something they did not actually use.',
};

const VALID_INTENSITY_IDS = Object.keys(INTENSITY_SPEECH_STYLES);

// ════════════════════════════════════════════════════════════════════════
// Handler
// ════════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const {
      productName,
      productDescription = '',
      productPrice = '',
      productOriginalPrice = '',
      categoryId = '',
      typeId,
      scenarioId,
      styleId,
      durationId,
      audioMode = 'silent',
      voiceId = null,
      intensityId = null,  // 🆕 Plano v4
      influencer = {},
      previousScripts = [],
      trendData = '',
    } = req.body || {};

    // ── Validação ────────────────────────────────────────────────────
    if (!productName) return res.status(400).json({ error: 'productName is required' });
    if (!typeId) return res.status(400).json({ error: 'typeId is required' });
    if (!scenarioId) return res.status(400).json({ error: 'scenarioId is required' });
    if (!styleId) return res.status(400).json({ error: 'styleId is required' });
    if (!DURATION_CONFIG[durationId]) {
      return res.status(400).json({ error: 'durationId must be 15s | 30s | 45s | 60s' });
    }
    if (!VALID_AUDIO_MODES.includes(audioMode)) {
      return res.status(400).json({ error: 'audioMode must be "silent" or "voiced"' });
    }
    if (audioMode === 'voiced' && !voiceId) {
      return res.status(400).json({ error: 'voiceId is required when audioMode="voiced"' });
    }
    // intensityId: validação leve. Se fornecido e inválido, ignora silenciosamente
    // (não quebra) — comportamento equivalente ao "sem intensidade". Loga warning.
    let finalIntensityId = null;
    if (audioMode === 'voiced' && intensityId) {
      if (VALID_INTENSITY_IDS.includes(intensityId)) {
        finalIntensityId = intensityId;
      } else {
        console.warn(`[pov-script v2.0] Invalid intensityId "${intensityId}" — ignored (using default voice tone).`);
      }
    }

    const config = DURATION_CONFIG[durationId];
    const totalTakes = config.takes;
    const styleDesc = STYLE_DESCRIPTIONS[styleId] || styleId;
    const typeDesc = TYPE_DESCRIPTIONS[typeId] || typeId;

    // ── Monta prompt ─────────────────────────────────────────────────
    const audioTagsList = audioMode === 'voiced'
      ? `\nAUDIO TAGS DISPONÍVEIS (Eleven v3) — use embutido em voiceText: ${VALID_AUDIO_TAGS.map(t => `[${t}]`).join(', ')}`
      : '';

    // 🆕 Bloco de intensidade — só se voiced + intensityId válido.
    const intensityBlock = finalIntensityId
      ? `\n\nINTENSIDADE DE FALA (Plano v4): ${finalIntensityId}
${INTENSITY_SPEECH_STYLES[finalIntensityId]}
→ O voiceText deve seguir EXATAMENTE essa vibe. Audio tags, ritmo e CAPS devem refletir essa intensidade.`
      : '';

    const audioModeBlock = audioMode === 'silent'
      ? `MODO DE ÁUDIO: SILENT (vídeo MUDO, vibe POV TikTok puro)
- voiceText DEVE SER null em TODOS os takes
- TODO o conteúdo verbal vai em onScreenPhrases
- Distribuição obrigatória das frases on-screen:
  * Hook: 1 frase no take 1 (chamada que prende em 1-3s)
  * Demo: ${config.demoMin}-${config.demoMax} frase(s) nos takes intermediários
  * CTA: 1 frase no último take (take ${totalTakes})
- Frases on-screen curtas (max 5-7 palavras), com 1 emoji pop opcional
- TOTAL de frases on-screen: ${config.hookCount + config.demoMin + config.ctaCount} a ${config.hookCount + config.demoMax + config.ctaCount}`
      : `MODO DE ÁUDIO: VOICED (narração off com voz "${voiceId}" do Eleven v3)
- voiceText DEVE estar PREENCHIDO em TODOS os ${totalTakes} takes
- Cada voiceText: ~230-250 CARACTERES totais (incluindo pontuação, espaços e audio tags)
  IMPORTANTE: o ElevenLabs cobra e mede em CARACTERES, não palavras (referência oficial: 1000 chars/min em speed 1.0).
  Com speed 1.08, 230-250 caracteres ≈ 13-14s de áudio real, deixando 1-2s de respiração no slot de 15s.
  CRÍTICO: conte tudo — letras, vírgulas, pontos, espaços, audio tags como "[excited]". Pontuação e audio tags ADICIONAM tempo de áudio (pausas, modulação), por isso entram na contagem.
  CALIBRAÇÃO EMPÍRICA: validado em produção. 32 palavras com pontuação simples = ~12s (silêncio sobrou). 37 palavras com pontuação extensa e 3 audio tags = ~19s (estourou). Medir em caracteres elimina essa variabilidade.

🎤 FORMATO TIKTOK FALADO (regras OBRIGATÓRIAS — Plano v4):
- Frases QUEBRADAS em blocos de 4-8 palavras (separadas por "..." ou "—")
  ✅ "Cara... olha isso aqui — isso é MUITO bom... sério"
  ❌ "Olá pessoal, hoje vamos falar sobre um produto incrível que vai mudar sua vida"
- 1-2 REAÇÕES por take ("mano", "tipo", "pera", "olha isso", "nossa", "CARA", "gente")
- CAPS em palavras de ÊNFASE (não shouting o tempo todo — só na palavra-chave)
  ✅ "isso aqui é MUITO bom"
  ✅ "VAI ACABAR rápido"
  ❌ "ISSO AQUI É MUITO BOM" (CAPS demais)
- 1-2 audio tags POR voiceText (REDUZIDO de 2-4 na v3.5 — cada tag adiciona ~0.5-1s de pausa/modulação no TTS, estourando o slot)
  ✅ "[excited] Olha isso, gente! Sério, viu... dá uma olhada"
  ✅ "[gasps] Cara... isso aqui é absurdo. Não tô brincando."
  ❌ "[gasps] [excited] Olha! [softly] sério... [confident] olha aí" (4 tags = +3s de pausas = estoura)
- Estrutura INTRATAKE (cada take de 15s, fala ocupa ~13-14s + ~1-2s de respiração):
  * 0-4s: GANCHO curto (reação/hesitação + chamada que prende — "cara, olha isso", "eita, viu", "pera aí")
  * 4-11s: DEMONSTRAÇÃO/BENEFÍCIO (palavra-chave em CAPS, característica concreta do produto)
  * 11-14s: CTA curto ("agora vem o melhor", "tá saindo por...", "olha o preço")
  * 14-15s: respiração natural (microsilêncio antes do próximo take)
- Texto deve REAGIR ao que aparece visualmente. Antecipa, comenta, reage.
- ❌ ZERO frase explicativa formal estilo "produto possui acabamento premium",
     "este item oferece", "vamos analisar". É CONVERSA, não anúncio.

🗣️ QUALIDADE DA NARRAÇÃO (regras OBRIGATÓRIAS — pra voz soar NATURAL no ElevenLabs):
- ESCREVA COMO ALGUÉM FALA, NÃO COMO ANÚNCIO ESCRITO.
  ✅ "Cara, olha só. Essa parafusadeira aqui... arranca parafuso enferrujado sem esforço."
  ❌ "Apresentamos a parafusadeira brushless com torque superior."
- FRASES CURTAS, com vírgulas reais de respiração — o ElevenLabs RESPEITA pontuação.
  ✅ "Olha, isso aqui é absurdo. Sério, viu. Vem com duas baterias e maleta completa."
  ❌ "Esse produto possui duas baterias e maleta completa com torque absurdo de quatrocentos e cinquenta newton metro."
- EVITE números seguidos sem pausa. Quebre com vírgulas ou palavras de quebra.
  ✅ "Tem torque de 450 newton, viu. E vem com duas baterias."
  ❌ "Torque de 450NM com 48V e 2 baterias e 12 acessórios."
- NÚMEROS REDONDOS NATURALMENTE. Prefere "menos de cento e setenta" a "169,99".
  ✅ "Tá saindo por menos de cento e setenta"
  ❌ "Por apenas R$ 169,99"
- USE pontuação que respira: vírgulas pra pausa curta, ponto pra pausa longa, "..." pra hesitação.
  ✅ "Cara... olha isso. Sério, viu. Tá absurdo."
  ❌ "Cara olha isso sério viu ta absurdo"
- 1 informação concentrada por frase, NUNCA várias coladas.
  ✅ "Torque absurdo. E o melhor? Bateria dura horas."
  ❌ "Torque absurdo e bateria que dura horas e ainda vem com maleta e acessórios."

- onScreenPhrases COMPLEMENTAM o áudio (não duplicam):
  * Hook: 1 frase no take 1 (gancho visual curto)
  * Demo: 0-${config.demoMax} frase(s) opcionais nos intermediários (ponto-chave reforçado)
  * CTA: 1 frase no último take${audioTagsList}${intensityBlock}`;

    const previousScriptsBlock = previousScripts.length > 0
      ? `\n\nVÍDEOS ANTERIORES DESTE PRODUTO (NÃO repita o tom/conteúdo):\n${previousScripts.slice(0, 3).map((s, i) => `${i + 1}. ${typeof s === 'string' ? s : JSON.stringify(s).substring(0, 200)}`).join('\n')}`
      : '';

    const trendBlock = trendData ? `\n\nDADOS DE TENDÊNCIA (incorpore se fizer sentido):\n${trendData.substring(0, 500)}` : '';

    const priceBlock = productPrice
      ? `\nPreço: R$ ${productPrice}${productOriginalPrice ? ` (de R$ ${productOriginalPrice})` : ''}`
      : '';

    const systemPrompt = `Você é um copywriter especialista em vídeos UGC POV pra TikTok Shop em PT-BR.

MISSÃO: gerar o roteiro COMPLETO + PACOTE PÓS-PRODUÇÃO de um vídeo POV de afiliação.
POV = vídeo curto onde aparecem só as mãos interagindo com o produto (sem rosto).
Vibe TikTok autêntica, NUNCA propaganda formal.

TIPO POV: ${typeDesc}
ESTILO DE CÂMERA: ${styleDesc}
DURAÇÃO: ${durationId} (${totalTakes} takes de 15s cada, concatenados sem transição)

${audioModeBlock}

REGRAS DE CONTEÚDO (válidas pros 2 modos):
1. PT-BR coloquial brasileiro (não europeu) — "tô", "pra", "viu", "gente"
2. Direto, sem floreio. Sem "Olá pessoal" formal.
3. Cada take tem um propósito claro: hook | demo | cta
4. CTA NUNCA usa "compre agora" puro — varia entre "link no perfil", "tá no carrinho", "achadinho", "compra essa"
5. Hashtags: 6-10, mix trending BR + nicho do produto. Inclui ao menos 1 trending genérica (#tiktokshop, #achadinho, #queroum)
6. ZERO menção ao influencer pelo nome no roteiro (POV é sobre o produto, não a pessoa)

🆕 PACOTE PÓS-PRODUÇÃO (Plano v4) — gerar TUDO abaixo além do script:

A) descriptions (array de 3 com vibes diferentes — Marcos escolhe qual usar):
   • { vibe: "descoberta", text: "..." } — vibe "achei algo novo", surpresa, curiosidade
   • { vibe: "solucao",    text: "..." } — vibe "isso resolve o problema X", utilidade
   • { vibe: "estetica",   text: "..." } — vibe "isso é lindo", visual/sensorial
   Cada description: 1-2 frases, com 1-2 emojis, prontas pra usar no caption do TikTok.

B) ctaVariants (array de 3 com strategies diferentes):
   • { strategy: "direto",       text: "..." } — chamada direta tipo "Link no perfil"
   • { strategy: "engajamento",  text: "..." } — conversacional tipo "Tô na bio se quiser uma 💕"
   • { strategy: "fomo",         text: "..." } — urgência tipo "Some rápido — corre"

C) tagline: frase de POSICIONAMENTO do produto em 5-8 palavras (não é CTA).
   Ex: "O perfume que todo mundo nota", "A poção do soninho perfeito".

D) capcut (pacote pra produção no CapCut):
   • hookCapa: 3-5 palavras pra abrir o vídeo (vibe "STOP" + curiosidade)
     Ex: "Cadê isso na sua bag", "Olha isso pelamor"
   • headline: título do vídeo em 6-10 palavras (mais explicativo que hookCapa)
     Ex: "Achei o perfume que ninguém esquece", "Skincare que mudou minha pele em 7 dias"
   • popCaptions: array de EXATAMENTE 5 short captions/stickers pra colar no vídeo
     Ex: ["wait", "ATÉ QUE FIM", "olha isso 👀", "loucura", "vai por mim"]
   • suggestedComments: array de EXATAMENTE 3 comentários sugeridos pra Marcos
     postar como primeira interação (comment seeding)
     Ex: ["preciso disso", "linkkkkk", "já comprei o meu 👏"]

RESPONDA APENAS JSON VÁLIDO (sem markdown, sem backticks):
{
  "audioMode": "${audioMode}",${audioMode === 'voiced' ? `\n  "voiceId": "${voiceId}",` : ''}${finalIntensityId ? `\n  "intensityId": "${finalIntensityId}",` : ''}
  "script": [
    ${Array.from({ length: totalTakes }, (_, i) => `{
      "takeNumber": ${i + 1},
      "purpose": "${i === 0 ? 'hook' : i === totalTakes - 1 ? 'cta' : 'demo'}",
      "voiceText": ${audioMode === 'voiced' ? '"string com frases quebradas + CAPS + 2-4 audio tags inline"' : 'null'},
      "onScreenPhrase": "string OU null se não houver"
    }`).join(',\n    ')}
  ],
  "descriptions": [
    { "vibe": "descoberta", "text": "..." },
    { "vibe": "solucao",    "text": "..." },
    { "vibe": "estetica",   "text": "..." }
  ],
  "hashtags": ["#tag1", "#tag2", "..."],
  "ctaVariants": [
    { "strategy": "direto",      "text": "..." },
    { "strategy": "engajamento", "text": "..." },
    { "strategy": "fomo",        "text": "..." }
  ],
  "tagline": "5-8 palavras de posicionamento",
  "capcut": {
    "hookCapa": "3-5 palavras abertura",
    "headline": "6-10 palavras título",
    "popCaptions": ["...", "...", "...", "...", "..."],
    "suggestedComments": ["...", "...", "..."]
  }
}`;

    const userText = `Produto: ${productName}${productDescription ? `\nDescrição: ${productDescription}` : ''}${priceBlock}${categoryId ? `\nCategoria: ${categoryId}` : ''}
Influencer: ${influencer.gender || 'female'}${previousScriptsBlock}${trendBlock}

Gera o roteiro completo do POV + pacote pós-produção. Retorne APENAS o JSON.`;

    // ── Chamada Claude ───────────────────────────────────────────────
    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,  // 🆕 era 2048 — schema cresceu (descriptions, ctaVariants, tagline, capcut)
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }],
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[pov-script v2.0] Anthropic error ${response.status}:`, errText.substring(0, 300));
      return res.status(response.status).json({
        error: `Anthropic error: ${response.status}`,
        details: errText.substring(0, 300),
      });
    }

    const data = await response.json();
    const text = data.content?.map((c) => c.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('[pov-script v2.0] JSON parse error:', e.message, 'Raw:', clean.substring(0, 500));
      return res.status(500).json({
        error: 'Failed to parse Claude response as JSON',
        raw: clean.substring(0, 500),
      });
    }

    // ── Validação estrutural do output ───────────────────────────────
    const result = sanitizeAndValidate(parsed, audioMode, voiceId, finalIntensityId, totalTakes);

    if (result.errors.length > 0) {
      console.warn(`[pov-script v2.0] Validation warnings: ${result.errors.join(', ')}`);
    }

    console.log(
      `[pov-script v2.0] OK: product="${productName.substring(0, 40)}", takes=${totalTakes}, mode=${audioMode}${finalIntensityId ? `, intensity=${finalIntensityId}` : ''}, hashtags=${result.script.hashtags.length}, descs=${result.script.descriptions.length}, ctas=${result.script.ctaVariants.length}`
    );

    return res.status(200).json({
      ...result.script,
      source: result.errors.length === 0 ? 'claude' : 'claude_partial',
      validationWarnings: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('[pov-script v2.0] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ════════════════════════════════════════════════════════════════════════
// Sanitização + validação do output do Claude
// ════════════════════════════════════════════════════════════════════════
//
// Plano v4: schema expandido com fallbacks robustos. O frontend antigo
// (PovOutput.jsx pré-C2) consome só `description`, `hashtags`, `ctaWritten`,
// `script`. O frontend novo (PovOutput.jsx pós-C2) consome também
// `descriptions`, `ctaVariants`, `tagline`, `capcut`.
// Esta função garante que AMBOS recebam dados válidos.

function sanitizeAndValidate(parsed, audioMode, voiceId, intensityId, totalTakes) {
  const errors = [];

  // ── audioMode ────────────────────────────────────────────────────
  const finalAudioMode = parsed.audioMode === audioMode ? audioMode : audioMode;
  if (parsed.audioMode !== audioMode) errors.push(`audioMode mismatch (got "${parsed.audioMode}")`);

  // ── script ──────────────────────────────────────────────────────
  let script = Array.isArray(parsed.script) ? parsed.script : [];
  if (script.length !== totalTakes) {
    errors.push(`script length ${script.length} != expected ${totalTakes}`);
    while (script.length < totalTakes) {
      script.push({
        takeNumber: script.length + 1,
        purpose: script.length === 0 ? 'hook' : script.length === totalTakes - 1 ? 'cta' : 'demo',
        voiceText: audioMode === 'voiced' ? '...' : null,
        onScreenPhrase: null,
      });
    }
    script = script.slice(0, totalTakes);
  }

  // Sanitiza cada take
  script = script.map((take, idx) => {
    const takeNumber = idx + 1;
    const purpose = take.purpose && ['hook', 'demo', 'cta'].includes(take.purpose)
      ? take.purpose
      : (idx === 0 ? 'hook' : idx === totalTakes - 1 ? 'cta' : 'demo');

    let voiceText = take.voiceText;
    if (audioMode === 'silent') {
      voiceText = null;
    } else if (audioMode === 'voiced' && (!voiceText || typeof voiceText !== 'string')) {
      voiceText = '...';
      errors.push(`take ${takeNumber} missing voiceText (voiced mode)`);
    }

    let onScreenPhrase = take.onScreenPhrase;
    if (typeof onScreenPhrase !== 'string' || onScreenPhrase.trim() === '') {
      onScreenPhrase = null;
    }

    return { takeNumber, purpose, voiceText, onScreenPhrase };
  });

  // Garante hook (take 1) e CTA (último take) tenham onScreenPhrase
  if (!script[0].onScreenPhrase) {
    script[0].onScreenPhrase = 'POV: 👀';
    errors.push('take 1 (hook) missing onScreenPhrase, used placeholder');
  }
  if (!script[totalTakes - 1].onScreenPhrase) {
    script[totalTakes - 1].onScreenPhrase = 'Link no perfil 🛒';
    errors.push(`take ${totalTakes} (cta) missing onScreenPhrase, used placeholder`);
  }

  // ── descriptions (Plano v4 — array de 3) ─────────────────────────
  const VALID_VIBES = ['descoberta', 'solucao', 'estetica'];
  let descriptions = Array.isArray(parsed.descriptions) ? parsed.descriptions : [];
  descriptions = descriptions
    .filter((d) => d && typeof d === 'object' && typeof d.text === 'string' && d.text.trim() !== '')
    .map((d) => ({
      vibe: VALID_VIBES.includes(d.vibe) ? d.vibe : 'descoberta',
      text: d.text.trim(),
    }));

  // Fallback: se vier apenas `description` (string), criar 1 entry
  if (descriptions.length === 0 && typeof parsed.description === 'string' && parsed.description.trim()) {
    descriptions.push({ vibe: 'descoberta', text: parsed.description.trim() });
    errors.push('descriptions absent, derived 1 from legacy description field');
  }

  // Garante mínimo de 3 — preenche com placeholders se faltar
  const placeholderTexts = {
    descoberta: 'Achadinho que você precisa conhecer 💕',
    solucao:    'Resolve um problema que eu nem sabia que tinha 🙌',
    estetica:   'Lindo demais — vibe perfeita ✨',
  };
  VALID_VIBES.forEach((v) => {
    if (!descriptions.some((d) => d.vibe === v)) {
      descriptions.push({ vibe: v, text: placeholderTexts[v] });
      errors.push(`descriptions[${v}] missing, used placeholder`);
    }
  });
  descriptions = descriptions.slice(0, 3);

  // Legacy: description singular = descriptions[0].text
  const description = descriptions[0].text;

  // ── hashtags ─────────────────────────────────────────────────────
  let hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((h) => typeof h === 'string') : [];
  hashtags = hashtags.map((h) => h.trim().startsWith('#') ? h.trim() : `#${h.trim()}`);
  if (hashtags.length < 3) {
    hashtags = [...hashtags, '#tiktokshop', '#achadinho', '#queroum'].slice(0, Math.max(3, hashtags.length + 3));
    errors.push('hashtags too few, padded with defaults');
  }

  // ── ctaVariants (Plano v4 — array de 3) ──────────────────────────
  const VALID_STRATEGIES = ['direto', 'engajamento', 'fomo'];
  let ctaVariants = Array.isArray(parsed.ctaVariants) ? parsed.ctaVariants : [];
  ctaVariants = ctaVariants
    .filter((c) => c && typeof c === 'object' && typeof c.text === 'string' && c.text.trim() !== '')
    .map((c) => ({
      strategy: VALID_STRATEGIES.includes(c.strategy) ? c.strategy : 'direto',
      text: c.text.trim(),
    }));

  // Fallback: se vier apenas `ctaWritten` (string), criar 1 entry
  if (ctaVariants.length === 0 && typeof parsed.ctaWritten === 'string' && parsed.ctaWritten.trim()) {
    ctaVariants.push({ strategy: 'direto', text: parsed.ctaWritten.trim() });
    errors.push('ctaVariants absent, derived 1 from legacy ctaWritten field');
  }

  // Garante mínimo de 3 — preenche com placeholders se faltar
  const placeholderCtas = {
    direto:      '🛒 Link no perfil',
    engajamento: 'Tô na bio se quiser uma 💕',
    fomo:        'Some rápido — corre 🏃‍♀️',
  };
  VALID_STRATEGIES.forEach((s) => {
    if (!ctaVariants.some((c) => c.strategy === s)) {
      ctaVariants.push({ strategy: s, text: placeholderCtas[s] });
      errors.push(`ctaVariants[${s}] missing, used placeholder`);
    }
  });
  ctaVariants = ctaVariants.slice(0, 3);

  // Legacy: ctaWritten = ctaVariants[0].text
  const ctaWritten = ctaVariants[0].text;

  // ── tagline (Plano v4) ───────────────────────────────────────────
  let tagline = typeof parsed.tagline === 'string' ? parsed.tagline.trim() : '';
  if (!tagline) {
    tagline = 'O achadinho que faz diferença';
    errors.push('tagline missing, used placeholder');
  }

  // ── capcut (Plano v4) ────────────────────────────────────────────
  const capcutInput = (parsed.capcut && typeof parsed.capcut === 'object') ? parsed.capcut : {};

  let hookCapa = typeof capcutInput.hookCapa === 'string' ? capcutInput.hookCapa.trim() : '';
  if (!hookCapa) {
    hookCapa = 'Olha isso 👀';
    errors.push('capcut.hookCapa missing, used placeholder');
  }

  let headline = typeof capcutInput.headline === 'string' ? capcutInput.headline.trim() : '';
  if (!headline) {
    headline = 'O achadinho que mudou meu dia';
    errors.push('capcut.headline missing, used placeholder');
  }

  let popCaptions = Array.isArray(capcutInput.popCaptions)
    ? capcutInput.popCaptions.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim())
    : [];
  const defaultPopCaptions = ['wait', 'olha isso 👀', 'preciso disso', 'até que fim', 'vai por mim'];
  while (popCaptions.length < 5) {
    popCaptions.push(defaultPopCaptions[popCaptions.length] || 'olha 👀');
  }
  popCaptions = popCaptions.slice(0, 5);
  if (parsed.capcut?.popCaptions?.length !== 5) {
    errors.push(`capcut.popCaptions length ${parsed.capcut?.popCaptions?.length ?? 0} != 5 (padded/trimmed)`);
  }

  let suggestedComments = Array.isArray(capcutInput.suggestedComments)
    ? capcutInput.suggestedComments.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim())
    : [];
  const defaultComments = ['preciso disso', 'linkkkkk', 'já comprei o meu 👏'];
  while (suggestedComments.length < 3) {
    suggestedComments.push(defaultComments[suggestedComments.length] || 'gostei');
  }
  suggestedComments = suggestedComments.slice(0, 3);
  if (parsed.capcut?.suggestedComments?.length !== 3) {
    errors.push(`capcut.suggestedComments length ${parsed.capcut?.suggestedComments?.length ?? 0} != 3 (padded/trimmed)`);
  }

  const capcut = { hookCapa, headline, popCaptions, suggestedComments };

  // ── Output final ─────────────────────────────────────────────────
  const out = {
    audioMode: finalAudioMode,
    script,
    // Novos (Plano v4)
    descriptions,
    ctaVariants,
    tagline,
    capcut,
    // Legacy (retrocompat com PovOutput.jsx pré-C2)
    description,
    ctaWritten,
    hashtags,
  };
  if (audioMode === 'voiced') out.voiceId = voiceId;
  if (intensityId) out.intensityId = intensityId;

  return { script: out, errors };
}
