// api/ugc-veo-prompt.js (v1.0 — Claude Sonnet 4 gera prompts Veo 3 em inglês)
//
// Endpoint que gera os PROMPTS EM INGLÊS pra alimentar o Veo 3 frame-to-video.
// 1 prompt por take (8s cada), com 8 blocos no estilo Trendly-cinematic.
//
// PIPELINE COMPLETO (referência):
//   1. ugc-image-base → frame_take1.png (cena estática)
//   2. ugc-script    → roteiro com falas PT-BR por take
//   3. ugc-veo-prompt (este endpoint) → N prompts EN com 8 blocos ← VOCÊ ESTÁ AQUI
//   4. Marcos cola cada prompt no Veo Studio Ultra (manual, frame-to-video)
//   5. Veo Studio "Save frame as asset" → frame_takeN+1
//   6. CapCut concatena os N takes
//
// REFERÊNCIA na arquitetura UGC Falante v3.0:
//   - Tema 7 (Prompt Veo 3): 8 blocos (INTRO, ENVIRONMENT, VISUAL REALISM,
//     CAMERA, BEHAVIOR, SPEECH, PRODUCT INTERACTION, GENERAL GUIDELINES)
//   - Item 4 (Continuidade entre takes): cada take TERMINA em pose estável
//     pra servir de starting frame do próximo take
//   - Item 6 (Voz dinâmica): voiceId vem de /api/ugc-voice-recommend (vem
//     pré-resolvido no input deste endpoint)
//
// DECISÃO ARQUITETURAL: por que Claude (não template hard-coded)?
//   - 11 estilos × 26 cenários × 7 câmeras = 2002 combinações; template
//     ficaria travado e mecânico
//   - Continuidade entre takes pede orquestração inteligente (cada take é
//     uma "fase narrativa" diferente: hook, problema, produto, prova, CTA)
//   - Fala vem do script.js e precisa integrar fluidamente no bloco SPEECH
//   - Custo: ~$0,02/geração de N prompts. Aceitável.
//
// Espelha api/content.js + api/generate-vton-prompt.js.
//
// Input (POST body):
//   - influencer: { name, bodyDescription, vibe? }
//   - product: { name, description }
//   - styleId, durationId, cameraId, realismId, scenarioId, voiceId
//   - script: array de { takeNumber, fala, wordCount } vindo de ugc-script
//   - dataContext: { styleName, scenarioPrompt, cameraPrompt, realismPrompt,
//                    behaviorVibe, voiceTone } — resolvido no frontend
//                    juntando strings dos data files
//   - hasStarterFrame?: boolean — se true, Bloco 1 inclui referência ao frame
//
// Output (200):
//   {
//     prompts: [
//       { takeNumber: 1, prompt: "...8-block English prompt..." },
//       { takeNumber: 2, prompt: "..." },
//       ...
//     ]
//   }

const TAKES_BY_DURATION = {
  '8s': 1,
  '16s': 2,
  '24s': 3,
  '32s': 4,
  '40s': 5,
};

