// Generate back image prompt using frontal image + back product photo via Claude
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { frontalImageUrl, frontalPrompt, visual, camadas } = req.body;

    if (!frontalImageUrl) return res.status(400).json({ error: 'frontalImageUrl is required' });

    const systemPrompt = `Você é um especialista em prompts de imagem UGC para TikTok Shop.
Sua tarefa é criar o prompt de COSTAS baseado na imagem frontal já aprovada.

REGRAS:
- O prompt deve manter TOTAL CONSISTÊNCIA com a imagem frontal (mesma roupa, mesmo cenário, mesma iluminação, mesma modelo)
- A única mudança é que a modelo está DE COSTAS
- Manter o mesmo estilo de cabelo visto por trás
- Manter o mesmo calçado
- Manter os mesmos acessórios visíveis
- O cenário e iluminação devem ser IDÊNTICOS ao da imagem frontal
- Formato: vertical 9:16, UGC authentic, realistic
- Full body visible head to toe including feet
- Prompt em INGLÊS

Retorne APENAS JSON válido, sem backticks, sem markdown:
{
  "positivo": "prompt completo em inglês",
  "negativo": "negative prompt completo"
}`;

    const userMessage = [
      {
        type: 'image',
        source: { type: 'url', url: frontalImageUrl }
      },
      {
        type: 'text',
        text: `Analise esta imagem frontal aprovada e crie o prompt para a versão DE COSTAS.

IMAGEM FRONTAL APROVADA: (anexada acima)
PROMPT FRONTAL USADO: ${frontalPrompt || 'N/A'}

VISUAL DEFINIDO:
- Cabelo: ${visual?.cabelo || 'N/A'}
- Calçado: ${visual?.calcado || 'N/A'}
- Acessórios: ${visual?.acessorios || 'N/A'}
- Cenário: ${visual?.cenario || 'N/A'}
- Iluminação: ${visual?.iluminacao || 'N/A'}

CAMADAS:
- Momento: ${camadas?.momento || 'N/A'}
- Estação: ${camadas?.estacao || 'N/A'}
- Estética: ${camadas?.estetica || 'N/A'}

Crie o prompt de costas mantendo TOTAL CONSISTÊNCIA com a imagem frontal. Descreva exatamente o que se vê na imagem frontal (cenário, iluminação, elementos) mas com a modelo de costas. APENAS JSON.`
      }
    ];

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: [{ type: 'text', text: systemPrompt }],
      messages: [{ role: 'user', content: userMessage }]
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (data.error) {
      console.error('[generate-back] Claude error:', data.error);
      return res.status(500).json({ error: data.error.message || JSON.stringify(data.error) });
    }

    const text = data.content?.map(i => i.text || '').join('') || '';
    
    // Parse JSON response
    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      return res.status(200).json(parsed);
    } catch (parseErr) {
      console.error('[generate-back] JSON parse error:', parseErr, 'Raw text:', text.substring(0, 500));
      return res.status(500).json({ error: 'Failed to parse Claude response', raw: text.substring(0, 500) });
    }
  } catch (error) {
    console.error('Generate Back API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
