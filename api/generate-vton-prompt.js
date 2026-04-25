// api/generate-vton-prompt.js (v1.0 — coração do template UGC)
//
// Endpoint mais sofisticado do pipeline VTON. Recebe:
//   - perfil da influencer cadastrada (hair, ageHint, vibe, signature, bodyHint)
//   - descrições do produto (frontDescription, backDescription, hasBackInterest)
//   - tipo de roteiro (frontal | back_3_4 | both)
//   - opcionalmente, cenário "preferido" (caso Marcos queira variar)
//
// Faz:
//   1. Claude Sonnet 4 com web_search_20250305 ativo
//   2. Pesquisa cenários UGC trending pra TikTok Shop feminino
//   3. Monta o prompt UGC seguindo o template-pai de 13 blocos
//   4. Retorna 3 ROTEIROS DIFERENTES, cada um com cenário único
//   5. Cada roteiro vem etiquetado com tipo de pose (frontal | back_3_4)
//
// Output (JSON):
//   {
//     roteiros: [
//       {
//         id: "roteiro_1",
//         sceneName: "lisboa rooftop sunset",
//         poseType: "frontal" | "back_3_4",
//         hasBack: boolean,
//         promptFrontal: "...",
//         promptBack: "..." | null,
//         estimatedCost: 0.30 | 0.15,
//         description: "Pôr do sol em rooftop em Lisboa..."  // pt-br pra UI
//       },
//       ...
//     ]
//   }
//
// PRINCÍPIOS — validados em 24/04/2026:
//   - Template UGC com 13 blocos parametrizados (Regra 1)
//   - "wearing the outfit from reference image" curto basta (Regra 2)
//   - Looking over shoulder INTENCIONAL é válido em back_3_4 (Regra 4)
//   - Cabelo estratégico revela detalhes (Regra 5)
//   - Anti-fenótipo hardcoded (Regra 15 do Notion)
//   - Comprimento alvo: 1300-1500 chars

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
      influencer,        // { name, hair, ageHint, vibe, signature, bodyHint }
      product,           // { name, frontDescription, backDescription, hasBackInterest }
      preferredScene     // string opcional, ex: "praia brasil" — se omitido, Claude decide
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

    // System prompt completo — explica template-pai e regras de geração
    const systemPrompt = `Você é o gerador de roteiros UGC do MARCOS-STUDIO, um sistema de geração de vídeos de afiliação para TikTok Shop. Sua tarefa é gerar 3 ROTEIROS DIFERENTES de imagens UGC autênticas pra uma influencer cadastrada usando um produto de moda.

═══════════════════════════════════════════════════════════
PIPELINE — Onde esses prompts serão usados
═══════════════════════════════════════════════════════════

Cada roteiro será executado pelo Nano Banana Pro (modelo de geração de imagem semântico) com:
  - image 1 = facePhoto da influencer (close-up de rosto)
  - image 2 = foto on-model do produto (frontal OU costas)
  - prompt  = o texto UGC que você gera

A imagem gerada vai virar quadro estático. Depois passa pro Kling 3.0 que anima em vídeo de 15s.

Os 3 roteiros devem ser DIFERENTES entre si:
  - Cenários DIFERENTES (Lisboa, praia BR, café Paris, etc)
  - Poses/ações DIFERENTES (em pé, encostada, andando, sentada)
  - Hora do dia / iluminação DIFERENTES (sunset, noon, blue hour)

Se o produto tem hasBackInterest=true, **pelo menos 1 dos 3 roteiros deve ser back_3_4** (mostra costas/3-4 da peça pra valorizar detalhes traseiros). Os outros podem ser frontais.

Se hasBackInterest=false, os 3 roteiros são frontais.

═══════════════════════════════════════════════════════════
WEB SEARCH — Use para buscar cenários trending
═══════════════════════════════════════════════════════════

ANTES de escrever os 3 roteiros, USE web_search com queries como:
  - "TikTok Shop fashion content scenarios trending 2026"
  - "best UGC backgrounds women fashion videos"
  - "popular travel locations TikTok fashion influencer"
  - "Instagram fashion photo location ideas"

Use isso pra buscar 3 cenários DIFERENTES e ATUAIS que estão performando bem em conteúdo de moda feminina no TikTok Shop. Pode ser:
  - Cidades icônicas (Lisboa, Paris, NYC, Tokyo, Santorini)
  - Cenários naturais (praia, vinhedo, campo de flores, montanha)
  - Espaços urbanos (rooftop, café, metrô, festival)
  - Apartamentos minimalistas estilo Pinterest
  - Locações exóticas

NÃO repita os mesmos cenários todo dia. Cada chamada deve buscar atualizações.

═══════════════════════════════════════════════════════════
TEMPLATE-PAI UGC (13 blocos) — siga exatamente
═══════════════════════════════════════════════════════════

Cada prompt UGC tem 13 blocos. Comprimento alvo: 1300-1500 caracteres.

1. POSE_DIRECTIVE — abre o prompt com a pose
   FRONTAL: "Woman standing facing camera in [SCENE], weight relaxed on one leg, [POSITION DETAILS]"
   BACK_3_4: "Woman standing with back mostly toward camera in [SCENE], torso and head turned smoothly to the [SIDE] to look over her [SIDE] shoulder directly at camera with poised elegant expression"

2. BODY_HINT (opcional, só se influencer.bodyHint != null)
   "[bodyHint] build, natural feminine proportions"

3. HANDS_ACTION — ação concreta de mãos
   FRONTAL exemplos: "one hand resting lightly on a [SURFACE], the other holding [OBJECT]"
   BACK_3_4 exemplos: "right hand gently touching the base of her neck, left hand holding [OBJECT] by her side"

4. EXPRESSION
   FRONTAL: "gentle natural smile toward camera as if a friend just took the photo"
   BACK_3_4: "poised elegant expression"

5. OUTFIT (FIXO — não inventar)
   "wearing the outfit from reference image"

6. SHOES — coerente com o cenário
   "[shoes type] [color]" — ex: "nude pointed-toe slingback heels", "white sneakers", "leather sandals"

7. HAIR — VEM DO PERFIL DA INFLUENCER
   "[texture] [color] hair [styling]"
   FRONTAL styling: "loose with natural movement falling past shoulders catching [LIGHT]"
   BACK_3_4 styling: "loose falling over the [OPPOSITE_SIDE] shoulder revealing the back of the top and exposing shoulder and upper back"
   IMPORTANTE: hair styling em back_3_4 sempre cai no lado OPOSTO do giro pra revelar costas

8. ACCESSORIES — coerente com vibe + cenário
   "small [TYPE] earrings, thin delicate [TYPE] necklace, [BAG]"

9. SCENE_PARAGRAPH — descrição rica do cenário (60-100 palavras)
   Detalhar: vista, elementos arquitetônicos, paisagem natural, distintivos, hora

10. LIGHTING — coerente com hora do dia
    "[golden hour | overcast | blue hour | midday | morning] lighting, [warm/cool] [glow/light], [soft/long] shadows"

11. CAMERA (FIXO)
    "shot with static tripod at eye level, 50mm equivalent focal length, photographed with iPhone 15 Pro, f/1.9 aperture, soft creamy bokeh"

12. AUTHENTICITY (FIXO)
    "fine visible pores on skin, natural peach fuzz catching the light, subtle smile lines, slight natural skin irregularity, fabric slightly creased where body bends"

13. FORMAT (FIXO)
    "full body visible head to toe, vertical 9:16 format"

═══════════════════════════════════════════════════════════
GATILHOS A EVITAR (Regra 15 do Notion)
═══════════════════════════════════════════════════════════

NUNCA INCLUA palavras de fenótipo descritivo direto:
- ❌ "slim", "slender", "thin", "athletic build", "petite" (a menos que venha de bodyHint do perfil)
- ❌ "early thirties", "young adult", "mature woman"
- ❌ "caucasian", "european features", "asian features"
- ❌ "image 1", "image 2" — use "the first image", "reference image"
- ❌ "no tattoos", "no jewelry" (negações invocam o objeto)
- ❌ Descrição detalhada do produto (use "wearing the outfit from reference image" só)

═══════════════════════════════════════════════════════════
OUTPUT — formato exato
═══════════════════════════════════════════════════════════

Retorne APENAS um JSON válido (sem markdown, sem prose). Schema:

{
  "roteiros": [
    {
      "id": "roteiro_1",
      "sceneName": "Lisbon rooftop sunset",
      "poseType": "frontal" | "back_3_4",
      "hasBack": true | false,
      "promptFrontal": "Woman standing facing camera...",
      "promptBack": null | "Woman standing with back mostly toward camera...",
      "estimatedCost": 0.30 | 0.15,
      "description": "Descrição curta em português brasileiro (1-2 frases) pra UI do Marcos"
    },
    { "id": "roteiro_2", ... },
    { "id": "roteiro_3", ... }
  ]
}

REGRAS DE preenchimento:
- "poseType" = "back_3_4" SE for um roteiro que mostra costas/3-4 (envolve a pose de costas).
- "hasBack" = true quando o roteiro vai gerar imagem frontal E também imagem de costas (custa $0,30).
  hasBack = false quando o roteiro só gera frontal (custa $0,15).
- "promptFrontal" = sempre obrigatório.
- "promptBack" = null se hasBack=false. Se hasBack=true, é o prompt UGC pra costas (mesmo cenário, pose back_3_4).
- "estimatedCost" = 0.30 se hasBack, senão 0.15.

Se product.hasBackInterest=true, distribuir: pelo menos 1 roteiro com hasBack=true. Os outros, pode variar.
Se product.hasBackInterest=false, todos os 3 roteiros com hasBack=false.`;

    // User content — passa os dados do perfil + produto
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

