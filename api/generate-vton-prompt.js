// api/generate-vton-prompt.js (v2.0 — modo dual: roteiros_only + all)
//
// MUDANÇAS v2.0 (vs v1.2):
//   - NOVO MODO "roteiros_only": retorna SÓ os 3 roteiros (sceneName,
//     description, movementPlan, hasBack, videoPrompt) SEM gerar prompts
//     pesados. Permite arquitetura de aprovação manual onde os prompts
//     de imagem são gerados sob demanda (chamada separada).
//   - MODO "all" (legado, default): retorna 3 roteiros COM promptFrontal e
//     promptBack já gerados (compatibilidade com v1.2).
//
// PRINCÍPIOS (mantidos):
//   - Template UGC com 13 blocos parametrizados
//   - "wearing the outfit from reference image" curto basta
//   - Anti-fenótipo hardcoded (Regra 15 do Notion)
//   - Movimentos NÃO travados — Claude decide via web_search dinâmico
//   - CTA fixo (única regra hardcoded)

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
      influencer,
      product,
      preferredScene,
      mode = 'all'  // 'all' (legado) | 'roteiros_only' (novo VTON v2.0)
    } = req.body;

    if (!influencer?.hair?.color || !influencer?.hair?.texture || !influencer?.hair?.length) {
      return res.status(400).json({ error: 'influencer.hair (color/texture/length) is required' });
    }
    if (!product?.frontDescription) {
      return res.status(400).json({ error: 'product.frontDescription is required' });
    }
    if (typeof product?.hasBackInterest !== 'boolean') {
      return res.status(400).json({ error: 'product.hasBackInterest (boolean) is required' });
    }

    const sceneHint = preferredScene
      ? `\nO USUÁRIO PEDIU CENÁRIO ESPECÍFICO: "${preferredScene}". Use isso como um dos 3 roteiros (pode adaptar).\n`
      : '';

    const isRoteirosOnly = mode === 'roteiros_only';

    // System prompt diferente conforme modo
    const systemPrompt = isRoteirosOnly
      ? buildRoteirosOnlyPrompt()
      : buildFullPrompt();

    const userContent = `INPUT DO USUÁRIO:

INFLUENCER CADASTRADA:
- Nome: ${influencer.name || 'não informado'}
- Cabelo: ${influencer.hair.color}, textura ${influencer.hair.texture}, comprimento ${influencer.hair.length}
- ageHint: ${influencer.ageHint || 'não especificado'}
- Vibe: ${influencer.vibe || 'não especificado'}
- Pele: ${influencer.signature?.skin || 'não especificado'}
- Sinal distintivo: ${influencer.signature?.accent || 'nenhum'}
- Maquiagem: ${influencer.signature?.makeup || 'soft natural'}
- Body hint: ${influencer.bodyHint || 'NULL — não usar bloco BODY_HINT'}

PRODUTO:
- Nome: ${product.name || 'não informado'}
- Frente: ${product.frontDescription}
- Costas: ${product.backDescription || 'não disponível'}
- Vale exibir costas? ${product.hasBackInterest ? 'SIM' : 'NÃO'}
- Razão: ${product.backReason || 'não informada'}
${sceneHint}

TAREFA (modo: ${mode}):
${isRoteirosOnly
  ? '1. Use web_search com queries focadas em CONVERSÃO TikTok Shop fashion\n2. Gere 3 ROTEIROS curtos (somente metadados, SEM promptFrontal/promptBack ainda)\n3. Cada roteiro: sceneName + description + movementPlan + hasBack + videoPrompt\n4. PREFIRA hasBack=true na maioria (movimento valoriza)\n5. CTA final SEMPRE fixo: "olha para a câmera com leve sorriso natural"\n6. Retorne APENAS o JSON conforme schema definido'
  : '1. Use web_search com queries focadas em CONVERSÃO TikTok Shop fashion\n2. Gere 3 ROTEIROS COMPLETOS (com promptFrontal e promptBack)\n3. PREFIRA hasBack=true na maioria\n4. CTA final SEMPRE fixo\n5. Retorne APENAS o JSON conforme schema definido'
}`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 4
          }
        ],
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
      console.error('[generate-vton-prompt] Claude API error:', claudeResponse.status, errText);
      return res.status(500).json({ error: `Claude API error: ${claudeResponse.status}` });
    }

    const claudeData = await claudeResponse.json();
    const textBlocks = (claudeData?.content || []).filter(b => b.type === 'text');
    const finalText = textBlocks.length > 0 ? textBlocks[textBlocks.length - 1].text : '';

    if (!finalText) {
      console.error('[generate-vton-prompt] No text block in response');
      return res.status(500).json({ error: 'No text in Claude response' });
    }

    let parsed;
    try {
      let jsonText = finalText.trim();

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

      if (parsed && parsed.Roteiros && !parsed.roteiros) {
        parsed.roteiros = parsed.Roteiros;
        delete parsed.Roteiros;
      }
    } catch (parseErr) {
      console.error('[generate-vton-prompt] Failed to parse Claude output:', finalText.substring(0, 500));
      return res.status(500).json({
        error: 'Failed to parse roteiros JSON',
        rawOutput: finalText.substring(0, 1000),
        parseError: parseErr.message
      });
    }

    if (!Array.isArray(parsed?.roteiros) || parsed.roteiros.length !== 3) {
      return res.status(500).json({
        error: 'Expected exactly 3 roteiros',
        rawOutput: parsed
      });
    }

    // Validação leve do schema (diferente conforme modo)
    for (let i = 0; i < parsed.roteiros.length; i++) {
      const r = parsed.roteiros[i];

      if (!r.id || !r.sceneName || !r.description) {
        return res.status(500).json({
          error: `Roteiro ${i + 1} has missing required fields (id/sceneName/description)`,
          rawOutput: r
        });
      }

      if (!r.movementPlan?.inicio || !r.movementPlan?.transicao || !r.movementPlan?.cta) {
        return res.status(500).json({
          error: `Roteiro ${i + 1} has incomplete movementPlan`,
          rawOutput: r
        });
      }

      if (typeof r.hasBack !== 'boolean') {
        return res.status(500).json({
          error: `Roteiro ${i + 1} has invalid hasBack`,
          rawOutput: r
        });
      }

      if (!r.videoPrompt) {
        return res.status(500).json({
          error: `Roteiro ${i + 1} missing videoPrompt`,
          rawOutput: r
        });
      }

      // Modo legado precisa dos prompts; modo roteiros_only NÃO
      if (!isRoteirosOnly) {
        if (!r.promptFrontal) {
          return res.status(500).json({
            error: `Roteiro ${i + 1} missing promptFrontal (mode=all requires it)`,
            rawOutput: r
          });
        }
        if (r.hasBack && !r.promptBack) {
          return res.status(500).json({
            error: `Roteiro ${i + 1} has hasBack=true but no promptBack`,
            rawOutput: r
          });
        }
      }

      // Garantir consistência de custo
      r.estimatedCost = r.hasBack ? 0.30 : 0.15;

      // Garantir CTA fixo (proteção contra Claude desviar do padrão)
      r.movementPlan.cta = 'olha para a câmera com leve sorriso natural';
    }

    console.log(
      `[generate-vton-prompt] OK (mode=${mode}):`,
      parsed.roteiros.map(r => `${r.id}=${r.sceneName} (hasBack=${r.hasBack})`).join(' | ')
    );
    return res.status(200).json(parsed);

  } catch (error) {
    console.error('[generate-vton-prompt] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ═════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT — modo "roteiros_only" (NOVO v2.0)
// ═════════════════════════════════════════════════════════════════════════
function buildRoteirosOnlyPrompt() {
  return `Você é o gerador de roteiros UGC do MARCOS-STUDIO. Sua tarefa é gerar 3 ROTEIROS de VÍDEO UGC autênticos pra TikTok Shop.

NESTE MODO (roteiros_only), você gera APENAS metadados dos roteiros. Os prompts pesados (promptFrontal e promptBack) serão gerados depois, sob demanda, em chamadas separadas. Isso permite que o usuário aprove cada etapa antes de gastar recursos.

═══════════════════════════════════════════════════════════
WEB SEARCH — FOCO EM CONVERSÃO COMERCIAL
═══════════════════════════════════════════════════════════

Use web_search (até 4 vezes) com queries focadas em CONVERSÃO/VENDAS:

✅ Queries CERTAS:
  - "best video movements TikTok Shop fashion conversion"
  - "what makes fashion videos sell TikTok Shop 2026"
  - "highest converting UGC fashion movements women"
  - "fashion try-on video patterns highest CTR TikTok"

❌ Queries ERRADAS:
  - "trending travel destinations" (turismo, não venda)
  - "popular Instagram locations" (estética, não conversão)

═══════════════════════════════════════════════════════════
CTA FINAL — REGRA FIXA
═══════════════════════════════════════════════════════════

Os ÚLTIMOS 2-3 SEGUNDOS de TODO vídeo terminam com a influencer
olhando pra câmera com leve sorriso natural. NÃO varia.

═══════════════════════════════════════════════════════════
hasBack — PREFERIR true
═══════════════════════════════════════════════════════════

PREFIRA hasBack=true na MAIORIA dos roteiros. Movimento de costas/3-4 
valoriza qualquer peça em vídeo, mesmo peças "simples". Use hasBack=false 
SÓ se o produto for muito básico.

═══════════════════════════════════════════════════════════
OUTPUT — Schema (modo roteiros_only)
═══════════════════════════════════════════════════════════

{
  "roteiros": [
    {
      "id": "roteiro_1",
      "sceneName": "nome curto descritivo do cenário em pt-br",
      "description": "Descrição em pt-br (1-2 frases) descrevendo O VÍDEO COMPLETO",
      
      "movementPlan": {
        "inicio": "movimento inicial em pt-br",
        "transicao": "movimento de transição em pt-br",
        "cta": "olha para a câmera com leve sorriso natural"
      },
      
      "hasBack": true | false,
      "estimatedCost": 0.30 | 0.15,
      
      "videoPrompt": "Instrução em INGLÊS pro Kling 3.0 (~80-150 palavras)"
    },
    { "id": "roteiro_2", ... },
    { "id": "roteiro_3", ... }
  ]
}

NOTA: NÃO inclua "promptFrontal" nem "promptBack" neste modo. Eles serão gerados depois, em chamadas separadas, quando o usuário decidir gerar a imagem.

═══════════════════════════════════════════════════════════
FORMATO DE SAÍDA — CRÍTICO
═══════════════════════════════════════════════════════════

⚠️ Sua resposta DEVE ser EXCLUSIVAMENTE o JSON. Nada antes, nada depois.

❌ NÃO escreva: "Com base na pesquisa..." antes do JSON
❌ NÃO use markdown fences (\`\`\`json ou \`\`\`)
❌ NÃO use a chave "Roteiros" com R maiúsculo

✅ A primeira linha DEVE começar com: {
✅ A última linha DEVE terminar com: }
✅ Use exatamente a chave "roteiros" (lowercase)`;
}

// ═════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT — modo "all" (LEGADO v1.2)
// ═════════════════════════════════════════════════════════════════════════
function buildFullPrompt() {
  return `Você é o gerador de roteiros UGC do MARCOS-STUDIO, um sistema de geração de vídeos de afiliação para TikTok Shop. Sua tarefa é gerar 3 ROTEIROS DIFERENTES de VÍDEO UGC autêntico (não apenas imagens).

═══════════════════════════════════════════════════════════
DIFERENÇA CRÍTICA — Roteiro = VÍDEO completo, não imagem
═══════════════════════════════════════════════════════════

Cada roteiro descreve um VÍDEO de 15 segundos completo, com:
  - Movimento inicial (como o vídeo começa)
  - Movimento de transição (revelando a peça)
  - Movimento CTA final (FIXO — sempre o mesmo)

Pra gerar o vídeo, o sistema precisa de IMAGENS-CHAVE:
  - Imagem do INÍCIO do vídeo (frame 1) — pose inicial
  - Imagem do CTA final (último frame) — pose CTA fixa

═══════════════════════════════════════════════════════════
PIPELINE DE CADA ROTEIRO
═══════════════════════════════════════════════════════════

CASO A — Roteiro com movimento que ENVOLVE costas/3-4 (RECOMENDADO):
  hasBack = true ($0,30 em imagens + $1,68 Kling = $1,98 total)

CASO B — Roteiro frontal puro (raro, só em peças triviais):
  hasBack = false ($0,15 em imagens + $1,68 Kling = $1,83 total)

REGRA: PREFERIR CASO A (hasBack=true) na MAIORIA dos roteiros.

═══════════════════════════════════════════════════════════
WEB SEARCH — FOCO EM CONVERSÃO COMERCIAL
═══════════════════════════════════════════════════════════

✅ Queries CERTAS:
  - "best video movements TikTok Shop fashion conversion"
  - "what makes fashion videos sell TikTok Shop 2026"
  - "highest converting UGC fashion movements women"

═══════════════════════════════════════════════════════════
CTA FINAL — REGRA FIXA (NÃO MUDAR)
═══════════════════════════════════════════════════════════

Os ÚLTIMOS 2-3 SEGUNDOS terminam com:
  → Influencer olhando pra câmera com leve sorriso natural

═══════════════════════════════════════════════════════════
TEMPLATE-PAI UGC (13 blocos)
═══════════════════════════════════════════════════════════

Cada prompt UGC tem 13 blocos. Comprimento alvo: 1300-1500 caracteres.

1. POSE_DIRECTIVE
2. BODY_HINT (opcional)
3. HANDS_ACTION
4. EXPRESSION
5. OUTFIT (FIXO): "wearing the outfit from reference image"
6. SHOES
7. HAIR (vem do perfil)
8. ACCESSORIES
9. SCENE_PARAGRAPH
10. LIGHTING
11. CAMERA (FIXO): "shot with static tripod at eye level, 50mm equivalent focal length, photographed with iPhone 15 Pro, f/1.9 aperture, soft creamy bokeh"
12. AUTHENTICITY (FIXO): "fine visible pores on skin, natural peach fuzz catching the light, subtle smile lines, slight natural skin irregularity, fabric slightly creased where body bends"
13. FORMAT (FIXO): "full body visible head to toe, vertical 9:16 format"

═══════════════════════════════════════════════════════════
GATILHOS A EVITAR (Regra 15 do Notion)
═══════════════════════════════════════════════════════════

NUNCA INCLUA:
- ❌ "slim", "slender", "thin", "athletic build"
- ❌ "early thirties", "young adult"
- ❌ "caucasian", "european features"
- ❌ "image 1", "image 2"
- ❌ "no tattoos", "no jewelry"

═══════════════════════════════════════════════════════════
OUTPUT — Schema (modo all/legado)
═══════════════════════════════════════════════════════════

{
  "roteiros": [
    {
      "id": "roteiro_1",
      "sceneName": "...",
      "description": "...",
      "movementPlan": { "inicio": "...", "transicao": "...", "cta": "olha para a câmera com leve sorriso natural" },
      "hasBack": true | false,
      "estimatedCost": 0.30 | 0.15,
      "promptFrontal": "Template UGC 13 blocos pra IMAGEM CTA FINAL",
      "promptBack": null | "Template UGC 13 blocos pra IMAGEM INICIAL",
      "videoPrompt": "Instrução em INGLÊS pro Kling 3.0"
    },
    ...
  ]
}

═══════════════════════════════════════════════════════════
FORMATO DE SAÍDA — CRÍTICO
═══════════════════════════════════════════════════════════

⚠️ Sua resposta DEVE ser EXCLUSIVAMENTE o JSON.
✅ Primeira linha começa com: {
✅ Última linha termina com: }
✅ Chave "roteiros" lowercase`;
}
