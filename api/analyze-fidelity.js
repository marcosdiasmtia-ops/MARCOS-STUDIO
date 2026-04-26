// api/analyze-fidelity.js (v1.0 — análise opcional de fidelidade do produto)
//
// Endpoint que compara IMAGEM GERADA vs FOTOS DO PRODUTO REAL e retorna
// checklist FACTUAL (não subjetivo) listando o que bateu e o que divergiu.
//
// USO TÍPICO NO FLUXO VTON v2.0:
//   1. Usuário gera imagem frontal via Nano Banana Pro
//   2. Usuário vê a imagem
//   3. Usuário clica "🔍 Analisar fidelidade do produto" (opcional)
//   4. Esse endpoint é chamado com:
//      - generatedImageUrl       → imagem que foi gerada
//      - productFrontPhotoUrl    → foto on-model frontal do produto real
//      - productBackPhotoUrl     → foto on-model de costas (opcional)
//      - productAnalysis         → análise prévia do produto (frontDescription, etc)
//      - viewType                → 'frontal' ou 'back' (qual lado a imagem gerada mostra)
//   5. Claude Vision compara as 2 imagens e retorna checklist
//
// PRINCÍPIOS:
//   - Checklist FACTUAL (✅ bate / ⚠️ divergiu) — sem nota subjetiva
//   - Foco em itens que afetam VENDA no TikTok Shop
//   - Sem alertar sobre divergências irrelevantes (cor de unha, brincos)
//   - Hierarquia (Regra 8): Fidelidade > Identidade > Cenário > Fotorrealismo
//
// Output (JSON):
//   {
//     overall: 'aprovado' | 'aprovado_com_ressalvas' | 'reprovado',
//     summary: 'breve resumo em pt-br',
//     checklist: [
//       { item: 'Cor', status: 'ok' | 'divergente' | 'na', detail: '...' },
//       { item: 'Tipo de peça', status: '...', detail: '...' },
//       ...
//     ],
//     criticalIssues: [ 'lista de divergências sérias que afetam venda' ],
//     minorIssues: [ 'divergências leves que não afetam' ]
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
      generatedImageUrl,        // URL da imagem que foi gerada (Nano Banana ou anexada)
      productFrontPhotoUrl,     // URL da foto frontal do produto real
      productBackPhotoUrl,      // URL da foto de costas do produto real (opcional)
      productAnalysis,          // { frontDescription, backDescription, ... } do analyze-product-vton
      viewType = 'frontal'      // 'frontal' | 'back' (qual lado a imagem gerada mostra)
    } = req.body;

    if (!generatedImageUrl) {
      return res.status(400).json({ error: 'generatedImageUrl is required' });
    }
    if (!productFrontPhotoUrl) {
      return res.status(400).json({ error: 'productFrontPhotoUrl is required' });
    }

    // Determina qual foto do produto usar como referência principal
    const primaryProductUrl = (viewType === 'back' && productBackPhotoUrl)
      ? productBackPhotoUrl
      : productFrontPhotoUrl;

    const productDesc = (viewType === 'back' && productAnalysis?.backDescription)
      ? productAnalysis.backDescription
      : (productAnalysis?.frontDescription || '');

    const systemPrompt = `Você é um auditor de qualidade do MARCOS-STUDIO. Sua tarefa é comparar a IMAGEM GERADA com a FOTO DO PRODUTO REAL e retornar um CHECKLIST FACTUAL (não subjetivo) listando o que bateu e o que divergiu.

═══════════════════════════════════════════════════════════
PRINCÍPIO CRÍTICO — FACTUAL, NÃO SUBJETIVO
═══════════════════════════════════════════════════════════

NUNCA dar nota subjetiva tipo "9/10" ou "ficou linda".
SEMPRE listar fatos:
  ✅ "Cor azul marinho — bate"
  ⚠️ "Fenda frontal não apareceu"
  ⚠️ "Tecido aparece fosco em vez de acetinado"
  ✅ "Decote square com alças finas — bate"

═══════════════════════════════════════════════════════════
HIERARQUIA DE AVALIAÇÃO (Regra 8 do Notion)
═══════════════════════════════════════════════════════════

Por ordem de importância:
1. FIDELIDADE AO PRODUTO (mais crítico — afeta venda no TikTok Shop)
2. IDENTIDADE da influencer
3. CENÁRIO coerente
4. FOTORREALISMO

Esse endpoint foca PRINCIPALMENTE em FIDELIDADE AO PRODUTO.

═══════════════════════════════════════════════════════════
ITENS DO CHECKLIST PADRÃO
═══════════════════════════════════════════════════════════

Para cada item, determine status:
  - "ok"          → bate com o produto real
  - "divergente"  → não bate (descreva exatamente o quê)
  - "na"          → não aplicável neste tipo de peça

Itens padrão a verificar (nem todos se aplicam a toda peça):

1. Cor (cor exata e tonalidade)
2. Tipo de peça (vestido, conjunto, top, etc)
3. Comprimento (mini, midi, longo)
4. Decote (square, V, halter, redondo, etc)
5. Alças/Mangas (finas, grossas, sem alças, manga curta, manga longa, etc)
6. Cintura (fitted, loose, natural, alta)
7. Fenda/abertura (frontal, lateral, sem fenda)
8. Tecido (caimento, brilho, textura — fluido vs estruturado, fosco vs acetinado)
9. Detalhes traseiros (zíper, recorte, lace-up, etc) — se viewType=back
10. Acessórios da modelo do produto que vazaram para a imagem gerada (tatuagem, joias específicas, etc)

═══════════════════════════════════════════════════════════
CRITÉRIO DE OVERALL
═══════════════════════════════════════════════════════════

- "aprovado"               → 0 divergências críticas, ≤2 divergências menores
- "aprovado_com_ressalvas" → 0-1 divergências críticas, ≥3 divergências menores
- "reprovado"              → ≥2 divergências críticas

DIVERGÊNCIA CRÍTICA = afeta venda no TikTok Shop (publicidade enganosa)
  Ex: cor errada, tipo errado, comprimento errado, fenda do produto não apareceu

DIVERGÊNCIA MENOR = leve, não afeta percepção do produto
  Ex: textura ligeiramente diferente, sapato substituído (esperado), pose levemente diferente

═══════════════════════════════════════════════════════════
ATENÇÃO ESPECIAL — Anti-contaminação
═══════════════════════════════════════════════════════════

Se a foto do produto real tem características da MODELO (não da peça):
  - Tatuagens
  - Cor de unha
  - Maquiagem específica
  - Anel/relógio/colar pessoal
  - Tom de pele específico

E essas características VAZARAM pra imagem gerada da influencer cadastrada,
SINALIZE como divergência (Bug 9 do Notion).

═══════════════════════════════════════════════════════════
OUTPUT — formato exato
═══════════════════════════════════════════════════════════

Retorne APENAS um JSON válido. Schema:

{
  "overall": "aprovado" | "aprovado_com_ressalvas" | "reprovado",
  "summary": "breve resumo em pt-br (1-2 frases) sobre fidelidade geral",
  "checklist": [
    {
      "item": "Cor",
      "status": "ok" | "divergente" | "na",
      "detail": "descrição em pt-br"
    },
    { "item": "Tipo de peça", ... },
    ...
  ],
  "criticalIssues": [
    "lista em pt-br de divergências SÉRIAS que afetam venda no TikTok Shop"
  ],
  "minorIssues": [
    "lista em pt-br de divergências leves que não afetam"
  ]
}

═══════════════════════════════════════════════════════════
FORMATO DE SAÍDA — CRÍTICO
═══════════════════════════════════════════════════════════

⚠️ Sua resposta DEVE ser EXCLUSIVAMENTE o JSON. Nada antes, nada depois.

❌ NÃO escreva: "Após analisar..." antes do JSON
❌ NÃO use markdown fences

✅ Primeira linha começa com: {
✅ Última linha termina com: }`;

    const userContent = [
      {
        type: 'image',
        source: {
          type: 'url',
          url: generatedImageUrl
        }
      },
      {
        type: 'image',
        source: {
          type: 'url',
          url: primaryProductUrl
        }
      },
      {
        type: 'text',
        text: `INPUT DO USUÁRIO:

Você está vendo 2 imagens nessa ordem:
  1ª imagem = IMAGEM GERADA pelo MARCOS-STUDIO (a influencer cadastrada usando o produto)
  2ª imagem = FOTO ON-MODEL DO PRODUTO REAL (o produto que deveria estar sendo vestido)

Tipo de vista: ${viewType.toUpperCase()}

Descrição técnica do produto (do analyze-product-vton):
${productDesc || 'não disponível'}

TAREFA:
1. COMPARE a 1ª imagem (gerada) com a 2ª imagem (produto real)
2. Foque em FIDELIDADE AO PRODUTO (Regra 8)
3. Liste cada item do checklist com status: ok / divergente / na
4. Classifique divergências em criticalIssues vs minorIssues
5. Determine overall: aprovado / aprovado_com_ressalvas / reprovado
6. Retorne APENAS o JSON conforme schema definido`
      }
    ];

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
            content: userContent
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error('[analyze-fidelity] Claude API error:', claudeResponse.status, errText);
      return res.status(500).json({ error: `Claude API error: ${claudeResponse.status}` });
    }

    const claudeData = await claudeResponse.json();
    const rawText = claudeData?.content?.[0]?.text || '';

    if (!rawText) {
      return res.status(500).json({ error: 'No text in Claude response' });
    }

    let parsed;
    try {
      let jsonText = rawText.trim();

      jsonText = jsonText
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/\s*```\s*/g, '')
        .trim();

      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');
      if (firstBrace > 0 || lastBrace < jsonText.length - 1) {
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonText = jsonText.substring(firstBrace, lastBrace + 1);
        }
      }

      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error('[analyze-fidelity] Failed to parse Claude output:', rawText.substring(0, 500));
      return res.status(500).json({
        error: 'Failed to parse fidelity analysis',
        rawOutput: rawText.substring(0, 1000),
        parseError: parseErr.message
      });
    }

    // Validação leve
    if (!parsed?.overall || !parsed?.summary || !Array.isArray(parsed?.checklist)) {
      return res.status(500).json({
        error: 'Invalid fidelity analysis schema',
        rawOutput: parsed
      });
    }

    // Garante arrays mesmo se vier null/undefined
    if (!Array.isArray(parsed.criticalIssues)) parsed.criticalIssues = [];
    if (!Array.isArray(parsed.minorIssues)) parsed.minorIssues = [];

    console.log(
      '[analyze-fidelity] OK:',
      `overall=${parsed.overall},`,
      `checklist=${parsed.checklist.length},`,
      `critical=${parsed.criticalIssues.length},`,
      `minor=${parsed.minorIssues.length}`
    );
    return res.status(200).json(parsed);

  } catch (error) {
    console.error('[analyze-fidelity] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