TAREFA:
1. Use web_search pra buscar 3 cenários TRENDING pra UGC TikTok Shop feminino
2. Gere 3 ROTEIROS diferentes, seguindo o template-pai de 13 blocos
3. Cada roteiro com cenário, pose, e iluminação ÚNICOS
4. ${product.hasBackInterest ? 'Pelo menos 1 dos 3 roteiros deve ter hasBack=true' : 'Todos os 3 roteiros com hasBack=false'}
5. Retorne APENAS o JSON conforme schema definido`;

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

    // Extrai o último bloco de texto (depois das tool_use de web_search)
    const textBlocks = (claudeData?.content || []).filter(b => b.type === 'text');
    const finalText = textBlocks.length > 0 ? textBlocks[textBlocks.length - 1].text : '';

    if (!finalText) {
      console.error('[generate-vton-prompt] No text block in response:', JSON.stringify(claudeData).substring(0, 500));
      return res.status(500).json({ error: 'No text in Claude response' });
    }

    let parsed;
    try {
      const cleaned = finalText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[generate-vton-prompt] Failed to parse Claude output:', finalText.substring(0, 500));
      return res.status(500).json({
        error: 'Failed to parse roteiros JSON',
        rawOutput: finalText.substring(0, 1000)
      });
    }

    // Validação leve
    if (!Array.isArray(parsed?.roteiros) || parsed.roteiros.length !== 3) {
      return res.status(500).json({
        error: 'Expected exactly 3 roteiros',
        rawOutput: parsed
      });
    }

    for (let i = 0; i < parsed.roteiros.length; i++) {
      const r = parsed.roteiros[i];
      if (!r.id || !r.sceneName || !r.poseType || typeof r.hasBack !== 'boolean' || !r.promptFrontal || !r.description) {
        return res.status(500).json({
          error: `Roteiro ${i + 1} has missing required fields`,
          rawOutput: r
        });
      }
      if (r.hasBack && !r.promptBack) {
        return res.status(500).json({
          error: `Roteiro ${i + 1} has hasBack=true but no promptBack`,
          rawOutput: r
        });
      }
      // Garantir consistência de custo
      r.estimatedCost = r.hasBack ? 0.30 : 0.15;
    }

    console.log(
      '[generate-vton-prompt] OK:',
      parsed.roteiros.map(r => `${r.id}=${r.sceneName} (${r.poseType}, hasBack=${r.hasBack})`).join(' | ')
    );
    return res.status(200).json(parsed);

  } catch (error) {
    console.error('[generate-vton-prompt] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
