// api/analyze-product.js (v2.7 — product vision analysis)
// Analisa foto de peça de roupa via Claude Vision e retorna descricao
// tecnica detalhada do corte/design para usar como ancora de produto
// em prompts do Nano Banana. Objetivo: forcar o modelo a preservar
// detalhes incomuns (cortes assimetricos, decotes unicos, drapeados).

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { base64, mimeType, view } = req.body;
    if (!base64) return res.status(400).json({ error: 'Product photo base64 is required' });

    const viewLabel = view === 'back' ? 'COSTAS (back view)' : 'FRONTAL (front view)';

    const systemPrompt = `Voce e um especialista em analise visual de roupas para geracao de imagens por IA.

MISSAO: olhar a foto de uma peca de roupa com precisao FORENSE e descrever TODOS os detalhes de design, corte, caimento e construcao. Sua descricao sera usada como ancora em prompts do Nano Banana para forcar o modelo a recriar a peca EXATAMENTE como e, sem simplificar ou tornar simetrica uma peca assimetrica.

Retorne APENAS um JSON valido:
{
  "productDescription": "descricao tecnica em ingles"
}

REGRAS CRITICAS:

1. ESPECIFICIDADE de corte e design - examine ATIVAMENTE:
   - E uma peca unica (macacao/vestido) ou conjunto (blusa + calca)?
   - O corte e simetrico ou ASSIMETRICO? Se assimetrico, descrever qual lado e diferente e como.
   - Tem peplum (peca solta caindo da cintura)? Se sim: simetrico ou assimetrico? Comprimento? Direcao?
   - Decote: square, V-neck, round, off-shoulder, halter, high-neck, sweetheart, etc.
   - Alcas: thin/thick, straight/crossed/halter, largura especifica
   - Tipo de manga: sleeveless, cap sleeve, short sleeve, 3/4, long, puff
   - Cintura: fitted/loose, natural/high/drop, com ou sem costura marcada
   - Barra/hem: straight, asymmetric, curved, handkerchief, ruffled
   - Detalhes especiais: cutouts (recortes vazados), drapeados, pregas, franzidos, laces
   - Fechamento: zipper (localizacao), buttons, laces
   - Fenda: localizacao e altura

2. FIT/CAIMENTO:
   - Bodice: fitted/loose/structured
   - Silhouette: A-line, column, mermaid, wide-leg, straight-leg, flared
   - Para calcas/pantalonas: wide-leg / straight / flared / tapered / skinny

3. COR e TECIDO:
   - Cor especifica (ex: "powder blue" nao "blue", "dusty rose" nao "pink")
   - Tecido aparente (crepe, cotton, denim, satin, knit, linen, chiffon)
   - Textura (smooth, ribbed, textured, pleated)

4. DETALHES INCOMUNS sao OBRIGATORIOS:
   - Se a peca tem qualquer elemento fora do comum (corte assimetrico, decote unusual, recorte vazado, peplum oblique), destacar no INICIO da descricao
   - Usar negacoes quando relevante: "ASYMMETRIC peplum falling ONLY to the left side (NOT symmetric, NOT all-around)"

5. FORMATO:
   - Descricao entre 60 e 120 palavras
   - Em ingles tecnico de moda
   - Sem markdown, sem backticks
   - Retornar APENAS o JSON

CONTEXTO: esta e a vista ${viewLabel}. Descreva o que voce ve DESTE angulo. Se e FRONTAL, foque no decote, frente do bodice, e frente da calca/saia. Se e COSTAS, foque nas costas (zipper, recorte das costas, peplum visto de tras).

VERIFICACAO antes de retornar:
- Uma pessoa lendo minha descricao SEM ver a foto reproduziria este EXATO produto?
- Se e assimetrico, disse explicitamente?
- Destaquei os detalhes incomuns?
- Usei nomes tecnicos de moda?

Se a resposta for "nao" para qualquer uma, REESCREVA com mais precisao.`;

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1536,
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
              text: `Analise esta peca de roupa (vista ${viewLabel}) com precisao forense conforme as regras. Priorize DETALHES DE DESIGN e ASSIMETRIAS. Retorne APENAS o JSON.`
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
      console.error(`[analyze-product] Anthropic error ${response.status}:`, errText);
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
      console.error('[analyze-product] JSON parse error:', e.message, 'Raw:', clean.substring(0, 300));
      return res.status(500).json({
        error: 'Failed to parse Claude response as JSON',
        raw: clean.substring(0, 500)
      });
    }

    console.log(`[analyze-product] OK (${view || 'frontal'}): ${(parsed.productDescription||'').length}ch`);

    return res.status(200).json({
      productDescription: parsed.productDescription || ''
    });
  } catch (error) {
    console.error('[analyze-product] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
