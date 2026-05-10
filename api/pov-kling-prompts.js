// api/pov-kling-prompts.js (v1.0 — Claude Sonnet 4 gera N prompts em inglês pro Kling 2.6 Pro)
//
// Endpoint que recebe (script, typeId, scenarioId, styleId, handsConfig, produto)
// e gera os N PROMPTS EM INGLÊS pro Kling 2.6 Pro animar cada take de 10s.
//
// Cada prompt do Kling é INDEPENDENTE — descreve o que acontece naquele take
// específico, ancorado na imagem-base do Nano Banana Pro (gerada pelo
// pov-image-base.js, Lote B). A imagem-base já carrega o contexto visual
// (mãos + produto + cenário), então o prompt do Kling foca em MOVIMENTO.
//
// PIPELINE:
//   1. pov-script.js     → roteiro PT-BR com N takes
//   2. pov-image-base.js → imagem-base (1 por take? ou única? — Lote B decide)
//   3. pov-kling-prompts (ESTE)  → N prompts em inglês descrevendo movimento
//   4. pov-kling-generate.js → roda Kling 2.6 Pro pra cada (imagem, prompt) → vídeo 10s
//
// Cada prompt tem estrutura [HANDS] + [ACTION] + [PRODUCT] + [CAMERA] + [ENVIRONMENT].
// Claude monta integrado, em inglês fluente (não bloco-a-bloco), 60-150 palavras.
//
// REQUEST:
//   POST /api/pov-kling-prompts
//   Body: {
//     script: array,                // saída do pov-script.js (com takeNumber + purpose)
//     typeId: string,               // de pov-types.js
//     scenarioId: string,           // de pov-scenarios.js
//     styleId: string,              // de pov-styles.js
//     handsConfig: {                // ⭐ obrigatório
//       mode: 'influencer' | 'anonymous',
//       handsId?: string,           // só se mode='anonymous'
//       gender?: string,            // pra modo influencer: 'female'|'male'
//       skinDescription?: string,   // pra modo influencer: descrição livre
//     },
//     productName: string,
//     productDescription?: string,  // descrição em inglês (de api/analyze-product)
//     productPhotoBase64?: string,  // opcional pra Vision
//     productPhotoMimeType?: string,
//   }
//
// RESPONSE:
//   200: { prompts: [{ takeNumber, klingPrompt, purpose }, ...], source }
//   400: { error: <mensagem> }
//   500: { error: <mensagem> }
//
// 🔁 SE ALTERAR DATA FILES, ATUALIZE OS HINTS DUPLICADOS AQUI:
//   - src/data/pov-types.js     ↔ TYPE_PROMPT_HINTS
//   - src/data/pov-scenarios.js ↔ SCENARIO_PROMPT_HINTS
//   - src/data/pov-styles.js    ↔ STYLE_CAMERA_DIRECTIVES
//   - src/data/pov-hands.js     ↔ HANDS_PROMPT_HINTS

// ════════════════════════════════════════════════════════════════════════
// Hints duplicados (espelham promptHint/cameraDirective dos data files)
// ════════════════════════════════════════════════════════════════════════

