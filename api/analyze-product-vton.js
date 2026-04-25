// api/analyze-product-vton.js (v1.0 — VTON análise dupla)
//
// Analisa AS DUAS fotos do produto (frontal + costas) numa ÚNICA chamada
// ao Claude Vision e retorna:
//   - frontDescription:  descrição técnica APENAS da frente do produto
//   - backDescription:   descrição técnica APENAS das costas do produto
//   - hasBackInterest:   boolean — vale a pena exibir as costas?
//   - backReason:        string — explicação do hasBackInterest
//
// Esse endpoint é o equivalente VTON do api/analyze-product.js legacy,
// mas com 3 melhorias críticas:
//   1. Analisa frontal+costas numa só chamada (economia de tempo)
//   2. Retorna flag hasBackInterest pra Claude decidir roteiros
//   3. Mantém anti-contaminação da modelo do produto (Bug 9 FLUX legacy)
//
// PRINCÍPIO ANTI-CONTAMINAÇÃO (vem da v2.7.1 do legacy):
//   - Claude DESCREVE APENAS A PEÇA, ignora a modelo do produto
//   - Não menciona tatuagens, pele, cabelo, rosto, maquiagem da modelo
//   - Trata a peça como se estivesse num "manequim abstrato"
//
// Input:
//   {
//     frontBase64,    // foto frontal do produto on-model
//     frontMimeType,  // padrão image/jpeg
//     backBase64,     // foto de costas do produto on-model
//     backMimeType,
//     productName,    // nome do produto (opcional, ajuda contexto)
//     productDescription  // descrição do fornecedor (opcional)
//   }
//
// Output (JSON):
//   {
//     frontDescription: string,    // ~60-120 palavras, técnica em inglês
//     backDescription:  string,    // ~60-120 palavras, técnica em inglês
//     hasBackInterest:  boolean,   // true se vale a pena exibir costas
//     backReason:       string     // pt-br, explicação curta
//   }

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
      frontBase64,
      frontMimeType,
      backBase64,
      backMimeType,
      productName,
      productDescription
    } = req.body;

    if (!frontBase64) {
      return res.status(400).json({ error: 'frontBase64 is required' });
    }
    if (!backBase64) {
      return res.status(400).json({ error: 'backBase64 is required' });
    }

    const finalFrontMime = frontMimeType || 'image/jpeg';
    const finalBackMime = backMimeType || 'image/jpeg';

    const productContext = (productName || productDescription)
      ? `\nCONTEXTO ADICIONAL DO PRODUTO:\n${productName ? `Nome: ${productName}\n` : ''}${productDescription ? `Descrição do fornecedor: ${productDescription}\n` : ''}`
      : '';

    const systemPrompt = `Você é um especialista em análise visual de roupas para geração de imagens por IA num sistema VTON (Virtual Try-On).

MISSÃO: olhar 2 fotos de uma peça (frontal + costas) e retornar:
1. Descrição técnica APENAS DA PEÇA frontal (ignorando a modelo)
2. Descrição técnica APENAS DA PEÇA costas (ignorando a modelo)
3. Análise se vale a pena exibir as costas em vídeos VTON

Retorne APENAS um JSON válido. Sem prose, sem markdown, sem explicação fora do JSON.

Schema:
{
  "frontDescription": "descrição técnica em inglês, ~60-120 palavras, APENAS a peça frontal",
  "backDescription":  "descrição técnica em inglês, ~60-120 palavras, APENAS a peça costas",
  "hasBackInterest":  true | false,
  "backReason":       "explicação curta em português brasileiro do porquê hasBackInterest é true ou false"
}

═══════════════════════════════════════════════════════════
REGRA 1 — ANTI-CONTAMINAÇÃO DA MODELO DO PRODUTO
═══════════════════════════════════════════════════════════

NUNCA mencione na descrição:
- Tatuagens da modelo (mesmo se muito visíveis)
- Cor/tipo de pele da modelo
- Cabelo (cor, comprimento, estilo) da modelo
- Rosto, maquiagem, expressão da modelo
- Joias/acessórios pessoais (brincos, anéis, pulseiras)
- Tipo corporal ou proporções específicas da modelo
- Altura aparente da modelo

A peça deve ser descrita como se estivesse num MANEQUIM ABSTRATO, isolada, sem nenhuma pessoa visível. Se você perceber características distintivas da modelo (especialmente tatuagens), IGNORE sistematicamente.

═══════════════════════════════════════════════════════════
REGRA 2 — O QUE DESCREVER EM CADA VISTA
═══════════════════════════════════════════════════════════

FRONTAL (frontDescription):
1. Tipo de peça (peça única, conjunto, vestido, macacão, etc.)
2. Corte: simétrico vs assimétrico, peplum, decote, alças, mangas
3. Cintura: fitted vs loose, natural vs high
4. Frente da calça/saia: pregas, bolsos, fechamentos
5. Cor exata e tecido aparente
6. Detalhes incomuns no INÍCIO (assimetrias, recortes, etc.)

COSTAS (backDescription):
1. Decote/alças nas costas (square, V, halter, etc.)
2. Fechamento traseiro: zipper (especificar posição), botões, etc.
3. Peplum visto de trás (se houver)
4. Costas da calça: bolsos, costuras, vincos
5. Recortes ou detalhes traseiros (cutouts, lace-up, drapeados)
6. Cinto, faixa, ou ausência deles

═══════════════════════════════════════════════════════════
REGRA 3 — ANTI-INVENÇÃO (validado em 24/04/2026)
═══════════════════════════════════════════════════════════

Descreva APENAS o que VÊ na foto. Não invente:
- Não invente cinto que não existe
- Não invente bolsos que não aparecem
- Não invente costuras decorativas que não tem
- Não invente fechamento se não vê

Se algo não está claro/visível, escreva "plain" / "uniform" / "smooth" em vez de inventar detalhes.

═══════════════════════════════════════════════════════════
REGRA 4 — DECISÃO DE hasBackInterest
═══════════════════════════════════════════════════════════

hasBackInterest = TRUE quando as costas TÊM detalhes que enriquecem a venda:
- Decote nas costas (V, square deep, open back)
- Zíper traseiro decorativo
- Amarração no pescoço/costas (halter, lace-up)
- Recortes (cutouts) traseiros
- Peplum assimétrico que aparece nas costas
- Estampa, bordado ou aplicação traseira
- Botões, fivelas, ou detalhes decorativos atrás

hasBackInterest = FALSE quando as costas são lisas/genéricas:
- Top básico fechado por trás sem detalhe
- Calça/saia traseira lisa, sem bolsos visíveis nem detalhes
- Nada que motive um cliente a "ver as costas" antes de comprar

backReason: explicação curta em português brasileiro (1-2 frases).
- Se TRUE: justificar com os detalhes específicos
- Se FALSE: justificar com a falta de detalhes

═══════════════════════════════════════════════════════════
REGRA 5 — FORMATO DAS DESCRIÇÕES
═══════════════════════════════════════════════════════════

- Em inglês técnico de moda
- 60-120 palavras cada
- Começar com a peça e características marcantes
- Mencionar cor exata e tecido aparente
- Sem markdown, sem aspas adicionais

═══════════════════════════════════════════════════════════
EXEMPLO DE OUTPUT VÁLIDO
═══════════════════════════════════════════════════════════

{
  "frontDescription": "Two-piece outfit in pale sky-blue opaque crepe fabric. Top is a sleeveless square-neck tank with thin straps and an asymmetric peplum hem at the waist, with one side falling longer than the other. Pants are wide-leg with high natural waistband and small belt loops, fully opaque solid color uniform from waist to hem, with a smooth flat front showing only a subtle center crease.",
  "backDescription": "Back of the top is a sleeveless square-back tank style with thin shoulder straps over the shoulders, asymmetric peplum hem visible at the waist with one side longer than the other, central back seam with a zipper closure running from the top of the back to the waistline. Back of the pants is completely plain and uniform, with no back pockets, no zipper, and no decorative seams — only a smooth flat surface of pale sky-blue fabric from waistband to hem.",
  "hasBackInterest": true,
  "backReason": "As costas têm um zíper decorativo central que vai do topo até a cintura, peplum assimétrico visível e decote square traseiro — detalhes relevantes que valem ser exibidos pra valorizar a peça."
}

${productContext}

═══════════════════════════════════════════════════════════
VOCÊ VAI RECEBER 2 IMAGENS NESTA ORDEM:
1ª imagem = vista FRONTAL do produto
2ª imagem = vista de COSTAS do produto

Aplique as 5 regras. Output APENAS o JSON.`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
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
                  media_type: finalFrontMime,
                  data: frontBase64
                }
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: finalBackMime,
                  data: backBase64
                }
              },
              {
                type: 'text',
                text: 'Analyze BOTH images (1st = front, 2nd = back) and return ONLY the JSON object as specified.'
              }
            ]
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error('[analyze-product-vton] Claude API error:', claudeResponse.status, errText);
      return res.status(500).json({ error: `Claude API error: ${claudeResponse.status}` });
    }

    const claudeData = await claudeResponse.json();
    const rawText = claudeData?.content?.[0]?.text || '';

    let parsed;
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[analyze-product-vton] Failed to parse Claude output:', rawText);
      return res.status(500).json({
        error: 'Failed to parse product analysis',
        rawOutput: rawText
      });
    }

    // Validação leve do schema
    if (!parsed?.frontDescription || !parsed?.backDescription) {
      return res.status(500).json({
        error: 'Missing front or back description in response',
        rawOutput: parsed
      });
    }
    if (typeof parsed.hasBackInterest !== 'boolean') {
      return res.status(500).json({
        error: 'hasBackInterest must be boolean',
        rawOutput: parsed
      });
    }
    if (!parsed?.backReason) {
      return res.status(500).json({
        error: 'Missing backReason in response',
        rawOutput: parsed
      });
    }

    console.log(
      '[analyze-product-vton] OK:',
      `front=${parsed.frontDescription.length} chars,`,
      `back=${parsed.backDescription.length} chars,`,
      `hasBackInterest=${parsed.hasBackInterest}`
    );
    return res.status(200).json(parsed);

  } catch (error) {
    console.error('[analyze-product-vton] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