// Arco narrativo sugerido por nº de takes (pra Claude variar comportamento entre takes)
const NARRATIVE_ARC = {
  1: ['hook+demo+CTA combinados'],
  2: ['hook + abertura', 'demonstração + CTA'],
  3: ['hook', 'demonstração/argumento', 'CTA'],
  4: ['hook', 'problema/contexto', 'produto/solução', 'CTA'],
  5: ['hook', 'problema', 'apresentação produto', 'demonstração/prova', 'CTA'],
};

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
      influencer = {},
      product = {},
      styleId,
      durationId,
      cameraId,
      realismId,
      scenarioId,
      voiceId,
      script,
      dataContext = {},
      hasStarterFrame = false,
    } = req.body || {};

    // ── Validação de inputs ───────────────────────────────────────────
    if (!influencer.name) {
      return res.status(400).json({ error: 'influencer.name is required' });
    }
    if (!product.name) {
      return res.status(400).json({ error: 'product.name is required' });
    }
    if (!styleId || !durationId || !cameraId || !realismId || !scenarioId || !voiceId) {
      return res.status(400).json({ error: 'styleId, durationId, cameraId, realismId, scenarioId, voiceId are all required' });
    }
    if (!TAKES_BY_DURATION[durationId]) {
      return res.status(400).json({ error: `Invalid durationId. Must be one of: ${Object.keys(TAKES_BY_DURATION).join(', ')}` });
    }
    if (!Array.isArray(script) || script.length === 0) {
      return res.status(400).json({ error: 'script is required (array of takes from ugc-script.js)' });
    }
    if (!dataContext.scenarioPrompt || !dataContext.cameraPrompt || !dataContext.realismPrompt) {
      return res.status(400).json({ error: 'dataContext.scenarioPrompt + cameraPrompt + realismPrompt are required (strings from data files)' });
    }

    const numTakes = TAKES_BY_DURATION[durationId];
    if (script.length !== numTakes) {
      console.warn(`[ugc-veo-prompt] script length mismatch: expected ${numTakes}, got ${script.length} — proceeding anyway`);
    }

    // ── System prompt: instruções pro Claude montar 8 blocos ──────────
    const system = `You are an expert prompt engineer for Google Veo 3 frame-to-video. You write cinematic, factually-grounded English prompts that produce high-quality 8-second TikTok-style UGC videos with Brazilian Portuguese speech.

Your task: produce ONE English prompt per take, structured as 8 explicit blocks. Each block is plain text (1-3 sentences each), descriptive and visual.

# THE 8 BLOCKS (in this exact order, prefixed with the block name in caps):

[1. INTRO]
Who the person is (factual: age range, ethnicity hint, hair, build) + what she's wearing (refer to outfit) + the product she's holding/using. Keep consistent across ALL takes.

[2. ENVIRONMENT]
The scene/setting. Use the provided scenarioPrompt as the base. Same scene across all takes (continuity).

[3. VISUAL REALISM]
Use the provided realismPrompt verbatim or near-verbatim. Same realism level across all takes.

[4. CAMERA]
Use the provided cameraPrompt verbatim or near-verbatim. Same camera setup across all takes.

[5. BEHAVIOR]
The performance vibe of THIS specific take, derived from the style "${styleId}" (${dataContext.behaviorVibe || 'natural and authentic'}). Vary the behavior subtly between takes following the narrative arc (provided below in user message). E.g. take 1 might be "leaning forward, eyes wide, hooking viewer in" while take 3 might be "calmer, holding product close to camera, demonstrating".

[6. SPEECH]
Write this block in this exact format:
"She speaks in Brazilian Portuguese with the voice profile: ${voiceId} (${dataContext.voiceTone || 'natural conversational tone'}). Lip-sync is natural and matches the spoken text.
Spoken text (Brazilian Portuguese, do NOT translate): «<EXACT fala from script for this take>»."
The Portuguese text MUST be inserted verbatim from the script. Do not paraphrase. Do not translate.

[7. PRODUCT INTERACTION]
How she physically handles/shows/uses the product in THIS take. Vary across takes following narrative arc. Take 1 = product visible but secondary to face; middle takes = product prominent, demonstration; final take = product close to camera, gesture inviting purchase.

[8. GENERAL GUIDELINES]
ALWAYS include these 3 mandatory instructions verbatim:
- "End the take with a stable, clear pose suitable for being used as a starting reference for a continuation video. Avoid mid-motion gestures at the final frame."
- "Maintain visual continuity with the previous and next takes (same outfit, same scene, same lighting, same body position consistency)."
- "Vertical 9:16 aspect ratio, TikTok-native composition."

# CRITICAL RULES:

A. Block names go in brackets and caps: [1. INTRO], [2. ENVIRONMENT], etc.
B. Every block on its own paragraph, separated by a blank line.
C. Bloco 6 (SPEECH) is the ONLY place with Portuguese text. All other blocks: pure English.
D. The Portuguese fala must be inside French quotation marks « » (Veo 3 parses this format reliably).
E. Continuity is paramount: same outfit, scene, lighting, camera setup across ALL takes. Only BEHAVIOR and PRODUCT INTERACTION should vary, following the narrative arc.
F. Output JSON only (no markdown). Schema:
{
  "prompts": [
    { "takeNumber": 1, "prompt": "[1. INTRO]\\n...\\n\\n[2. ENVIRONMENT]\\n...\\n\\n...etc for all 8 blocks" },
    { "takeNumber": 2, "prompt": "..." }
  ]
}

# CONTEXT YOU WILL RECEIVE (in user message):
- Influencer profile + product info
- All 6 data-file strings already resolved (scenarioPrompt, cameraPrompt, realismPrompt, behaviorVibe, voiceTone, styleName)
- The script: array of takes with Portuguese fala for each
- Whether a starter frame exists (boolean — affects how Block 1 references appearance)
- Narrative arc to follow

Generate the prompts now.`;

    // ── User message: dados específicos da geração ────────────────────
    const arc = NARRATIVE_ARC[numTakes] || NARRATIVE_ARC[3];

    const scriptFormatted = script
      .map((t) => `Take ${t.takeNumber}: «${t.fala}» (${t.wordCount || '?'} palavras, ${arc[t.takeNumber - 1] || 'fluxo natural'})`)
      .join('\n');

    const userMsg = `INFLUENCER:
- Name: ${influencer.name}
- Body/face description: ${influencer.bodyDescription || 'not specified'}
- Personal vibe: ${influencer.vibe || 'not specified'}

PRODUCT:
- Name: ${product.name}
- Description: ${product.description || 'not specified'}

CONFIGURATION (style + scene + camera + realism + voice already chosen):
- Style ID: ${styleId} (${dataContext.styleName || styleId})
- Behavior vibe (for Block 5): ${dataContext.behaviorVibe || 'natural and authentic'}
- Scenario prompt (for Block 2): ${dataContext.scenarioPrompt}
- Camera prompt (for Block 4): ${dataContext.cameraPrompt}
- Realism prompt (for Block 3): ${dataContext.realismPrompt}
- Voice ID (for Block 6): ${voiceId}
- Voice tone (for Block 6): ${dataContext.voiceTone || 'natural conversational tone'}

DURATION: ${durationId} = ${numTakes} take(s) of 8 seconds each.

NARRATIVE ARC (vary BEHAVIOR and PRODUCT INTERACTION across takes following this):
${arc.map((phase, i) => `Take ${i + 1}: ${phase}`).join('\n')}

SCRIPT (Portuguese falas — embed verbatim in Block 6 of each take):
${scriptFormatted}

STARTER FRAME: ${hasStarterFrame ? 'YES — a static reference image of the influencer with the product in the chosen scene already exists. Block 1 should describe what is in that frame (the influencer, what she\'s wearing, the product, the scene composition).' : 'NO — describe everything from scratch in Block 1.'}

Generate ${numTakes} prompt(s), one per take. Output JSON only, no markdown.`;

    console.log(
      `[ugc-veo-prompt] Submitting to Claude:`,
      `style=${styleId}, duration=${durationId}, takes=${numTakes},`,
      `scenario=${scenarioId}, camera=${cameraId}, realism=${realismId},`,
      `voice=${voiceId}, hasStarterFrame=${hasStarterFrame}`
    );

    // ── Claude Sonnet 4 ───────────────────────────────────────────────
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ugc-veo-prompt] Claude API error ${response.status}:`, errText);
      return res.status(response.status).json({
        error: `Claude API error: ${response.status}`,
        details: errText,
      });
    }

    const claudeData = await response.json();

    if (claudeData.error) {
      console.error('[ugc-veo-prompt] Claude returned error:', claudeData.error);
      return res.status(500).json({ error: claudeData.error });
    }

    // ── Extrai e parseia o JSON do output ─────────────────────────────
    const text = claudeData.content?.map((c) => c.text || '').join('') || '';
    const cleanText = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch (parseErr) {
      console.error('[ugc-veo-prompt] JSON parse error:', parseErr.message, 'raw:', cleanText.substring(0, 500));
      return res.status(500).json({
        error: 'Claude retornou JSON inválido. Tente novamente.',
        rawText: cleanText.substring(0, 500),
      });
    }

    // ── Validação leve do output ──────────────────────────────────────
    if (!Array.isArray(parsed.prompts)) {
      console.error('[ugc-veo-prompt] Output missing "prompts" array');
      return res.status(500).json({ error: 'Output inválido — esperava array "prompts"' });
    }

    if (parsed.prompts.length !== numTakes) {
      console.warn(`[ugc-veo-prompt] Prompts length mismatch: expected ${numTakes}, got ${parsed.prompts.length}`);
    }

    // Validação estrutural: cada prompt deve ter os 8 marcadores de bloco
    parsed.prompts.forEach((p, i) => {
      const expectedMarkers = ['[1. INTRO]', '[2. ENVIRONMENT]', '[3. VISUAL REALISM]', '[4. CAMERA]', '[5. BEHAVIOR]', '[6. SPEECH]', '[7. PRODUCT INTERACTION]', '[8. GENERAL GUIDELINES]'];
      const missingMarkers = expectedMarkers.filter((m) => !p.prompt?.includes(m));
      if (missingMarkers.length > 0) {
        console.warn(`[ugc-veo-prompt] Take ${i + 1} missing blocks: ${missingMarkers.join(', ')}`);
      }
    });

    console.log(
      `[ugc-veo-prompt] OK:`,
      `prompts_returned=${parsed.prompts.length},`,
      `total_chars=${parsed.prompts.reduce((sum, p) => sum + (p.prompt?.length || 0), 0)}`
    );

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('[ugc-veo-prompt] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