const TYPE_PROMPT_HINTS = {
  frasco: 'Hand grasping a bottle or flask firmly from the side, fingers wrapped around the body of the container, product label clearly visible, smooth deliberate movements showing the product weight and shape.',
  pote: 'One hand holding a jar steady from below, the other hand unscrewing or removing the lid in a smooth motion, product opening clearly visible, content texture revealed naturally.',
  sapatos: 'Hand lifting a single shoe by the heel or upper, rotating slowly to show the side profile, sole, stitching and material detail, product fully in focus against a clean background.',
  capinha: 'Hand holding a rectangular phone case or compact gadget vertically, fingers gripping the edges, slight rotation revealing the back design, camera cutouts and material texture clearly visible.',
  pequeno: 'Hand holding a small open case or box at chest level, product nested inside clearly visible, fingers framing the case without covering the product, soft natural lighting on the contents.',
  cabide: 'Hand holding a clothing hanger at eye level, garment hanging naturally, the other hand smoothing the fabric or revealing texture details, full piece visible from collar to hem.',
  pulso: 'Wrist or hand wearing the product, slight rotation showing the piece from multiple angles, skin texture and product detail in sharp focus, natural arm position with relaxed posture.',
  vestindo: 'Hands bringing the wearable product toward the body and putting it on in a smooth motion (glasses lifting to the eyes, hat onto the head, earring to the lobe), product clearly visible during the action.',
  mordida: 'Hand bringing the food or drink product toward the mouth, lips parting naturally as the product approaches, controlled bite or sip moment, product partially consumed visible.',
  superficie: 'Product placed on a clean surface (counter, table, shelf), camera circling slowly or zooming in for detail, no hands in frame, professional product photography lighting, multiple angles revealed.',
  unboxing: 'Hands opening a sealed product box from the top, lifting the lid carefully, revealing the product inside with anticipation, packaging material and product surface clearly visible during the reveal.',
};

const SCENARIO_PROMPT_HINTS = {
  bancada_marmore: 'Clean white marble countertop with subtle grey veining, soft diffused natural daylight from above, premium spa-like atmosphere, slight reflection of the product on the polished marble.',
  vanity: 'Vanity makeup table with warm Hollywood-style ring light reflection in the background, soft pink or beige base tone, brushes and small beauty items slightly out of focus around the edges, intimate warm lighting.',
  pia_banheiro: 'Clean modern bathroom sink area with white ceramic surface, fresh white folded towel visible at the edge, soft cosmetic lighting from above, minimal Scandinavian aesthetic.',
  mesa_escritorio: 'Minimalist office desk surface in light wood or matte white, closed laptop slightly out of focus, leather notebook and a coffee cup at the edge, soft natural daylight from a window on the side.',
  setup_gamer: 'Dark gamer desk surface with RGB ambient lighting in purple and cyan tones in the background, mechanical keyboard and headphones slightly out of focus, deep contrast tech-enthusiast aesthetic.',
  estudio_neutro: 'Seamless neutral studio backdrop in soft grey or beige, controlled three-point studio lighting eliminating harsh shadows, professional product photography atmosphere.',
  cozinha_clean: 'Clean light kitchen countertop in white or light wood, modern kitchen utensils and a fresh herb plant slightly out of focus, bright natural daylight from a window.',
  mesa_cafe: 'Small wooden cafe table surface with a warm cappuccino cup and a fresh croissant on a ceramic plate slightly out of focus, soft morning light filtering through a nearby window.',
  cama_lencol_claro: 'Crisp white bedsheet softly wrinkled on a made bed, late morning sunlight casting gentle diagonal patterns across the fabric, intimate bedroom atmosphere.',
  quarto_noturno: 'Bedside table surface with a soft warm bedside lamp casting amber light, dim cozy bedroom in the background slightly out of focus, deep warm shadows and golden highlights on the product.',
  mesa_ar_livre: 'Outdoor wooden garden table surface, lush green foliage softly out of focus in the background, dappled natural sunlight filtering through leaves.',
  mesa_unboxing: 'Clean neutral surface (light wood or matte white) prepared for an unboxing moment, sealed product packaging centered in frame, soft even lighting eliminating shadows on the box.',
  mesa_bar: 'Dark bar countertop in deep wood or marble with soft amber and red ambient bar lighting in the background, blurred bottles and glassware slightly visible behind, sophisticated cinematic moody tones.',
  loja_showroom: 'Bright retail showroom counter with elegantly displayed products on shelves softly out of focus in the background, polished display lighting, premium retail atmosphere.',
  estudio_neon: 'Dark studio surface with vibrant LED neon lighting in pink, purple and cyan creating bold colored reflections on the product surface, contemporary pop aesthetic with high contrast.',
};

