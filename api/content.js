// Separate Claude call for TikTok content generation
// Uses web search results + product specifics for better quality
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { produto, diferenciais, momento, estetica, preco, trendData, videoNum, previousContent } = req.body;

    const system = `Você é uma copywriter brasileira de 28 anos que vive de TikTok Shop afiliado. Você faz R$15k/mês só com conteúdo orgânico. Você fala como amiga real — com gírias, emoção e verdade.

REGRAS ABSOLUTAS:
1. NUNCA use frases genéricas que funcionariam pra qualquer produto. Cada texto DEVE conter pelo menos 1 palavra específica deste produto. Teste: se trocar o produto e o texto ainda funcionar, REFAÇA.
2. NUNCA repita textos de vídeos anteriores deste produto.
3. Use os DIFERENCIAIS REAIS do produto nos textos — tecido, caimento, sensação, tecnologia.
4. Tom de WhatsApp com amiga — curto, direto, com emoção real.
5. Hashtags devem misturar trending ATUAIS (dos dados de tendência fornecidos) com nicho específico.
6. Descrição deve contar uma mini-história, não listar benefícios.

REGRA DE ESPECIFICIDADE:
Exemplo RUIM: "Olha esse look incrível 🔥" (funciona pra qualquer roupa)
Exemplo BOM: "Esse suplex não marca nem agachando 🔥" (só funciona pra legging)
Exemplo RUIM: "Peça que combina com tudo ✨" (genérico)
Exemplo BOM: "Cintura alta que segura tudo sem apertar 👌" (específico)

Retorne APENAS JSON válido, sem markdown:
{
  "ganchos": [
    { "texto": "string", "categoria": "string (Preço-Choque/Qualidade-Surpresa/etc)", "formato": "string (POV:/Sabe quando/etc)" },
    { "texto": "string", "categoria": "string", "formato": "string" },
    { "texto": "string", "categoria": "string", "formato": "string" }
  ],
  "detalhes": [
    { "texto": "string (máx 1 linha, foco emoção+qualidade)" },
    { "texto": "string" },
    { "texto": "string" }
  ],
  "precoCTAs": [
    { "texto": "string (formato: Por menos de R$X — CTA)" },
    { "texto": "string" },
    { "texto": "string" }
  ],
  "descricoes": [
    { "texto": "string (4 linhas, 1 emoji por linha, mini-história)" },
    { "texto": "string" },
    { "texto": "string" }
  ],
  "hashtags": [
    { "set": "string (5 hashtags misturando trending + nicho)" },
    { "set": "string" },
    { "set": "string" }
  ],
  "musica": {
    "energia": "string",
    "bpm": "string",
    "estilo": "string",
    "busca1": "string em inglês",
    "busca2": "string em inglês",
    "busca3": "string em inglês"
  }
}`;

    const prevContext = previousContent?.length > 0
      ? `\n\nTEXTOS JÁ USADOS (NÃO REPETIR NENHUM):\n${previousContent.map((p, i) => `Vídeo ${i + 1}: momento="${p.momento||'?'}" estética="${p.estetica||'?'}" gancho="${p.gancho}" detalhe="${p.detalhe}"`).join('\n')}\n\nOBRIGATÓRIO: Crie textos com tom e abordagem COMPLETAMENTE DIFERENTES dos vídeos anteriores.`
      : '';

    const trendContext = trendData
      ? `\n\nTENDÊNCIAS ATUAIS DO TIKTOK (usar como inspiração):\n${trendData}`
      : '';

    const userMsg = `PRODUTO: ${produto}
PREÇO: R$${preco}
DIFERENCIAIS REAIS: ${diferenciais?.join(', ') || 'Não informados'}
MOMENTO/OCASIÃO: ${momento}
ESTÉTICA: ${estetica}
VÍDEO NÚMERO: ${videoNum} de 3
${trendContext}${prevContext}

Gere 3 opções DIFERENTES e ESPECÍFICAS para cada campo. APENAS JSON.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Content API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
