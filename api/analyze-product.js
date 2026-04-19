// api/analyze-product.js (v2.7.1 — anti-model contamination)
// Analisa foto de peca de roupa via Claude Vision e retorna descricao
// tecnica detalhada APENAS do corte/design da peca, IGNORANDO totalmente
// a modelo/pessoa que esta vestindo na foto. Isso evita que features
// da modelo do produto (tatuagens, pele, cabelo) vazem para o prompt
// do Nano Banana e contaminem a influencer gerada.

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

MISSAO CRITICA: olhar a foto de uma peca de roupa e descrever APENAS A PECA (como se estivesse num manequim abstrato). IGNORAR COMPLETAMENTE a modelo/pessoa que esta vestindo a peca.

Sua descricao sera usada como ancora em prompts do Nano Banana, que vai aplicar a peca numa outra pessoa (a influencer). Portanto qualquer mencao a features da modelo atual (tatuagens, cabelo, pele, rosto, maquiagem, acessorios corporais) vai causar contaminacao indesejada.

============================================================
REGRA ABSOLUTA: PROIBICAO DE DESCREVER A MODELO
============================================================

NUNCA mencione:
- Tatuagens da modelo (mesmo se muito visiveis)
- Cor/tipo de pele da modelo
- Cabelo (cor, comprimento, estilo) da modelo
- Rosto, maquiagem, expressao da modelo
- Joias/acessorios que sao corporais da modelo (brincos, aneis, pulseiras pessoais)
- Tipo corporal ou proporcoes especificas da modelo
- Altura aparente da modelo

A peca deve ser descrita como se fosse fotografada num MANEQUIM ABSTRATO, isolada, sem nenhuma pessoa visivel. Se voce perceber caracteristicas distintivas da modelo, IGNORE-AS sistematicamente.

============================================================
O QUE DESCREVER (apenas a peca)
============================================================

Retorne APENAS um JSON valido:
{
  "productDescription": "descricao tecnica em ingles, SOMENTE sobre a peca"
}

1. TIPO DE PECA:
   - Peca unica (macacao, vestido, jumpsuit) ou conjunto (blusa + calca)?
   - Para conjunto: descrever cada peca separadamente.

2. CORTE e DESIGN (mais importante):
   - Simetrico ou ASSIMETRICO? Se assimetrico, qual lado e diferente e como.
   - Tem peplum? Simetrico ou assimetrico? Comprimento? Direcao?
   - Decote: square, V-neck, round, off-shoulder, halter, high-neck, sweetheart, etc.
   - Alcas: thin/thick, straight/crossed/halter, largura
   - Manga: sleeveless, cap sleeve, short, 3/4, long, puff
   - Cintura: fitted/loose, natural/high/drop, com costura marcada ou nao
   - Barra/hem: straight, asymmetric, curved, handkerchief, ruffled
   - Detalhes: cutouts (recortes), drapeados, pregas, franzidos
   - Fechamento: zipper (localizacao na peca, ex: "back zipper closure"), buttons, laces
   - Fenda: localizacao e altura

3. SILHUETA e CAIMENTO:
   - Bodice: fitted/loose/structured
   - Silhueta: A-line, column, mermaid, etc.
   - Para calcas: wide-leg / straight / flared / tapered / skinny

4. COR e TECIDO:
   - Cor especifica (ex: "powder blue", "dusty rose")
   - Tecido aparente (crepe, cotton, denim, satin, knit, etc.)
   - Textura (smooth, ribbed, textured, pleated)

5. DETALHES INCOMUNS em destaque:
   - Se a peca tem elemento fora do comum (corte assimetrico, decote unusual, recorte vazado), destacar no INICIO
   - Usar negacoes: "ASYMMETRIC peplum falling ONLY to left side (NOT symmetric)"

============================================================
FORMATO
============================================================

- Descricao entre 60 e 120 palavras
- Em ingles tecnico de moda
- Sem markdown, sem backticks
- Retornar APENAS o JSON valido
- ZERO mencao a qualquer caracteristica pessoal da modelo

CONTEXTO: esta e a vista ${viewLabel}. Descreva o que voce ve DESTE angulo.
- FRONTAL: decote, frente do bodice, frente da calca/saia
- COSTAS: costas da peca (zipper, recorte, peplum visto de tras, detalhe das costas da blusa)

============================================================
VERIFICACAO OBRIGATORIA antes de retornar
============================================================

1. Minha descricao menciona tatuagem? => REMOVER
2. Minha descricao menciona cabelo ou cor de pele? => REMOVER
3. Minha descricao menciona rosto, maquiagem, joias pessoais? => REMOVER
4. Minha descricao descreve o formato do corpo da modelo? => REMOVER
5. Se aplicar minha descricao num manequim, funcionaria igualmente bem? SE NAO, REESCREVER.

A descricao e SOMENTE sobre a peca, nunca sobre quem veste.`;

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
              text: `Analise esta peca (vista ${viewLabel}) descrevendo APENAS a roupa em si, como se estivesse num manequim. IGNORE COMPLETAMENTE a modelo/pessoa que a esta vestindo — sem mencionar tatuagens, cabelo, pele, rosto ou qualquer feature pessoal. Retorne APENAS o JSON.`
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
      console.error(`[analyze-product v2.7.1] Anthropic error ${response.status}:`, errText);
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
      console.error('[analyze-product v2.7.1] JSON parse error:', e.message, 'Raw:', clean.substring(0, 300));
      return res.status(500).json({
        error: 'Failed to parse Claude response as JSON',
        raw: clean.substring(0, 500)
      });
    }

    // v2.7.1 — defense-in-depth: sanitize output e remove mencoes residuais
    // a tatuagens/pele/etc. que possam ter escapado do prompt
    let productDescription = parsed.productDescription || '';
    const sanitizePatterns = [
      /[^.]*\btattoo[s]?\b[^.]*\./gi,
      /[^.]*\bmodel\b[^.]*\./gi,
      /[^.]*\bwearer\b[^.]*\./gi,
      /[^.]*\bskin tone\b[^.]*\./gi,
      /[^.]*\bhair (color|length|style)\b[^.]*\./gi,
    ];
    for (const pattern of sanitizePatterns) {
      productDescription = productDescription.replace(pattern, '');
    }
    productDescription = productDescription.replace(/\s{2,}/g, ' ').trim();

    console.log(`[analyze-product v2.7.1] OK (${view || 'frontal'}): ${productDescription.length}ch`);

    return res.status(200).json({
      productDescription
    });
  } catch (error) {
    console.error('[analyze-product v2.7.1] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