const STYLE_CAMERA_DIRECTIVES = {
  textura_closeup: 'Extreme close-up macro shot focusing on the texture and material, fibers/weave/surface detail filling most of the frame, shallow depth of field with crisp focus, slight slow drift across the texture.',
  design_acabamento: 'Side angle medium shot showing the full design aesthetic, balanced composition with the product centered, soft directional lighting accentuating curves and silhouette.',
  detalhes_premium: 'Tight close-up on premium fine details (zipper teeth, engraved logo, hand stitching, hardware), camera moves slowly across each detail point, sharp focus on small features.',
  rotacao_360: 'Product rotating slowly on its vertical axis, smooth continuous turntable motion, even all-around lighting eliminating harsh shadows, product fully revealed from every angle.',
  tamanho_real: 'Product placed on an open palm at chest level for natural scale reference, hand visible giving size context, soft directional lighting on both hand and product.',
  funcionalidade: 'Product being actively used or operated (button being pressed, lid opening, mechanism engaging), camera close enough to capture the functional moment, real-time motion of the action.',
  aplicacao: 'Product being applied or activated (perfume mist spraying, lipstick gliding on lips, cream being smoothed onto skin), capturing the application moment in slow controlled motion.',
  revelacao_embalagem: 'Product packaging opening in a deliberate slow reveal motion (box lid lifting, plastic seal peeling back, drawer sliding open), the product gradually emerging from inside.',
};

const HANDS_PROMPT_HINTS = {
  fem_natural: 'Natural feminine hands with neatly trimmed short nails, no nail polish or minimal clear coat, smooth skin texture, no jewelry visible, slim relaxed fingers.',
  fem_unhas_decoradas: 'Feminine hands with long manicured nails featuring colorful nail art design, glossy finish catching the light, well-groomed cuticles, no rings, expressive fingertip presence.',
  fem_francesinha: 'Feminine hands with classic French manicure: white tips on a soft pink natural base, medium-length almond shape, glossy clean finish, refined elegant aesthetic.',
  fem_pulseiras_aneis: 'Feminine hands wearing one or two delicate gold or silver thin rings on different fingers, a subtle thin chain bracelet on the wrist, neat short or medium nails, polished refined styling.',
  fem_tatuagem: 'Feminine hands with one delicate fine-line tattoo on the wrist or side of finger (small minimalist design), neat natural nails, modern artistic vibe.',
  masc_natural: 'Natural masculine hands, well-groomed short nails, no jewelry, no tattoos visible, defined knuckles and fingers, healthy skin texture, neutral relaxed grip.',
  masc_tatuadas: 'Masculine hands with bold visible tattoos on the back of the hand and wrist (geometric or line work designs), short clean nails, defined fingers, modern edgy aesthetic.',
  masc_relogio: 'Masculine hands wearing a refined silver or brushed steel wristwatch on the left wrist, watch face partially visible, clean short nails, professional polished aesthetic.',
  masc_pulseira: 'Masculine hands wearing a brown leather wrist cuff or a metal chain bracelet, slightly worn aesthetic suggesting daily use, defined hands, no rings, casual styled vibe.',
  luvas_brancas: 'Hands wearing pristine white cotton or satin gloves, no skin visible, premium concierge or jewelry-presentation aesthetic, careful deliberate handling.',
  sem_maos: 'No hands visible in the frame, product appears alone (placed on surface, suspended by invisible support, or shown in catalog-style isolation), clean professional product photography vibe.',
};

