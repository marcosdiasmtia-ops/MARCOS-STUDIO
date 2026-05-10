// api/pov-script.js (v1.0 — Claude Sonnet 4 gera roteiro POV de N takes)
//
// Endpoint que gera o ROTEIRO COMPLETO pro vídeo POV — Claude analisa
// (produto, tipo, cenário, estilo, duração, modo de áudio) e devolve:
//   - script: array de N takes (cada um com voiceText? + onScreenPhrase? + purpose)
//   - description: descrição do post TikTok
//   - hashtags: 6-10 hashtags PT-BR (mix trending + nicho)
//   - ctaWritten: CTA escrito pro caption
//
// MODO DE ÁUDIO (decisão crítica que muda o roteiro inteiro):
//   - 'silent'  → vídeo MUDO (vibe POV TikTok). voiceText sempre null.
//                 Conteúdo todo nas onScreenPhrases (hook + demo? + CTA).
//   - 'voiced'  → narração off com Eleven v3 + audio tags inline.
//                 voiceText preenchido em todos os takes. onScreenPhrases
//                 menores (reforçam pontos-chave, não duplicam o áudio).
//
// AUDIO TAGS (só quando audioMode='voiced'):
//   Eleven v3 aceita tags inline tipo "[excited] Gente!" ou "[whispers] sério..."
//   Lista válida espelha pov-elevenlabs-voices.js / ELEVENLABS_V3_AUDIO_TAGS.
//
// DISTRIBUIÇÃO DE FRASES ON-SCREEN (espelho de pov-durations.js):
//   - Hook: sempre 1 (take 1)
//   - Demo: 0-3 (intermediários, varia por duração)
//   - CTA:  sempre 1 (último take)
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
//     typeId: string,                        // de pov-types.js
//     scenarioId: string,                    // de pov-scenarios.js
//     styleId: string,                       // de pov-styles.js
//     durationId: '20s' | '30s' | '40s' | '60s',
//     audioMode: 'silent' | 'voiced',
//     voiceId?: string,                      // só se audioMode='voiced'
//     influencer?: { name?, gender? },       // pra contexto
//     previousScripts?: array,               // não repetir scripts anteriores
//     trendData?: string,                    // dados de tendências (futuro)
//   }
//
// RESPONSE:
//   200: { audioMode, voiceId?, script, description, hashtags, ctaWritten, source }
//   400: { error: <mensagem> }
//   500: { error: <mensagem> }

// ════════════════════════════════════════════════════════════════════════
// Constantes (espelho de pov-durations.js)
// ════════════════════════════════════════════════════════════════════════

