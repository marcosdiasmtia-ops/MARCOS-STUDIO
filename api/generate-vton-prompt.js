// api/generate-vton-prompt.js (v1.2 — movementPlan + conversion-focused)
//
// MUDANÇAS v1.2 (vs v1.1):
//   - Schema do roteiro ganha campo "movementPlan" (descreve o vídeo, não só a imagem)
//   - hasBack DEFAULT = true em quase todos os roteiros (movimento valoriza)
//   - CTA fixo: "olha pra câmera + leve sorriso natural" nos últimos 2-3s
//   - Queries do web_search focadas em CONVERSÃO TikTok Shop, não estética
//   - Schema retorna também videoPrompt (instrução pro Kling)
//
// PRINCÍPIOS — validados em 24/04/2026:
//   - Template UGC com 13 blocos parametrizados (Regra 1)
//   - "wearing the outfit from reference image" curto basta (Regra 2)
//   - Looking over shoulder INTENCIONAL é válido em back_3_4 (Regra 4)
//   - Cabelo estratégico revela detalhes (Regra 5)
//   - Anti-fenótipo hardcoded (Regra 15 do Notion)
//   - Movimentos NÃO travados — Claude decide via web_search dinâmico
//   - CTA = ÚNICA regra hardcoded (regra de copywriting comercial)

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
      preferredScene
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

    const systemPrompt = `Você é o gerador de roteiros UGC do MARCOS-STUDIO, um sistema de geração de vídeos de afiliação para TikTok Shop. Sua tarefa é gerar 3 ROTEIROS DIFERENTES de VÍDEO UGC autêntico (não apenas imagens).

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
  
Cada IMAGEM-CHAVE é gerada pelo Nano Banana Pro com:
  - image 1 = facePhoto da influencer (close-up)
  - image 2 = foto on-model do produto (frontal OU costas)
  - prompt  = template UGC de 13 blocos (você gera)

Depois, o Kling 3.0 anima usando AS IMAGENS-CHAVE + um videoPrompt
descrevendo o movimento entre elas.

═══════════════════════════════════════════════════════════
PIPELINE DE CADA ROTEIRO
═══════════════════════════════════════════════════════════

CASO A — Roteiro com movimento que ENVOLVE costas/3-4 (RECOMENDADO):
  1. Gera imagem inicial (pose costas ou 3-4) com Nano Banana Pro 
     usando foto frontal OU costas do produto
  2. Gera imagem CTA final (frontal, olhando pra câmera, sorriso) 
     com Nano Banana Pro usando foto frontal do produto
  3. Kling anima do início até o CTA = vídeo de 15s
  → hasBack = true ($0,30 em imagens + $1,68 Kling = $1,98 total)

CASO B — Roteiro frontal puro (raro, só em peças triviais):
  1. Gera 1 imagem CTA frontal
  2. Kling anima movimento pequeno (caminhada, olhar) = vídeo de 15s
  → hasBack = false ($0,15 em imagens + $1,68 Kling = $1,83 total)

REGRA: PREFERIR CASO A (hasBack=true) na MAIORIA dos roteiros.
Movimento de costas/3-4 valoriza qualquer peça em vídeo, mesmo
peças "simples". Apenas use CASO B se o produto for muito básico
e o movimento extra não agregar valor.

═══════════════════════════════════════════════════════════
WEB SEARCH — FOCO EM CONVERSÃO COMERCIAL
═══════════════════════════════════════════════════════════

ANTES de escrever os 3 roteiros, USE web_search com queries 
focadas em CONVERSÃO/VENDAS, não estética turística:

✅ Queries CERTAS (sobre o que VENDE):
  - "best video movements TikTok Shop fashion conversion"
  - "what makes fashion videos sell TikTok Shop 2026"
  - "highest converting UGC fashion movements women"
  - "movements that valorize clothing in video commerce"
  - "fashion try-on video patterns highest CTR TikTok"

❌ Queries ERRADAS (sobre estética turística):
  - "trending travel destinations" (turismo, não venda)
  - "popular Instagram locations" (estética, não conversão)
  - "best UGC backgrounds" (cenário, não movimento)

Use até 4 web_searches. O objetivo é descobrir:
  1. Que TIPOS DE MOVIMENTO performam em fashion TikTok Shop hoje
  2. Que CENÁRIOS estão convertendo mais (não só "bonitos")
  3. Padrões específicos pro tipo de produto que está sendo vendido

═══════════════════════════════════════════════════════════
CTA FINAL — REGRA FIXA (NÃO MUDAR)
═══════════════════════════════════════════════════════════

Os ÚLTIMOS 2-3 SEGUNDOS de TODO vídeo terminam com:
  → Influencer olhando pra câmera com leve sorriso natural

Esse é o CTA visual padrão do MARCOS-STUDIO. Não varia.

A IMAGEM CTA final é gerada SEMPRE com:
  - Pose: frontal, olhando pra câmera
  - Expressão: leve sorriso natural, gentle confident
  - Mãos: relaxadas ou com 1 ação sutil (segurar bolsa, ajustar peça)

O promptFrontal de cada roteiro é EXATAMENTE essa imagem CTA final.

═══════════════════════════════════════════════════════════
TEMPLATE-PAI UGC (13 blocos) — siga exatamente
═══════════════════════════════════════════════════════════

Cada prompt UGC (frontal ou costas) tem 13 blocos. Comprimento alvo: 1300-1500 caracteres.

1. POSE_DIRECTIVE — abre o prompt com a pose
   FRONTAL CTA: "Woman standing facing camera in [SCENE], gently confident posture, looking directly at camera with leve sorriso natural"
   BACK_3_4: "Woman standing with back mostly toward camera in [SCENE], torso and head turned smoothly to the [SIDE] to look over her [SIDE] shoulder directly at camera with poised elegant expression"
   COSTAS PURA: "Woman standing with back fully toward camera in [SCENE], strict rear view, no face visible"

2. BODY_HINT (opcional, só se influencer.bodyHint != null)
   "[bodyHint] build, natural feminine proportions"

3. HANDS_ACTION — ação concreta de mãos
   FRONTAL CTA exemplos: "one hand resting on waist, the other holding a small handbag at her side"
   BACK_3_4 exemplos: "right hand gently touching the base of her neck, left hand holding [OBJECT] by her side"

4. EXPRESSION
   FRONTAL CTA (FIXO): "leve sorriso natural, gentle confident expression looking directly at camera"
   BACK_3_4: "poised elegant expression"
   COSTAS PURA: omitir bloco (sem rosto visível)

5. OUTFIT (FIXO — não inventar)
   "wearing the outfit from reference image"

6. SHOES — coerente com o cenário

7. HAIR — VEM DO PERFIL DA INFLUENCER
   "[texture] [color] hair [styling]"
   FRONTAL CTA: "loose with natural movement falling past shoulders"
   BACK_3_4 styling: "loose falling over the [OPPOSITE_SIDE] shoulder revealing the back of the top"

8. ACCESSORIES — coerente com vibe + cenário

9. SCENE_PARAGRAPH — descrição rica do cenário (60-100 palavras)

10. LIGHTING — coerente com hora do dia

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

Schema completo:

{
  "roteiros": [
    {
      "id": "roteiro_1",
      "sceneName": "nome curto descritivo do cenário em pt-br",
      "description": "Descrição em português brasileiro (1-2 frases) descrevendo O VÍDEO COMPLETO (cenário + movimento + CTA), pra UI do Marcos",
      
      "movementPlan": {
        "inicio": "descrição em pt-br do movimento inicial do vídeo (1-2 frases)",
        "transicao": "descrição em pt-br do movimento de transição/meio (1-2 frases)",
        "cta": "olha para a câmera com leve sorriso natural"
      },
      
      "hasBack": true | false,
      "estimatedCost": 0.30 | 0.15,
      
      "promptFrontal": "Template UGC de 13 blocos pra IMAGEM CTA FINAL (frontal, olhando pra câmera, sorriso natural)",
      
      "promptBack": null | "Template UGC de 13 blocos pra IMAGEM INICIAL DO VÍDEO (costas ou 3-4 conforme movementPlan.inicio)",
      
      "videoPrompt": "Instrução em INGLÊS pro Kling 3.0 descrevendo o movimento completo do vídeo, do frame inicial até o CTA. ~80-150 palavras. Exemplo: 'Camera static. Woman starts in [pose inicial], slowly [transição]. At the end, she [CTA fixo]. Smooth natural movement, gentle pace, fashion video style.'"
    },
    { "id": "roteiro_2", ... },
    { "id": "roteiro_3", ... }
  ]
}

REGRAS DE preenchimento:
- "hasBack" = true (RECOMENDADO na maioria) quando o vídeo envolve movimento de costas/3-4 (mais valorizador). 
  hasBack = false só em casos onde o produto é trivial e movimento de costas não agrega.
- "promptFrontal" = sempre obrigatório, é a IMAGEM CTA FINAL (frontal, olha pra câmera + sorriso).
- "promptBack" = null se hasBack=false. Se hasBack=true, é a IMAGEM INICIAL DO VÍDEO (costas pura ou 3-4 conforme movementPlan).
- "estimatedCost" = 0.30 se hasBack, senão 0.15.
- "videoPrompt" = sempre obrigatório, descreve movimento que o Kling vai animar entre as imagens-chave.
- "movementPlan" = sempre obrigatório, é o plano em pt-br do vídeo (mostrado ao usuário antes de gerar).
- "movementPlan.cta" = SEMPRE "olha para a câmera com leve sorriso natural" (FIXO).

═══════════════════════════════════════════════════════════
FORMATO DE SAÍDA — CRÍTICO
═══════════════════════════════════════════════════════════

⚠️ Sua resposta DEVE ser EXCLUSIVAMENTE o JSON. Nada antes, nada depois.

❌ NÃO escreva: "Com base na pesquisa..." antes do JSON
❌ NÃO escreva: "Aqui estão os 3 roteiros:" antes do JSON
❌ NÃO use markdown fences (\`\`\`json ou \`\`\`)
❌ NÃO use a chave "Roteiros" com R maiúsculo — use "roteiros" com r minúsculo
❌ NÃO escreva nenhuma observação após o JSON

✅ A primeira linha da sua resposta DEVE começar com: {
✅ A última linha da sua resposta DEVE terminar com: }
✅ Use exatamente a chave "roteiros" (lowercase) no nível raiz`;

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
1. Use web_search com queries focadas em CONVERSÃO TikTok Shop fashion (não turismo)
2. Descubra que MOVIMENTOS valorizam o tipo específico desse produto
3. Descubra que CENÁRIOS estão convertendo bem agora
4. Gere 3 ROTEIROS de VÍDEO diferentes (não imagens estáticas)
5. PREFIRA hasBack=true na maioria (movimento valoriza)
6. CTA final SEMPRE fixo: "olha para a câmera com leve sorriso natural"
7. Cada roteiro deve ter: cenário + movimento inicial + transição + CTA fixo
8. Cada roteiro inclui: promptFrontal (CTA), promptBack (inicial se hasBack), videoPrompt (Kling), movementPlan (pt-br)
9. Retorne APENAS o JSON conforme schema definido`;

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
      console.error('[generate-vton-prompt] No text block in response:', JSON.stringify(claudeData).substring(0, 500));
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

    // Validação leve do schema novo (v1.2)
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
          error: `Roteiro ${i + 1} has incomplete movementPlan (need inicio/transicao/cta)`,
          rawOutput: r
        });
      }

      if (typeof r.hasBack !== 'boolean') {
        return res.status(500).json({
          error: `Roteiro ${i + 1} has invalid hasBack`,
          rawOutput: r
        });
      }

      if (!r.promptFrontal) {
        return res.status(500).json({
          error: `Roteiro ${i + 1} missing promptFrontal (CTA image)`,
          rawOutput: r
        });
      }
      if (r.hasBack && !r.promptBack) {
        return res.status(500).json({
          error: `Roteiro ${i + 1} has hasBack=true but no promptBack`,
          rawOutput: r
        });
      }
      if (!r.videoPrompt) {
        return res.status(500).json({
          error: `Roteiro ${i + 1} missing videoPrompt (Kling instruction)`,
          rawOutput: r
        });
      }

      // Garantir consistência de custo
      r.estimatedCost = r.hasBack ? 0.30 : 0.15;

      // Garantir CTA fixo (proteção contra Claude desviar do padrão)
      r.movementPlan.cta = 'olha para a câmera com leve sorriso natural';
    }

    console.log(
      '[generate-vton-prompt] OK:',
      parsed.roteiros.map(r => `${r.id}=${r.sceneName} (hasBack=${r.hasBack})`).join(' | ')
    );
    return res.status(200).json(parsed);

  } catch (error) {
    console.error('[generate-vton-prompt] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
