// api/ugc-script.js (v1.0 — Claude Sonnet 4 gera pacote completo UGC Falante)
//
// Endpoint que gera o PACOTE PÓS-PRODUÇÃO COMPLETO pra um vídeo UGC Falante.
// Combina em UMA chamada Claude (~$0,02):
//   1. Roteiro (fala da influencer, dividido em N takes de 8s)
//   2. Frases on-screen (texto sobre vídeo, regras da arquitetura)
//   3. Descrição do post TikTok
//   4. Hashtags (8-10, mix de trending + nicho)
//   5. Sugestão de música de fundo (gênero + BPM + termos de busca)
//   6. CTAs em 3 versões (falado, on-screen do último take, descrição)
//
// REFERÊNCIA na arquitetura UGC Falante v3.0:
//   - Tema 8: Roteiro híbrido (Claude gera + Marcos edita/regenera)
//   - Item 8: Pacote pós-produção completo
//   - Item 9: Soft warning > 25 palavras por take (não bloqueia)
//
// DIFERENCIAL vs Trendly: Trendly só entrega roteiro + prompt. MARCOS-STUDIO
// entrega o PACOTE INTEIRO em uma chamada (cf. Diferencial #7 da arquitetura).
//
// Espelha o padrão do api/content.js (validado em produção desde v2.5).
//
// Input (POST body):
//   - influencer: { name, bodyDescription, facePrompt, vibe? }
//   - product: { name, description, price, originalPrice? }
//   - styleId: 'natural' | 'autoridade' | ... (id de ugc-styles.js)
//   - durationId: '8s' | '16s' | '24s' | '32s' | '40s'
//   - categoryId: id de ugc-categories.js (ex: 'skincare_facial')
//   - viralTranscript?: string  — diferencial: usar transcrição viral como base
//   - previousScripts?: array — pra Claude não repetir vídeos anteriores
//   - trendData?: string — dados de tendências (futuro: integrar /api/search)
//
// Output (200):
//   {
//     script: [{ takeNumber, fala, wordCount, durationSeconds }, ...],
//     onScreenPhrases: [{ takeNumber, phrase }, ...],  // só pras takes que têm
//     description: "string",
//     hashtags: ["#tag1", "#tag2", ...],
//     musicSuggestion: { genre, mood, bpm, searchTerms: [...] },
//     ctas: { spoken, onScreen, written }
//   }

// Mapeamento durationId → número de takes (cada take = 8s)
const TAKES_BY_DURATION = {
  '8s': 1,
  '16s': 2,
  '24s': 3,
  '32s': 4,
  '40s': 5,
};