// durationId → { takes, hookCount, demoMin, demoMax, ctaCount }
const DURATION_CONFIG = {
  '20s': { takes: 2, hookCount: 1, demoMin: 0, demoMax: 1, ctaCount: 1 },
  '30s': { takes: 3, hookCount: 1, demoMin: 1, demoMax: 1, ctaCount: 1 },
  '40s': { takes: 4, hookCount: 1, demoMin: 1, demoMax: 2, ctaCount: 1 },
  '60s': { takes: 6, hookCount: 1, demoMin: 2, demoMax: 3, ctaCount: 1 },
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

const TYPE_DESCRIPTIONS = {
  frasco:     'mão segurando frasco/garrafa pelo corpo',
  pote:       'pote sendo aberto, tampa removida',
  sapatos:    'sapato exibido na mão',
  capinha:    'gadget/capinha segurado pela borda',
  pequeno:    'estojo aberto revelando produto pequeno',
  cabide:     'roupa pendurada no cabide',
  pulso:      'produto no pulso (relógio/pulseira/anel)',
  vestindo:   'produto sendo colocado/vestido',
  mordida:    'produto sendo mordido/comido/bebido',
  superficie: 'produto estático em superfície (sem mãos)',
  unboxing:   'caixa sendo aberta, produto revelado',
};

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
      return res.status(400).json({ error: 'durationId must be 20s | 30s | 40s | 60s' });
    }
    if (!VALID_AUDIO_MODES.includes(audioMode)) {
      return res.status(400).json({ error: 'audioMode must be "silent" or "voiced"' });
    }
    if (audioMode === 'voiced' && !voiceId) {
      return res.status(400).json({ error: 'voiceId is required when audioMode="voiced"' });
    }

    const config = DURATION_CONFIG[durationId];
    const totalTakes = config.takes;
    const styleDesc = STYLE_DESCRIPTIONS[styleId] || styleId;
    const typeDesc = TYPE_DESCRIPTIONS[typeId] || typeId;

    // ── Monta prompt ─────────────────────────────────────────────────
    const audioTagsList = audioMode === 'voiced'
      ? `\nAUDIO TAGS DISPONÍVEIS (Eleven v3) — use embutido em voiceText: ${VALID_AUDIO_TAGS.map(t => `[${t}]`).join(', ')}`
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
- Cada voiceText: 1 frase curta (8-15 palavras), em PT-BR coloquial
- USE 1-2 audio tags por voiceText pra dar emoção (ex: "[excited] Gente, olha isso!", "[whispers] sério, viu...")
- onScreenPhrases COMPLEMENTAM o áudio (não duplicam):
  * Hook: 1 frase no take 1 (gancho visual curto)
  * Demo: 0-${config.demoMax} frase(s) opcionais nos intermediários (ponto-chave reforçado)
  * CTA: 1 frase no último take${audioTagsList}`;

    const previousScriptsBlock = previousScripts.length > 0
      ? `\n\nVÍDEOS ANTERIORES DESTE PRODUTO (NÃO repita o tom/conteúdo):\n${previousScripts.slice(0, 3).map((s, i) => `${i + 1}. ${typeof s === 'string' ? s : JSON.stringify(s).substring(0, 200)}`).join('\n')}`
      : '';

    const trendBlock = trendData ? `\n\nDADOS DE TENDÊNCIA (incorpore se fizer sentido):\n${trendData.substring(0, 500)}` : '';

    const priceBlock = productPrice
      ? `\nPreço: R$ ${productPrice}${productOriginalPrice ? ` (de R$ ${productOriginalPrice})` : ''}`
      : '';

    const systemPrompt = `Você é um copywriter especialista em vídeos UGC POV pra TikTok Shop em PT-BR.

MISSÃO: gerar o roteiro COMPLETO de um vídeo POV de afiliação. POV = vídeo curto onde aparecem só as mãos interagindo com o produto (sem rosto). Vibe TikTok autêntica, NUNCA propaganda formal.

TIPO POV: ${typeDesc}
ESTILO DE CÂMERA: ${styleDesc}
DURAÇÃO: ${durationId} (${totalTakes} takes de 10s cada, concatenados sem transição)

${audioModeBlock}

