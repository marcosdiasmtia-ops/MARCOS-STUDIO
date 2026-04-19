// api/analyze-identity.js (v2.4)
// Analisa foto da influencer via Claude Vision e retorna descrições
// detalhadas de rosto e corpo pra usar como âncora de identidade em prompts
// de geração de imagem (Nano Banana).
//
// Chamado automaticamente pelo ProfileManager quando o usuário faz upload
// da foto no cadastro/edição de influencer.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { base64, mimeType } = req.body;
    if (!base64) return res.status(400).json({ error: 'Photo base64 is required' });

    const systemPrompt = `Você é um assistente especializado em análise visual para geração de imagens por IA (Nano Banana / Midjourney / Stable Diffusion).

TAREFA: analisar a foto de uma pessoa e gerar descrições textuais detalhadas que servirão como "âncora de identidade" em prompts de geração de imagem. Retorne APENAS um JSON válido no formato EXATO abaixo.

{
  "facePrompt": "descrição detalhada do rosto em inglês técnico",
  "bodyDescription": "descrição do corpo em inglês (se visível na foto)"
}

REGRAS PARA facePrompt (obrigatório, sempre preencher):
- Sempre em INGLÊS técnico
- Incluir (nesta ordem): face shape, skin tone específico, eye color and shape, hair color/texture/length, eyebrow shape and color, nose shape, lip fullness, distinctive permanent features (freckles, moles, piercings, tattoos visíveis), age estimate
- Usar termos técnicos que modelos de IA entendem. Exemplos bons:
  * "oval elongated face with defined chin"
  * "hazel almond-shaped eyes"
  * "auburn wavy medium-long hair with warm honey highlights"
  * "olive skin tone with warm undertones"
  * "medium thin lips with natural pink color"
  * "small straight nose with subtle left nostril piercing"
  * "light natural freckles on cheeks and nose bridge"
- Entre 80 e 150 palavras
- NÃO incluir: roupas, expressão facial passageira, iluminação, cenário, maquiagem pesada, acessórios. Apenas features físicas permanentes.

REGRAS PARA bodyDescription:
- Sempre em INGLÊS técnico
- SE o corpo estiver visível (pelo menos tronco e ombros): descrever tipo corporal. Exemplos:
  * "curvy natural Brazilian body with defined waist and full rounded hips"
  * "slim athletic build with toned arms and long legs"
  * "petite delicate frame with narrow shoulders"
  * "tall slender figure with elongated proportions"
- SE a foto for só rosto/headshot SEM mostrar corpo: retornar string VAZIA ""
- Entre 0 e 40 palavras
- NÃO inventar o que não é visível

FORMATO:
- NÃO use markdown
- NÃO use backticks
- NÃO inclua texto antes ou depois do JSON
- Retorne APENAS o JSON válido, nada mais`;

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType || 'image/jpeg',
                data: base64
              }
            },
            {
              type: 'text',
              text: 'Analise esta foto e gere as descrições no formato JSON especificado.'
            }
          ]
        }
      ]
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

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[analyze-identity] Anthropic error ${response.status}:`, errText);
      return res.status(response.status).json({
        error: `Anthropic error: ${response.status}`,
        details: errText.substring(0, 500)
      });
    }

    const data = await response.json();
    const text = data.content?.map(c => c.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('[analyze-identity] JSON parse error:', e.message, 'Raw:', clean.substring(0, 300));
      return res.status(500).json({
        error: 'Failed to parse Claude response as JSON',
        raw: clean.substring(0, 500)
      });
    }

    console.log(`[analyze-identity] OK: face=${(parsed.facePrompt||'').length}ch, body=${(parsed.bodyDescription||'').length}ch`);

    return res.status(200).json({
      facePrompt: parsed.facePrompt || '',
      bodyDescription: parsed.bodyDescription || ''
    });
  } catch (error) {
    console.error('[analyze-identity] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