// Descrição curta de cada estilo (pra Claude entender o tom esperado)
const STYLE_DESCRIPTIONS = {
  natural:         'conversa amigável, calma, "tô te contando como amiga"',
  autoridade:      'especialista segura, "aqui é assim, eu garanto"',
  amigavel:        'warm e animada, contagiante, sorriso na voz',
  urgente:         'FOMO ativado, "compra agora ou perde"',
  curioso:         'tom de descoberta, "olha que coisa interessante"',
  storytelling:    'micro-história pessoal, "outro dia aconteceu uma coisa..."',
  comparacao:      'analítica, "antes eu usava X, agora uso Y"',
  confissao:       'tom íntimo, "te conto um segredo"',
  alerta:          'aviso direto, "atenção, precisa saber disso"',
  hack:            'truque rápido, "olha esse atalho"',
  custo_beneficio: 'foco em valor recebido, "por esse preço..."',
};

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
      influencer = {},
      product = {},
      styleId,
      durationId,
      categoryId,
      viralTranscript,
      previousScripts,
      trendData,
    } = req.body || {};

    // ── Validação de inputs ───────────────────────────────────────────
    if (!influencer.name) {
      return res.status(400).json({ error: 'influencer.name is required' });
    }
    if (!product.name) {
      return res.status(400).json({ error: 'product.name is required' });
    }
    if (!styleId || !STYLE_DESCRIPTIONS[styleId]) {
      return res.status(400).json({ error: `styleId is required and must be one of: ${Object.keys(STYLE_DESCRIPTIONS).join(', ')}` });
    }
    if (!durationId || !TAKES_BY_DURATION[durationId]) {
      return res.status(400).json({ error: `durationId is required and must be one of: ${Object.keys(TAKES_BY_DURATION).join(', ')}` });
    }

    const numTakes = TAKES_BY_DURATION[durationId];

    // ── Mapeamento on-screen phrases por duração (Item 8 da arquitetura) ──
    // Take 1 SEMPRE tem hook · último SEMPRE tem CTA · meio Claude decide
    // (nunca 2 takes seguidos vazios)
    const onScreenStrategy = numTakes === 1
      ? '1 frase forte (vai ser hook + CTA combinados)'
      : numTakes === 2
        ? '2 frases (Take 1 = hook · Take 2 = CTA)'
        : numTakes === 3
          ? '2-3 frases (Take 1 = hook · meio = você decide se vale · último = CTA)'
          : numTakes === 4
            ? '3 frases (Take 1 = hook · 1 take do meio = você decide · último = CTA. Nunca 2 takes vazios seguidos)'
            : '3-4 frases (Take 1 = hook · 1-2 takes do meio = você decide · último = CTA. Nunca 2 takes vazios seguidos)';

    // ── System prompt ─────────────────────────────────────────────────
    const system = `Você é roteirista brasileira de UGC pra TikTok Shop com R$30k/mês de comissão de afiliação. Faz centenas de vídeos virais. Domina dividir roteiro em takes de 8 segundos cada (Veo 3) e moldar tom de fala por estilo de apresentação.

REGRAS ABSOLUTAS:

1. ESPECIFICIDADE: cada palavra do roteiro tem que ser específica deste produto. Se trocar o produto e o roteiro ainda funcionar, REFAÇA. Use detalhes técnicos reais (tecido, ingrediente, mecanismo).

2. NATURALIDADE: não soa como anúncio. Soa como amiga real recomendando no WhatsApp. PT-BR informal, gírias permitidas, emoção genuína.

3. LIMITE 25 PALAVRAS POR TAKE: cada take tem 8 segundos. Acima de 25 palavras, a fala não cabe. Conte palavras antes de finalizar — campo wordCount obrigatório.

4. ESTILO RESPEITADO: o estilo "${styleId}" pede tom "${STYLE_DESCRIPTIONS[styleId]}". O roteiro INTEIRO tem que respirar esse tom. Se virar genérico, REFAÇA.

5. FRASES ON-SCREEN: máximo 6 palavras cada, alto impacto. ${onScreenStrategy}.

6. CTA COM URGÊNCIA HONESTA: ofertas TikTok Shop tem cupons reais. Use isso, mas sem mentir.

7. JSON VÁLIDO: APENAS JSON, sem markdown, sem explicação.

ESTILOS DISPONÍVEIS (referência rápida):
${Object.entries(STYLE_DESCRIPTIONS).map(([id, desc]) => `- ${id}: ${desc}`).join('\n')}

SCHEMA DE OUTPUT (JSON apenas):
{
  "script": [
    { "takeNumber": 1, "fala": "string PT-BR", "wordCount": <número>, "durationSeconds": 8 }
    // ${numTakes} take(s) total
  ],
  "onScreenPhrases": [
    { "takeNumber": 1, "phrase": "string máx 6 palavras" }
    // só inclua takes que TÊM frase on-screen, conforme estratégia
  ],
  "description": "string (1 parágrafo curto, mini-história, 4 linhas máx, 1-2 emojis)",
  "hashtags": ["#tag1", "#tag2", ... 8 a 10 hashtags, mix trending + nicho],
  "musicSuggestion": {
    "genre": "string PT-BR (ex: Lo-fi acústico)",
    "mood": "string PT-BR (ex: calmo, intimista)",
    "bpm": "string (ex: 80-100)",
    "searchTerms": ["3 termos em INGLÊS pra buscar no TikTok Sounds"]
  },
  "ctas": {
    "spoken": "string PT-BR — vai como FALA do último take (já contado no script)",
    "onScreen": "string PT-BR — máx 5 palavras, vai sobre o último take",
    "written": "string PT-BR — vai como descrição do post, conversacional"
  }
}`;

    // ── Contextos opcionais (transcrição viral, vídeos anteriores, tendências) ──
    const transcriptContext = viralTranscript
      ? `\n\n📋 TRANSCRIÇÃO VIRAL DE BASE (use como ESTRUTURA, mas adapte 100% ao produto):\n"${viralTranscript}"\n\nIMPORTANTE: copiar literalmente é proibido. Use só a ESTRUTURA emocional/narrativa. Cada frase deve ser específica do produto.`
      : '';

    const previousContext = previousScripts && previousScripts.length > 0
      ? `\n\n🚫 ROTEIROS JÁ USADOS PRO MESMO PRODUTO (NÃO REPITA tom, abertura ou estrutura):\n${previousScripts.map((s, i) => `Vídeo ${i + 1}: "${s.firstTakeFala || s.fala || 'sem registro'}"`).join('\n')}`
      : '';

    const trendContext = trendData
      ? `\n\n📈 TENDÊNCIAS TIKTOK BR ATUAIS (use como inspiração de tom/formato):\n${trendData}`
      : '';

    const promoContext = product.originalPrice
      ? `\n\n💸 PRODUTO EM PROMOÇÃO: preço original R$${product.originalPrice}, agora R$${product.price}. INCLUA o desconto explícito em pelo menos 1 lugar (descrição OU CTA escrito) com o formato "de R$X por R$Y".`
      : '';

    // ── User message ──────────────────────────────────────────────────
    const userMsg = `INFLUENCER:
- Nome: ${influencer.name}
${influencer.bodyDescription ? `- Aparência: ${influencer.bodyDescription}` : ''}
${influencer.vibe ? `- Vibe pessoal: ${influencer.vibe}` : ''}

PRODUTO:
- Nome: ${product.name}
- Descrição: ${product.description || 'não informada'}
- Preço: R$ ${product.price || 'não informado'}${promoContext}

CONFIGURAÇÃO DO VÍDEO:
- Estilo de apresentação: ${styleId}
- Duração: ${durationId} = ${numTakes} take(s) de 8s
- Categoria: ${categoryId || 'não informada'}
${transcriptContext}${previousContext}${trendContext}

Gere o pacote completo em JSON conforme schema. APENAS JSON, sem markdown.`;

    console.log(
      `[ugc-script] Submitting to Claude:`,
      `style=${styleId}, duration=${durationId}, takes=${numTakes},`,
      `product="${product.name?.substring(0, 40)}",`,
      `viralTranscript=${!!viralTranscript},`,
      `previous=${previousScripts?.length || 0}`
    );

    // ── Claude Sonnet 4 ───────────────────────────────────────────────
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ugc-script] Claude API error ${response.status}:`, errText);
      return res.status(response.status).json({
        error: `Claude API error: ${response.status}`,
        details: errText,
      });
    }

    const claudeData = await response.json();

    if (claudeData.error) {
      console.error('[ugc-script] Claude returned error:', claudeData.error);
      return res.status(500).json({ error: claudeData.error });
    }

    // ── Extrai e parseia o JSON do output ─────────────────────────────
    const text = claudeData.content?.map((c) => c.text || '').join('') || '';
    const cleanText = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch (parseErr) {
      console.error('[ugc-script] JSON parse error:', parseErr.message, 'raw:', cleanText.substring(0, 500));
      return res.status(500).json({
        error: 'Claude retornou JSON inválido. Tente novamente.',
        rawText: cleanText.substring(0, 500),
      });
    }

    // ── Validação leve do output (estrutura mínima esperada) ──────────
    const expectedKeys = ['script', 'onScreenPhrases', 'description', 'hashtags', 'musicSuggestion', 'ctas'];
    const missingKeys = expectedKeys.filter((k) => !(k in parsed));
    if (missingKeys.length > 0) {
      console.warn(`[ugc-script] Output missing keys: ${missingKeys.join(', ')}`);
    }

    if (Array.isArray(parsed.script) && parsed.script.length !== numTakes) {
      console.warn(`[ugc-script] Script length mismatch: expected ${numTakes} takes, got ${parsed.script.length}`);
    }

    console.log(
      `[ugc-script] OK:`,
      `takes=${parsed.script?.length || '?'},`,
      `phrases=${parsed.onScreenPhrases?.length || '?'},`,
      `hashtags=${parsed.hashtags?.length || '?'}`
    );

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('[ugc-script] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