REGRAS DE CONTEÚDO (válidas pros 2 modos):
1. PT-BR coloquial brasileiro (não europeu) — "tô", "pra", "viu", "gente"
2. Direto, sem floreio. Sem "Olá pessoal" formal.
3. Cada take tem um propósito claro: hook | demo | cta
4. CTA NUNCA usa "compre agora" puro — varia entre "link no perfil", "tá no carrinho", "achadinho", "compra essa"
5. Hashtags: 6-10, mix trending BR + nicho do produto. Inclui ao menos 1 trending genérica (#tiktokshop, #achadinho, #queroum)
6. Description: 1-2 frases que fazem sentido no caption do TikTok, com 1 emoji
7. ZERO menção ao influencer pelo nome no roteiro (POV é sobre o produto, não a pessoa)

RESPONDA APENAS JSON VÁLIDO (sem markdown, sem backticks):
{
  "audioMode": "${audioMode}",${audioMode === 'voiced' ? `\n  "voiceId": "${voiceId}",` : ''}
  "script": [
    ${Array.from({ length: totalTakes }, (_, i) => `{
      "takeNumber": ${i + 1},
      "purpose": "${i === 0 ? 'hook' : i === totalTakes - 1 ? 'cta' : 'demo'}",
      "voiceText": ${audioMode === 'voiced' ? '"string com 1-2 audio tags inline"' : 'null'},
      "onScreenPhrase": "string OU null se não houver"
    }`).join(',\n    ')}
  ],
  "description": "string descrição TikTok 1-2 frases + 1 emoji",
  "hashtags": ["#tag1", "#tag2", ...],
  "ctaWritten": "string CTA pro caption"
}`;

    const userText = `Produto: ${productName}${productDescription ? `\nDescrição: ${productDescription}` : ''}${priceBlock}${categoryId ? `\nCategoria: ${categoryId}` : ''}
Influencer: ${influencer.gender || 'female'}${previousScriptsBlock}${trendBlock}

Gera o roteiro do POV. Retorne APENAS o JSON.`;

    // ── Chamada Claude ───────────────────────────────────────────────
    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
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
      console.error(`[pov-script v1.0] Anthropic error ${response.status}:`, errText.substring(0, 300));
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
      console.error('[pov-script v1.0] JSON parse error:', e.message, 'Raw:', clean.substring(0, 500));
      return res.status(500).json({
        error: 'Failed to parse Claude response as JSON',
        raw: clean.substring(0, 500),
      });
    }

    // ── Validação estrutural do output ───────────────────────────────
    const result = sanitizeAndValidate(parsed, audioMode, voiceId, totalTakes);

    if (result.errors.length > 0) {
      console.warn(`[pov-script v1.0] Validation warnings: ${result.errors.join(', ')}`);
    }

    console.log(
      `[pov-script v1.0] OK: product="${productName.substring(0, 40)}", takes=${totalTakes}, mode=${audioMode}, hashtags=${result.script.hashtags.length}`
    );

    return res.status(200).json({
      ...result.script,
      source: result.errors.length === 0 ? 'claude' : 'claude_partial',
      validationWarnings: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('[pov-script v1.0] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ════════════════════════════════════════════════════════════════════════
// Sanitização + validação do output do Claude
// ════════════════════════════════════════════════════════════════════════

function sanitizeAndValidate(parsed, audioMode, voiceId, totalTakes) {
  const errors = [];

  // audioMode
  const finalAudioMode = parsed.audioMode === audioMode ? audioMode : audioMode;
  if (parsed.audioMode !== audioMode) errors.push(`audioMode mismatch (got "${parsed.audioMode}")`);

  // script
  let script = Array.isArray(parsed.script) ? parsed.script : [];
  if (script.length !== totalTakes) {
    errors.push(`script length ${script.length} != expected ${totalTakes}`);
    // Normaliza pra totalTakes (preenche faltantes com placeholder, corta sobrantes)
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

  // description
  let description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
  if (!description) {
    description = 'Achadinho que você precisa conhecer 💕';
    errors.push('missing description, used placeholder');
  }

  // hashtags
  let hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.filter(h => typeof h === 'string') : [];
  hashtags = hashtags.map(h => h.trim().startsWith('#') ? h.trim() : `#${h.trim()}`);
  if (hashtags.length < 3) {
    hashtags = [...hashtags, '#tiktokshop', '#achadinho', '#queroum'].slice(0, 3);
    errors.push('hashtags too few, padded with defaults');
  }

  // ctaWritten
  let ctaWritten = typeof parsed.ctaWritten === 'string' ? parsed.ctaWritten.trim() : '';
  if (!ctaWritten) {
    ctaWritten = '🛒 Link no perfil';
    errors.push('missing ctaWritten, used placeholder');
  }

  const out = {
    audioMode: finalAudioMode,
    script,
    description,
    hashtags,
    ctaWritten,
  };
  if (audioMode === 'voiced') out.voiceId = voiceId;

  return { script: out, errors };
}
