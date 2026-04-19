// api/analyze-identity.js (v2.6.1 — simpler, ASCII-safe, forensic prompt)
// Analisa foto da influencer via Claude Vision e retorna descrições
// detalhadas de rosto e corpo pra usar como âncora de identidade.

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

    const systemPrompt = `Voce e um especialista em analise visual forense para geracao de imagens por IA.

MISSAO: olhar a foto com precisao FORENSE e gerar descricao textual que permita recriar essa PESSOA ESPECIFICA. Nao uma pessoa parecida, a PESSOA da foto.

Retorne APENAS um JSON valido:
{
  "facePrompt": "descricao detalhada em ingles tecnico",
  "bodyDescription": "descricao do corpo em ingles (se visivel)"
}

REGRAS CRITICAS para facePrompt:

1. ESPECIFICIDADE - nunca use termos guarda-chuva:
   RUIM: "brown hair" | BOM: "warm honey blonde with caramel highlights and darker roots"
   RUIM: "light skin" | BOM: "fair Northern European skin with pink undertones"
   RUIM: "oval face" | BOM: "elongated oval face with angular jawline and high cheekbones"
   RUIM: "brown eyes" | BOM: "medium hazel eyes with amber flecks"

2. NEGACOES ATIVAS - quando houver risco de interpretacao genérica, AFIRME o que a pessoa NAO e:
   - "fair skin (NOT olive, NOT tanned, NOT deep)"
   - "honey blonde (NOT brown, NOT chestnut, NOT dark)"
   - "angular features (NOT round, NOT soft)"

3. FEATURES DISTINTIVAS - OBRIGATORIO examinar e descrever (ou afirmar ausencia):
   - Piercings: orelha, nariz, labio, sobrancelha - descrever localizacao EXATA (qual lado, material)
   - Tattoos visiveis - localizacao e descricao
   - Freckles / sardas - densidade e localizacao
   - Moles / pintas distintivas - localizacao
   - Dimples / covinhas
   - Birthmarks, scars
   - Gap entre dentes, dentes salientes
   
   Se nenhuma feature distintiva visivel, escrever: "no visible piercings, tattoos, moles or freckles, clean even skin".

4. IDADE PRECISA em faixa estreita - "woman aged 32-35, mature adult features with subtle smile lines" - nao use apenas "young" ou "adult".

5. ORDEM OBRIGATORIA de descricao:
   a) Face shape + jawline + cheekbones
   b) Skin tone + undertone (com negacoes)
   c) Eyes (color + shape + size)
   d) Eyebrows (color + shape + thickness)
   e) Nose (shape + tip)
   f) Lips (fullness + shape + natural color)
   g) Hair (color DETALHADA + texture + length)
   h) Features distintivas (item 3)
   i) Age estimate preciso
   j) Makeup status (natural / light / heavy)

6. Entre 120 e 180 palavras. Menos que 120 = nao suficientemente especifico.

REGRAS para bodyDescription:

- Se corpo visivel (pelo menos tronco): descrever build especifico (slim athletic / curvy natural / petite delicate / tall slender) com shoulder width, waist definition, hip proportions. 30-60 palavras.
- Se foto e so headshot/rosto: retornar string VAZIA "".
- Nunca inventar o que nao e visivel.

VERIFICACAO antes de retornar:
- Se alguem lesse sua descricao SEM ver a foto, gerariam essa PESSOA ESPECIFICA ou uma pessoa "tipo" essa?
- Incluiu pelo menos 2 features distintivas (ou afirmou ausencia)?
- Usou negacoes?
Se sua descricao valeria pra "qualquer mulher de 30 anos com cabelo claro" - REESCREVA mais especifico.

FORMATO:
- Sem markdown, sem backticks
- Retorne APENAS o JSON valido
- Strings em ingles tecnico limpo`;

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
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
              text: 'Analise esta foto com precisao forense conforme as regras. Priorize ESPECIFICIDADE e FEATURES DISTINTIVAS. Retorne APENAS o JSON.'
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
      console.error(`[analyze-identity v2.6.1] Anthropic error ${response.status}:`, errText);
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
      console.error('[analyze-identity v2.6.1] JSON parse error:', e.message, 'Raw:', clean.substring(0, 300));
      return res.status(500).json({
        error: 'Failed to parse Claude response as JSON',
        raw: clean.substring(0, 500)
      });
    }

    console.log(`[analyze-identity v2.6.1] OK: face=${(parsed.facePrompt||'').length}ch, body=${(parsed.bodyDescription||'').length}ch`);

    return res.status(200).json({
      facePrompt: parsed.facePrompt || '',
      bodyDescription: parsed.bodyDescription || ''
    });
  } catch (error) {
    console.error('[analyze-identity v2.6.1] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
