// api/generate-back-prompt-vton.js (v1.0 — encadeamento serial frontal→costas)
//
// COMO FUNCIONA:
//
//   1. Recebe:
//      - frontalImageUrl  → URL da imagem frontal JÁ APROVADA pelo usuário
//      - influencer       → perfil cadastrado (hair, vibe, etc)
//      - product          → descrições + hasBackInterest
//      - movementPlan     → plano de movimento do roteiro (inicio/transicao/cta)
//
//   2. Claude Vision OLHA a imagem frontal real e EXTRAI elementos visuais:
//      - Cabelo (cor exata, textura, como está caindo)
//      - Iluminação (golden hour, blue hour, soft, hard)
//      - Cenário (todos os elementos visuais — paredes, janelas, objetos)
//      - Acessórios visíveis (joias, bolsa, calçados)
//      - Tom de pele atual
//      - Ângulo da câmera
//
//   3. Claude monta o promptBack referenciando esses elementos pra que a
//      imagem de costas seja VISUALMENTE CONSISTENTE com a frontal:
//      - "mesmo cabelo caindo igual ao da imagem 1"
//      - "mesma iluminação golden hour da imagem 1"
//      - "mesmo cenário rooftop com as mesmas plantas"
//      - "mesmas joias visíveis: brinco de argola dourado"
//
//   4. O promptBack final segue o template UGC de 13 blocos com
//      a pose adequada (back_3_4 ou costas pura conforme movementPlan.inicio).
//
// PRINCÍPIOS:
//   - Resolve inconsistência frontal↔costas no modo automático
//   - Resolve consistência quando usuário gerou frontal externamente
//   - Mantém Regra 15 do Notion (anti-fenótipo, agnóstico)
//   - Mantém CTA fixo (mas esse endpoint NÃO gera CTA — gera o início do vídeo)

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
      frontalImageUrl,    // URL da imagem frontal aprovada
      influencer,         // { name, hair, ageHint, vibe, signature, bodyHint }
      product,            // { frontDescription, backDescription, hasBackInterest }
      movementPlan,       // { inicio, transicao, cta }
      sceneName,          // nome do cenário (do roteiro selecionado)
      videoPrompt         // descrição do vídeo (opcional, contexto extra)
    } = req.body;

    if (!frontalImageUrl) {
      return res.status(400).json({ error: 'frontalImageUrl is required' });
    }
    if (!influencer?.hair?.color) {
      return res.status(400).json({ error: 'influencer.hair is required' });
    }
    if (!product?.frontDescription) {
      return res.status(400).json({ error: 'product.frontDescription is required' });
    }
    if (!movementPlan?.inicio) {
      return res.status(400).json({ error: 'movementPlan.inicio is required' });
    }

    const systemPrompt = `Você é o gerador de prompts de COSTAS do MARCOS-STUDIO. Sua tarefa é olhar uma imagem frontal JÁ GERADA e produzir um prompt UGC pra gerar a IMAGEM INICIAL DO VÍDEO (pose de costas/3-4) que seja VISUALMENTE CONSISTENTE com a frontal.

═══════════════════════════════════════════════════════════
PORQUE ISSO É IMPORTANTE
═══════════════════════════════════════════════════════════

No vídeo final do MARCOS-STUDIO, a imagem inicial (costas/3-4) e a imagem CTA final (frontal) precisam ter:
  - Mesmo cabelo (cor, textura, como cai)
  - Mesma iluminação (golden hour, hora do dia, intensidade)
  - Mesmo cenário (todos os elementos visíveis)
  - Mesmos acessórios (joias, bolsa, calçados)
  - Mesmo tom de pele
  - Mesmo enquadramento / ângulo de câmera

Senão o vídeo Kling fica inconsistente entre os 2 frames-chave.

Por isso você está olhando a imagem frontal real PRIMEIRO antes de escrever o prompt da costas.

═══════════════════════════════════════════════════════════
TAREFA EM 2 PASSOS
═══════════════════════════════════════════════════════════

PASSO 1 — Analise a imagem frontal e extraia:
  • Cabelo: cor exata visível, como está caindo (em qual ombro, como o vento ou luz interage)
  • Iluminação: tipo (golden hour, blue hour, indoor soft, hard noon), intensidade, direção
  • Cenário: TODOS os elementos visíveis (paredes, plantas, objetos, vista, materiais)
  • Acessórios: joias visíveis (brincos, colares, anéis), bolsa, sapatos
  • Tom de pele: como aparece sob essa iluminação
  • Ângulo de câmera: eye level, low angle, high angle
  • Cor/textura do roupa visível

PASSO 2 — Escreva o promptBack seguindo o template UGC de 13 blocos.
A pose vai ser back_3_4 ou costas pura conforme movementPlan.inicio.
TODOS os elementos visuais (cabelo, iluminação, cenário, acessórios) devem
ser DESCRITOS REFERENCIANDO o que você viu na imagem frontal.

═══════════════════════════════════════════════════════════
TEMPLATE-PAI UGC (13 blocos) — siga exatamente
═══════════════════════════════════════════════════════════

Cada prompt UGC tem 13 blocos. Comprimento alvo: 1300-1500 caracteres.

1. POSE_DIRECTIVE
   BACK_3_4: "Woman standing with back mostly toward camera in [SCENE], torso and head turned smoothly to the [SIDE] to look over her [SIDE] shoulder directly at camera with poised elegant expression"
   COSTAS PURA: "Woman standing with back fully toward camera in [SCENE], strict rear view, no face visible"

2. BODY_HINT (opcional, só se influencer.bodyHint != null)

3. HANDS_ACTION — ação concreta de mãos coerente com o movimento de início

4. EXPRESSION
   BACK_3_4: "poised elegant expression"
   COSTAS PURA: omitir bloco

5. OUTFIT (FIXO): "wearing the outfit from reference image"

6. SHOES — referenciar EXATAMENTE os sapatos vistos na imagem frontal

7. HAIR — VEM DO PERFIL + REFERENCIA A IMAGEM FRONTAL
   BACK_3_4 styling: "loose falling over the [OPPOSITE_SIDE] shoulder revealing the back of the top, exact same hair color and texture as in the front-facing reference image"
   IMPORTANTE: cabelo cai no lado OPOSTO ao giro pra revelar costas

8. ACCESSORIES — referenciar EXATAMENTE os acessórios vistos na imagem frontal

9. SCENE_PARAGRAPH — descrever o MESMO cenário da imagem frontal com o MESMO ângulo
   Use frases como: "same [SCENE_ELEMENTS] as in the front-facing reference image"

10. LIGHTING — referenciar EXATAMENTE a iluminação da imagem frontal
    "same [TIPO] lighting as in the front-facing reference image, identical intensity and direction"

11. CAMERA (FIXO): "shot with static tripod at eye level, 50mm equivalent focal length, photographed with iPhone 15 Pro, f/1.9 aperture, soft creamy bokeh"

12. AUTHENTICITY (FIXO): "fine visible pores on skin, natural peach fuzz catching the light, subtle smile lines, slight natural skin irregularity, fabric slightly creased where body bends"

13. FORMAT (FIXO): "full body visible head to toe, vertical 9:16 format"

═══════════════════════════════════════════════════════════
GATILHOS A EVITAR (Regra 15 do Notion)
═══════════════════════════════════════════════════════════

NUNCA INCLUA:
- ❌ "slim", "slender", "thin", "athletic build" (a menos que venha de bodyHint)
- ❌ "early thirties", "young adult"
- ❌ "caucasian", "european features"
- ❌ "image 1", "image 2" — use "the front-facing reference image"
- ❌ "no tattoos", "no jewelry"
- ❌ Descrição detalhada do produto (use "wearing the outfit from reference image")

═══════════════════════════════════════════════════════════
OUTPUT — formato exato
═══════════════════════════════════════════════════════════

Retorne APENAS um JSON válido. Schema:

{
  "promptBack": "Template UGC de 13 blocos completo (~1300-1500 chars), em inglês, com referências visuais à imagem frontal",
  "visualAnalysis": {
    "hair":       "descrição do cabelo extraída da imagem frontal",
    "lighting":   "descrição da iluminação extraída",
    "scene":      "elementos do cenário extraídos",
    "accessories": "acessórios visíveis extraídos",
    "skinTone":   "tom de pele observado"
  }
}

NOTA: visualAnalysis é só pra referência/debug. O promptBack é o que importa.

═══════════════════════════════════════════════════════════
FORMATO DE SAÍDA — CRÍTICO
═══════════════════════════════════════════════════════════

⚠️ Sua resposta DEVE ser EXCLUSIVAMENTE o JSON. Nada antes, nada depois.

❌ NÃO escreva: "Com base na análise..." antes do JSON
❌ NÃO use markdown fences

✅ Primeira linha começa com: {
✅ Última linha termina com: }`;

    const userContent = [
      {
        type: 'image',
        source: {
          type: 'url',
          url: frontalImageUrl
        }
      },
      {
        type: 'text',
        text: `INPUT DO USUÁRIO:

INFLUENCER:
- Cabelo cadastrado: ${influencer.hair.color}, ${influencer.hair.texture}, ${influencer.hair.length}
- Vibe: ${influencer.vibe || 'não especificado'}
- Pele: ${influencer.signature?.skin || 'não especificado'}
- Body hint: ${influencer.bodyHint || 'NULL — não usar bloco BODY_HINT'}

PRODUTO:
- Frente: ${product.frontDescription}
- Costas: ${product.backDescription || 'não disponível'}

CONTEXTO DO ROTEIRO:
- Cenário: ${sceneName || 'não especificado'}
- Movimento inicial do vídeo (descreve a pose desta imagem):
  "${movementPlan.inicio}"
- Movimento de transição: "${movementPlan.transicao}"
- CTA final (já gerado): "${movementPlan.cta}"
${videoPrompt ? `- Video prompt completo: ${videoPrompt}` : ''}

TAREFA:
1. ANALISE a imagem frontal acima (cabelo, iluminação, cenário, acessórios, etc)
2. ESCREVA o promptBack seguindo o template UGC de 13 blocos
3. Use referências EXPLÍCITAS à imagem frontal pra garantir consistência visual
4. A pose deve corresponder ao movementPlan.inicio
5. Retorne APENAS o JSON conforme schema definido`
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
        max_tokens: 4096,
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
      console.error('[generate-back-prompt-vton] Claude API error:', claudeResponse.status, errText);
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
      console.error('[generate-back-prompt-vton] Failed to parse Claude output:', rawText.substring(0, 500));
      return res.status(500).json({
        error: 'Failed to parse Claude output',
        rawOutput: rawText.substring(0, 1000),
        parseError: parseErr.message
      });
    }

    if (!parsed?.promptBack || typeof parsed.promptBack !== 'string') {
      return res.status(500).json({
        error: 'Invalid promptBack in response',
        rawOutput: parsed
      });
    }

    console.log(
      '[generate-back-prompt-vton] OK:',
      `chars=${parsed.promptBack.length}, hasAnalysis=${!!parsed.visualAnalysis}`
    );
    return res.status(200).json(parsed);

  } catch (error) {
    console.error('[generate-back-prompt-vton] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