// ════════════════════════════════════════════════════════════════════════
// Handler
// ════════════════════════════════════════════════════════════════════════

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
      script = [],
      typeId,
      scenarioId,
      styleId,
      handsConfig = {},
      productName,
      productDescription = '',
      productPhotoBase64 = null,
      productPhotoMimeType = 'image/jpeg',
    } = req.body || {};

    // ── Validação ────────────────────────────────────────────────────
    if (!Array.isArray(script) || script.length === 0) {
      return res.status(400).json({ error: 'script is required (array of takes)' });
    }
    if (!productName) return res.status(400).json({ error: 'productName is required' });
    if (!TYPE_PROMPT_HINTS[typeId]) {
      return res.status(400).json({ error: `invalid typeId "${typeId}"` });
    }
    if (!SCENARIO_PROMPT_HINTS[scenarioId]) {
      return res.status(400).json({ error: `invalid scenarioId "${scenarioId}"` });
    }
    if (!STYLE_CAMERA_DIRECTIVES[styleId]) {
      return res.status(400).json({ error: `invalid styleId "${styleId}"` });
    }
    if (!handsConfig.mode || !['influencer', 'anonymous'].includes(handsConfig.mode)) {
      return res.status(400).json({ error: 'handsConfig.mode must be "influencer" or "anonymous"' });
    }

    // ── Resolve hands hint ───────────────────────────────────────────
    let handsHint;
    if (handsConfig.mode === 'anonymous') {
      const hh = HANDS_PROMPT_HINTS[handsConfig.handsId];
      if (!hh) {
        return res.status(400).json({ error: `invalid handsConfig.handsId "${handsConfig.handsId}"` });
      }
      handsHint = hh;
    } else {
      // mode='influencer' — usa skinDescription se vier, senão genérico do gênero
      const gender = handsConfig.gender || 'female';
      const generic = gender === 'male'
        ? 'Natural masculine hands consistent with the influencer profile, well-groomed short nails, defined fingers, neutral natural styling.'
        : 'Natural feminine hands consistent with the influencer profile, well-groomed nails, smooth skin, neutral natural styling.';
      handsHint = handsConfig.skinDescription
        ? `Hands consistent with the influencer profile: ${handsConfig.skinDescription}`
        : generic;
    }

    const totalTakes = script.length;
    const typeHint = TYPE_PROMPT_HINTS[typeId];
    const scenarioHint = SCENARIO_PROMPT_HINTS[scenarioId];
    const styleDirective = STYLE_CAMERA_DIRECTIVES[styleId];

    // ── Monta prompt ─────────────────────────────────────────────────
    const scriptSummary = script.map((t, i) => {
      const purpose = t.purpose || (i === 0 ? 'hook' : i === totalTakes - 1 ? 'cta' : 'demo');
      const onScreen = t.onScreenPhrase ? ` | on-screen: "${t.onScreenPhrase}"` : '';
      const voice = t.voiceText ? ` | spoken: "${t.voiceText.replace(/\[[^\]]+\]/g, '').trim()}"` : '';
      return `Take ${t.takeNumber || i + 1} (${purpose})${voice}${onScreen}`;
    }).join('\n');

    const systemPrompt = `You generate cinematic image-to-video prompts in ENGLISH for the Kling 2.6 Pro model on fal.ai.

Each prompt animates a static base image (already prepared by Nano Banana Pro) for 10 seconds. Your job is to describe the MOTION/ACTION that should happen in those 10 seconds, anchored on the existing visual context.

You will write ${totalTakes} prompts — one per take — that together tell a coherent micro-story about a product, in TikTok POV style.

REUSABLE BUILDING BLOCKS (use these as anchors, integrated into fluent English — do NOT paste verbatim):

[HANDS]: ${handsHint}

[TYPE INTERACTION]: ${typeHint}

[CAMERA STYLE]: ${styleDirective}

[ENVIRONMENT]: ${scenarioHint}

PRODUCT: ${productName}${productDescription ? ` — ${productDescription}` : ''}

NARRATIVE FLOW (drives the difference between takes):
${scriptSummary}

RULES:
1. Each prompt: 60-150 words, fluent English, integrated (not bullet-style).
2. Each prompt focuses on the MOTION of THAT take. The base image already shows hands/product/scene.
3. Reference what's spoken or on-screen as visual cues, never literal text in frame.
4. Hook take → start with something that grabs attention (sudden gesture, light catch, anticipation).
5. Demo takes → progress the interaction (move, flip, apply, reveal another angle).
6. CTA take → final beat (settle, place down, hold, slight zoom out for closure).
7. Keep VISUAL CONSISTENCY across takes (same hands, same product, same scene).
8. NO speech transcription in the prompt. NO literal text overlays. NO logos invented.
9. Style: cinematic, smooth, real-time motion (not slow-mo unless style demands).

RESPOND ONLY VALID JSON (no markdown, no backticks):
{
  "prompts": [
    ${Array.from({ length: totalTakes }, (_, i) => `{
      "takeNumber": ${i + 1},
      "purpose": "${script[i]?.purpose || (i === 0 ? 'hook' : i === totalTakes - 1 ? 'cta' : 'demo')}",
      "klingPrompt": "string in English, 60-150 words"
    }`).join(',\n    ')}
  ]
}`;

    const userText = `Generate the ${totalTakes} Kling 2.6 Pro motion prompts following the rules above.

${productPhotoBase64 ? 'Product photo attached above for visual reference.' : 'No product photo — work from the name and description.'}

Return ONLY the JSON.`;

    const userContent = [];
    if (productPhotoBase64) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: productPhotoMimeType,
          data: productPhotoBase64,
        },
      });
    }
    userContent.push({ type: 'text', text: userText });

    // ── Chamada Claude ───────────────────────────────────────────────
    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3072, // N prompts × 150 words pode passar de 1500 tokens
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[pov-kling-prompts v1.0] Anthropic error ${response.status}:`, errText.substring(0, 300));
      return res.status(response.status).json({
        error: `Anthropic error: ${response.status}`,
        details: errText.substring(0, 300),
      });
    }

    const data = await response.json();
    const text = data.content?.map((c) => c.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('[pov-kling-prompts v1.0] JSON parse error:', e.message, 'Raw:', clean.substring(0, 500));
      return res.status(500).json({
        error: 'Failed to parse Claude response as JSON',
        raw: clean.substring(0, 500),
      });
    }

    // ── Validação estrutural ─────────────────────────────────────────
    let prompts = Array.isArray(parsed.prompts) ? parsed.prompts : [];
    const errors = [];

    if (prompts.length !== totalTakes) {
      errors.push(`prompts length ${prompts.length} != expected ${totalTakes}`);
      while (prompts.length < totalTakes) {
        prompts.push({
          takeNumber: prompts.length + 1,
          purpose: prompts.length === 0 ? 'hook' : prompts.length === totalTakes - 1 ? 'cta' : 'demo',
          klingPrompt: `${typeHint} ${styleDirective} ${scenarioHint}`.substring(0, 600),
        });
      }
      prompts = prompts.slice(0, totalTakes);
    }

    prompts = prompts.map((p, idx) => {
      const takeNumber = idx + 1;
      const purpose = ['hook', 'demo', 'cta'].includes(p.purpose)
        ? p.purpose
        : (idx === 0 ? 'hook' : idx === totalTakes - 1 ? 'cta' : 'demo');
      let klingPrompt = typeof p.klingPrompt === 'string' ? p.klingPrompt.trim() : '';
      if (!klingPrompt || klingPrompt.length < 30) {
        klingPrompt = `${typeHint} ${styleDirective} ${scenarioHint}`;
        errors.push(`take ${takeNumber} klingPrompt too short, rebuilt from hints`);
      }
      return { takeNumber, purpose, klingPrompt };
    });

    console.log(
      `[pov-kling-prompts v1.0] OK: takes=${totalTakes}, type=${typeId}, scenario=${scenarioId}, style=${styleId}, hands=${handsConfig.mode}${errors.length ? `, warnings=${errors.length}` : ''}`
    );

    return res.status(200).json({
      prompts,
      source: errors.length === 0 ? 'claude' : 'claude_partial',
      validationWarnings: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[pov-kling-prompts v1.0] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
