// Search TikTok trends using Claude with web search tool
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { categoria, tipo_produto } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Busque tendências ATUAIS do TikTok Shop Brasil para "${tipo_produto}" na categoria "${categoria}".

Preciso de:
1. 3-5 hooks/ganchos que estão viralizando AGORA para este tipo de produto
2. 5-8 hashtags trending para moda feminina no TikTok Brasil
3. 2-3 músicas/sons trending para conteúdo de moda

Retorne APENAS texto organizado, sem JSON. Seja específico com exemplos reais.`
        }]
      })
    });

    const data = await response.json();
    // Extract text from response (may include tool use blocks)
    const text = data.content
      ?.filter(b => b.type === 'text')
      ?.map(b => b.text)
      ?.join('\n') || '';

    return res.status(200).json({ trends: text });
  } catch (error) {
    console.error('Search Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
