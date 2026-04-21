// ============================================================
// generate-back.js  v3.7
// ============================================================
// Generate back-view image prompt using frontal image + back
// product photo via Claude Sonnet 4.
//
// ARCHITECTURE: 5 DEFENSE LAYERS
//   A) Sanitize frontal prompt (refined, context-aware)
//   B) Detect product type + back mode (deterministic)
//   C) Call Claude with tool_use (JSON guaranteed) + few-shot
//   D) Validate output + retry once on critical failure
//   E) Enforce missing pieces (inject what Claude forgot)
//
// KEY CHANGES vs v3.6:
//   - temperature 0.3 (consistency over creativity)
//   - tool_use instead of JSON.parse fragile regex
//   - few-shot moved from system prompt to messages[]
//   - system prompt shrunk ~60%
//   - deterministic enforcement of required slots
//   - automatic retry (max 1) with feedback on critical miss
//   - back-position negative (face visible, frontal view, etc)
//   - product-type detection drives specific negative
//   - less aggressive sanitization in over-shoulder mode
//   - structured JSON diagnostic log
//
// CONTRACT (request body):
//   frontalImageUrl         : string (required)
//   frontalPrompt           : string (optional, used as context)
//   visual                  : { cabelo, calcado, acessorios, cenario, iluminacao }
//   camadas                 : { momento, estacao, estetica }
//   backProductImageBase64  : string (optional)
//   backProductImageMimeType: string (optional)
//   backMode                : 'pure' | 'over-shoulder' (optional, default 'pure')
// ============================================================


// ============================================================
// LAYER A  SANITIZE FRONTAL PROMPT
// ============================================================
// Removes phrases that would make Claude describe a frontal
// pose (eye contact, facing camera, direct gaze).
// In 'over-shoulder' mode, preserves smile/gaze references
// because the legacy v8.2 example 2 uses them legitimately.
// ============================================================

const FRONTAL_HARD_PATTERNS = [
  // always removed (true frontal-only language)
  /looking\s+(?:directly\s+|straight\s+|right\s+)?(?:at|into|toward[s]?)\s+(?:the\s+)?camera/gi,
  /looking\s+at\s+(?:the\s+)?viewer/gi,
  /eye\s+contact(?:\s+with\s+(?:the\s+)?(?:viewer|camera))?/gi,
  /eyes\s+on\s+(?:the\s+)?camera/gi,
  /gazing\s+(?:at|into|toward[s]?)\s+(?:the\s+)?(?:camera|viewer)/gi,
  /direct\s+gaze(?:\s+(?:at|into|toward[s]?)\s+(?:the\s+)?(?:camera|viewer))?/gi,
  /facing\s+(?:the\s+)?camera/gi,
  /front-facing\s+pose/gi,
];

const FRONTAL_SOFT_PATTERNS = [
  // only removed in 'pure' back mode
  /(?:soft|warm|gentle|bright|friendly)\s+smile\s+at\s+(?:the\s+)?(?:camera|viewer)/gi,
  /smiling\s+at\s+(?:the\s+)?(?:camera|viewer)/gi,
  /warm\s+expression\s+at\s+(?:the\s+)?(?:viewer|camera)/gi,
];

function sanitizeFrontalPrompt(prompt, backMode) {
  if (!prompt || typeof prompt !== 'string') {
    return { cleaned: '', removedCount: 0, warning: null };
  }

  const originalLen = prompt.length;
  let cleaned = prompt;
  let removedCount = 0;

  const patterns = backMode === 'over-shoulder'
    ? FRONTAL_HARD_PATTERNS
    : [...FRONTAL_HARD_PATTERNS, ...FRONTAL_SOFT_PATTERNS];

  for (const pattern of patterns) {
    const matches = cleaned.match(pattern);
    if (matches) {
      removedCount += matches.length;
      cleaned = cleaned.replace(pattern, '');
    }
  }

  cleaned = cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/(?:\s*,\s*){2,}/g, ', ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+\./g, '.')
    .replace(/,\s*\./g, '.')
    .replace(/^[,\s]+/, '')
    .replace(/[,\s]+$/, '')
    .trim();

  const integrityRatio = originalLen > 0 ? cleaned.length / originalLen : 1;
  const warning = (integrityRatio < 0.6 || removedCount > 4)
    ? `frontalPrompt heavily sanitized: removed ${removedCount}, length -${Math.round((1 - integrityRatio) * 100)}%`
    : null;

  return { cleaned, removedCount, warning };
}


// ============================================================
// LAYER B  DETECT PRODUCT TYPE
// ============================================================
// Scans frontal prompt + visual data to classify the product.
// Used to build product-specific negative prompt (e.g. "back
// pockets" for pants that don't have them).
// Returns: 'dress' | 'pants' | 'skirt' | 'set' | 'top' |
//          'body' | 'coat' | 'jumpsuit' | 'bikini' | 'unknown'
// ============================================================

const PRODUCT_TYPE_KEYWORDS = {
  dress:    [/\bdress(es)?\b/i, /\bgown\b/i, /\bmidi\b/i, /\bmaxi\b/i, /\bmini\s+dress\b/i, /\bvestido\b/i],
  jumpsuit: [/\bjumpsuit\b/i, /\bromper\b/i, /\bmacac[aã]o\b/i, /\bmacaquinho\b/i],
  pants:    [/\bpants\b/i, /\btrousers\b/i, /\bjeans\b/i, /\bleggings?\b/i, /\bshorts\b/i, /\bcal[cç]a\b/i, /\bbermuda\b/i],
  skirt:    [/\bskirt\b/i, /\bsaia\b/i],
  set:      [/\bset\b/i, /\bco-?ord\b/i, /\bmatching\s+set\b/i, /\bconjunto\b/i, /\btwo-?piece\b/i],
  body:     [/\bbodysuit\b/i, /\bleotard\b/i, /\bbody\b/i],
  bikini:   [/\bbikini\b/i, /\bswimsuit\b/i, /\bbiqu[ií]ni\b/i, /\bmai[oô]\b/i],
  coat:     [/\bcoat\b/i, /\bjacket\b/i, /\bblazer\b/i, /\bcasaco\b/i, /\bjaqueta\b/i, /\bcardigan\b/i],
  top:      [/\btop\b/i, /\bblouse\b/i, /\bt-shirt\b/i, /\bshirt\b/i, /\btank\b/i, /\bcropped?\b/i, /\bblusa\b/i, /\bregata\b/i],
};

function detectProductType(cleanedFrontal, visual, camadas) {
  const haystack = [
    cleanedFrontal || '',
    visual?.cenario || '',
    visual?.calcado || '',
    camadas?.momento || '',
    camadas?.estetica || '',
  ].join(' ').toLowerCase();

  // order matters: more specific first (jumpsuit before pants, bodysuit before top)
  const order = ['jumpsuit', 'bikini', 'body', 'dress', 'set', 'coat', 'skirt', 'pants', 'top'];
  for (const key of order) {
    const patterns = PRODUCT_TYPE_KEYWORDS[key];
    if (patterns && patterns.some(p => p.test(haystack))) {
      return key;
    }
  }
  return 'unknown';
}


// ============================================================
// LAYER C  NEGATIVE BUILDERS
// ============================================================

// Base: anatomy + quality (always included)
const NEGATIVE_BASE = [
  'slim body', 'skinny', 'thin', 'model body', 'athletic body', 'muscular',
  'underweight', 'bony', 'flat hips', 'no curves',
  'wrong hair color', 'wrong hair texture',
  'barefoot', 'no shoes', 'wrong product design', 'altered clothing design',
  'sitting', 'seated',
  'people in background', 'empty background', 'studio backdrop',
  'cropped body', 'cut off legs', 'missing feet',
  'low quality', 'blurry', 'distorted', 'unrealistic',
  'advertising style', 'fake lighting', 'text overlay', 'watermark', 'logo',
  'cartoon', 'CGI', 'plastic skin', 'airbrushed skin', 'porcelain skin',
  'perfectly smooth skin', 'overly polished', 'retouched skin', 'studio lighting',
];

// Position: anti-frontal-leak (always included for back view)
const NEGATIVE_BACK_POSITION = [
  'face visible', 'frontal view', 'front view',
  'profile view', 'side view',
  'three-quarter view', 'partial face visible',
  'chin visible', 'cheek visible', 'mouth visible',
];

// Product-specific: prevents common back-design errors
const NEGATIVE_BY_PRODUCT_TYPE = {
  pants:    ['back pockets', 'visible pockets on trousers', 'pockets on back of pants', 'trouser back pockets'],
  dress:    ['different color', 'altered back design', 'modified straps'],
  skirt:    ['altered silhouette', 'wrong hem length'],
  set:      ['mismatched pieces', 'different top', 'different bottom'],
  body:     ['visible underwear', 'altered neckline'],
  jumpsuit: ['altered silhouette', 'wrong leg length'],
  bikini:   ['altered cut', 'wrong coverage'],
  coat:     ['altered length', 'wrong closure'],
  top:      ['altered neckline', 'wrong sleeve length'],
  skirtOpen:[],
  unknown:  [],
};

// Merge claude's negative + position + product-specific + base
// Deduplicates while preserving order.
function buildNegative(claudeNegative, productType) {
  const productSpecific = NEGATIVE_BY_PRODUCT_TYPE[productType] || [];

  const claudeTokens = (claudeNegative || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const merged = [
    ...productSpecific,
    ...claudeTokens,
    ...NEGATIVE_BACK_POSITION,
    ...NEGATIVE_BASE,
  ];

  const seen = new Set();
  const deduped = [];
  for (const tok of merged) {
    const key = tok.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(tok);
    }
  }

  return deduped.join(', ');
}


// ============================================================
// LAYER D  VALIDATORS
// ============================================================
// Inspects claude's positive prompt and flags missing slots.
// criticalMissing triggers a retry.
// warnings trigger enforcement injection.
// ============================================================

function validatePositivePrompt(positivo) {
  const p = (positivo || '').toString();

  const hasBackView     = /\bback\s+view\b/i.test(p) || /\bstanding\s+with\s+back\s+to\s+camera\b/i.test(p) || /\brear\s+view\b/i.test(p);
  const hasWomanOpener  = /^Woman\s+standing/i.test(p.trim()) || /^Same\s+woman/i.test(p.trim());
  const hasIphoneSig    = /iPhone\s+15\s+Pro/i.test(p) && /f\/1\.9/i.test(p);
  const hasSkinTextures = /visible\s+pores/i.test(p) && /peach\s+fuzz/i.test(p);
  const hasRefImage     = /reference\s+image/i.test(p);
  const hasFullBody     = /full\s+body\s+visible/i.test(p);
  const hasUgcStyle     = /UGC\s+authentic\s+style/i.test(p);
  const hasOldBlock     = /visible\s+back\s+details\s*:/i.test(p);
  const hasVertical     = /vertical\s+9:16/i.test(p);

  const criticalMissing = [];
  if (!hasBackView)    criticalMissing.push('back view');
  if (!hasWomanOpener) criticalMissing.push('opener "Woman standing" / "Same woman"');

  const warnings = [];
  if (!hasIphoneSig)    warnings.push('iPhone 15 Pro + f/1.9');
  if (!hasSkinTextures) warnings.push('visible pores + peach fuzz');
  if (!hasRefImage)     warnings.push('reference image anchor');
  if (!hasFullBody)     warnings.push('full body visible');
  if (!hasUgcStyle)     warnings.push('UGC authentic style');
  if (!hasVertical)     warnings.push('vertical 9:16');
  if (hasOldBlock)      warnings.push('legacy "visible back details:" block (will be rewritten)');

  return {
    hasBackView, hasWomanOpener, hasIphoneSig, hasSkinTextures,
    hasRefImage, hasFullBody, hasUgcStyle, hasVertical, hasOldBlock,
    criticalMissing, warnings,
    isCritical: criticalMissing.length > 0,
  };
}


// ============================================================
// LAYER E  ENFORCEMENT (deterministic injection)
// ============================================================
// Fixes anything Claude forgot. Runs even if validation passed
// (double guarantee). Removes legacy "visible back details:"
// block by inlining its contents.
// ============================================================

function enforcePositive(positivo) {
  let p = (positivo || '').toString().trim();
  const actions = [];

  // 1) Rewrite legacy "visible back details: X, Y, Z" block
  //    into inline form after the outfit phrase.
  const legacyMatch = p.match(/visible\s+back\s+details\s*:\s*([^.]+)(\.|,|$)/i);
  if (legacyMatch) {
    const details = legacyMatch[1].trim();
    const replacement = `with the exact back design matching the product reference image showing ${details}`;
    p = p.replace(legacyMatch[0], replacement + (legacyMatch[2] === '.' ? '.' : ','));
    actions.push('rewrote_legacy_block');
  }

  // 2) Ensure "Woman standing back view" opener if missing
  if (!/^Woman\s+standing/i.test(p) && !/^Same\s+woman/i.test(p)) {
    p = `Woman standing back view, ${p.charAt(0).toLowerCase()}${p.slice(1)}`;
    actions.push('injected_opener');
  }

  // 3) Ensure back view anchor
  if (!/back\s+view/i.test(p) && !/rear\s+view/i.test(p) && !/back\s+to\s+camera/i.test(p)) {
    p = p.replace(/^Woman\s+standing/i, 'Woman standing back view');
    actions.push('injected_back_view');
  }

  // 4) Inject iPhone signature if missing
  if (!/iPhone\s+15\s+Pro/i.test(p) || !/f\/1\.9/i.test(p)) {
    const sig = 'photographed with iPhone 15 Pro, f/1.9 aperture, natural depth of field, soft background bokeh';
    p = appendBeforeClosing(p, sig);
    actions.push('injected_iphone_sig');
  }

  // 5) Inject skin textures if missing
  if (!/visible\s+pores/i.test(p) || !/peach\s+fuzz/i.test(p)) {
    const tex = 'fine visible pores on arms, natural peach fuzz catching the light, fabric slightly creased where body bends';
    p = appendBeforeScenery(p, tex);
    actions.push('injected_skin_textures');
  }

  // 6) Inject full body clause if missing
  if (!/full\s+body\s+visible/i.test(p)) {
    p = appendBeforeClosing(p, 'full body visible head to toe including feet');
    actions.push('injected_full_body');
  }

  // 7) Inject UGC style if missing
  if (!/UGC\s+authentic\s+style/i.test(p)) {
    p = appendBeforeClosing(p, 'UGC authentic style, realistic');
    actions.push('injected_ugc_style');
  }

  // 8) Inject vertical format if missing
  if (!/vertical\s+9:16/i.test(p)) {
    p = appendBeforeClosing(p, 'vertical 9:16');
    actions.push('injected_vertical');
  }

  // Final cleanup
  p = p
    .replace(/\s{2,}/g, ' ')
    .replace(/(?:\s*,\s*){2,}/g, ', ')
    .replace(/,\s*\./g, '.')
    .replace(/\s+\./g, '.')
    .replace(/^[,\s]+/, '')
    .replace(/[,\s]+$/, '')
    .trim();

  if (!p.endsWith('.')) p += '.';

  return { positivo: p, actions };
}

// Helpers: inject a phrase in the right position.
function appendBeforeClosing(prompt, phrase) {
  // Insert phrase just before final period if it exists, else append.
  const trimmed = prompt.replace(/\.$/, '').trim();
  return `${trimmed}, ${phrase}.`;
}

function appendBeforeScenery(prompt, phrase) {
  // Best effort: insert before first scenery-like keyword.
  const sceneryRegex = /(cozy\s|elegant\s|spacious\s|modern\s|home\s+office|bedroom|living\s+room|bathroom|restaurant|cafe|park|street|garage|kitchen)/i;
  const match = prompt.match(sceneryRegex);
  if (match) {
    const idx = match.index;
    // find start of the comma-separated clause
    const before = prompt.slice(0, idx).replace(/,\s*$/, '');
    const after = prompt.slice(idx);
    return `${before}, ${phrase}, ${after}`;
  }
  return appendBeforeClosing(prompt, phrase);
}


// ============================================================
// SYSTEM PROMPT v3.7 (lean, focused)
// ============================================================

const SYSTEM_PROMPT_V37 = `You are a UGC prompt specialist for TikTok Shop.
Your job: write a BACK-VIEW image prompt that keeps full continuity
with IMAGE 1 (approved frontal of the model) and preserves the garment
design shown in IMAGE 2 (back view of the product).

# INPUTS
- IMAGE 1: approved frontal (scene, light, hair, accessories, shoes already set here).
- IMAGE 2: product back photo (may be on mannequin or flat; ignore who wears it, focus on the garment).

# ANALYSIS (do this silently before writing)
From IMAGE 1 extract:
- Exact scene: location + 4-6 visible elements + light type
- Hair as seen from behind
- Accessories as seen from behind (earring side, necklace clasp at nape, bracelet wrist)
- Persistent object: bag, clutch, phone, sunglasses? WHICH HAND, WHICH SIDE?
- Footwear

From IMAGE 2 decide:
- Back is DISTINCTIVE (open back, crossed straps, back zipper, tie, ruched, keyhole, buttons, unique panel) -> describe in ONE short phrase INLINE in the outfit clause.
- Back is PLAIN -> do NOT invent details. Use "with smooth back".

# OUTPUT STRUCTURE (positive prompt, English, 12-16 lines)
Follow this order exactly:

1) Opener (mandatory): "Woman standing back view"
2) Scene anchor (optional 1 line): "in [location/ambience]" only if strong
3) Posture: "relaxed natural posture with arms at her sides" or similar PURE-BACK posture
4) Outfit anchor (mandatory): "wearing the exact [garment brief] from reference image 1" + back design integrated INLINE
   - distinctive: "...from reference image 1, back design matching reference image 2, [short back description]"
   - plain: "...from reference image 1 with smooth back"
5) Footwear (specific): e.g. "nude heels", "black loafers"
6) Hair as seen from behind (rich)
7) Accessories from behind ("visible", "clasp at nape", "from the side")
8) Persistent object (if present in IMAGE 1): "left hand holding small structured handbag at her side"
9) Skin + fabric textures (LITERAL): "fine visible pores on arms, natural peach fuzz catching the light, fabric slightly creased where body bends"
10) Rich scene (5-7 elements from IMAGE 1)
11) Light texture or ambient detail
12) Camera (literal): "photographed with iPhone 15 Pro, f/1.9 aperture, natural depth of field, soft background bokeh, spontaneous moment captured mid-action"
13) Closing (literal): "full body visible head to toe including feet, UGC authentic style, realistic, vertical 9:16"

# HARD RULES
- POSITIVE phrasing only. No "not", "must not", "without" (those go in negative).
- NEVER describe the product color.
- ALWAYS use "from reference image 1" (or "from reference image" in fallback mode).
- If back is distinctive, include both "reference image 1" and "reference image 2" anchors.
- Ignore any person/mannequin in IMAGE 2; only the garment matters.
- If plain back: do not fabricate details. Use "with smooth back" or omit.
- Persistent object: keep the same hand and side as in IMAGE 1.
- NEVER use the legacy block "visible back details: X, Y, Z" as a separate segment. Integrate back details INLINE.
- Skin textures + iPhone 15 Pro + f/1.9 are mandatory in every output.

# NEGATIVE PROMPT
Start with any piece-specific terms (e.g. "back pockets" if pants have no back pockets; "closed back" if dress has open back). Keep it concise; the server will append the base anatomy/quality negative automatically.

# OUTPUT
Use the tool "return_back_prompt" to return your result as structured JSON with fields "positivo" and "negativo".`;

const SYSTEM_PROMPT_V37_FALLBACK = `You are a UGC prompt specialist for TikTok Shop.
Your job: write a BACK-VIEW image prompt that keeps full continuity with the approved FRONTAL image.

# INPUT
- IMAGE 1: approved frontal (scene, light, hair, accessories, shoes). Extract everything from here.
- (No back photo of the product was provided; assume plain back without distinctive detail.)

# OUTPUT STRUCTURE (positive prompt, English, 12-16 lines)
1) "Woman standing back view"
2) Optional scene anchor
3) Posture: "relaxed natural posture with arms at her sides"
4) Outfit: "wearing the exact outfit from reference image with smooth back"
5) Footwear (specific)
6) Hair as seen from behind
7) Accessories from behind
8) Persistent object if present (same hand/side)
9) Skin + fabric textures (literal)
10) Rich scene (5-7 elements)
11) Light texture / ambient detail
12) "photographed with iPhone 15 Pro, f/1.9 aperture, natural depth of field, soft background bokeh, spontaneous moment captured mid-action"
13) "full body visible head to toe including feet, UGC authentic style, realistic, vertical 9:16"

# RULES
- POSITIVE phrasing only.
- No color of the product.
- Use "from reference image" anchor.
- Do not invent back details; use "with smooth back".
- Skin textures + iPhone 15 Pro + f/1.9 mandatory.
- Never use legacy block "visible back details:".

# OUTPUT
Use the tool "return_back_prompt" to return JSON with "positivo" and "negativo".`;


// ============================================================
// FEW-SHOT EXAMPLES  (delivered as message history)
// ============================================================
// Three canonical v8.2 exemplars that Claude sees as prior
// correct assistant turns. Much more effective than embedding
// them in the system prompt.
// ============================================================

const FEW_SHOT = [
  {
    user: 'Example input A: elegant set, restaurant, plain back, no persistent object.',
    assistantJson: {
      positivo: "Woman standing back view in upscale restaurant, relaxed natural posture with arms gently at her sides, wearing a black satin blouse with thin straps tucked into the satin midi skirt from reference image 1 with smooth back, nude heels, loose romantic waves with soft curls falling naturally down her back, small pearl stud earrings visible, dainty chain necklace clasp visible at nape, delicate bracelet, fine visible pores on arms, natural peach fuzz catching the light, fabric slightly creased where body bends, elegant restaurant background with blurred candlelit table, velvet chairs, wine glasses on table, decorative plants, warm golden ambient lighting casting soft shadows, no people visible, full body visible head to toe including feet, photographed with iPhone 15 Pro, f/1.9 aperture, natural depth of field, soft background bokeh, spontaneous moment captured mid-action, UGC authentic style, realistic, vertical 9:16.",
      negativo: "closed back, covered back"
    }
  },
  {
    user: 'Example input B: dress with open back, distinctive tie detail, bedroom, no persistent object.',
    assistantJson: {
      positivo: "Woman standing back view wearing the exact dress from reference image 1, back design matching reference image 2, fully open back with delicate fabric tie knot at the neck clearly visible, ruched sides visible from behind, nude heels, medium gold hoop earrings, delicate pendant necklace, thin bracelet, soft waves blown back with side part and professional volume, fine visible pores on arms and shoulders, natural peach fuzz catching the light, slight natural skin irregularity, fabric slightly creased where body bends, bedroom with large wooden wardrobe visible in soft background, light curtains catching warm overhead light, bright warm overhead lighting creating glamorous atmosphere with soft shadows, full body visible head to toe including feet, photographed with iPhone 15 Pro, f/1.9 aperture, natural depth of field, soft background bokeh, spontaneous moment captured mid-action, UGC authentic style, realistic, vertical 9:16.",
      negativo: "closed back, covered back, different color, altered back design"
    }
  },
  {
    user: 'Example input C: tailored set with no back pockets, persistent clutch in left hand, cozy bedroom.',
    assistantJson: {
      positivo: "Woman standing back view wearing the exact tailored vest with V-neckline and front buttons paired with straight ankle-length tailored trousers from reference image 1 with smooth back without visible back pockets, nude heels, loose romantic waves with soft curls and natural volume falling over shoulders seen from behind, small pearl stud earrings visible, left hand holding small clutch at her side, fine visible pores on arms, natural peach fuzz catching the light, fabric slightly creased where body bends, cozy bedroom background with blurred bed and pillows arranged neatly, full-length mirror nearby, bedside lamp casting warm shadow on wall, warm golden light, slightly wrinkled throw blanket on bed, floating dust particles in warm light, full body visible from head to toe including feet, photographed with iPhone 15 Pro, f/1.9 aperture, natural depth of field, soft background bokeh, spontaneous moment captured mid-action, UGC authentic style, realistic, vertical 9:16.",
      negativo: "back pockets, visible pockets on trousers, pockets on back of pants, trouser back pockets"
    }
  },
];


// ============================================================
// TOOL SCHEMA  (ensures structured JSON output)
// ============================================================

const RETURN_TOOL = {
  name: 'return_back_prompt',
  description: 'Return the back-view image prompt as structured JSON with fields "positivo" (positive prompt in English) and "negativo" (piece-specific negative terms in English, concise; the server will append base anatomy+quality negatives).',
  input_schema: {
    type: 'object',
    properties: {
      positivo: {
        type: 'string',
        description: 'Positive prompt in English. 12-16 lines equivalent. Must include: "Woman standing back view" opener, "from reference image" anchor, skin textures ("visible pores" + "peach fuzz"), iPhone 15 Pro + f/1.9, "full body visible head to toe including feet", "UGC authentic style", "vertical 9:16".'
      },
      negativo: {
        type: 'string',
        description: 'Negative prompt in English. Piece-specific terms only (the server appends base anatomy+quality+back-position negatives automatically). May be empty string if no piece-specific negatives apply.'
      }
    },
    required: ['positivo', 'negativo']
  }
};


// ============================================================
// CLAUDE CALL  (single attempt)
// ============================================================

async function callClaude({ apiKey, systemPrompt, messages, maxTokens = 2048, temperature = 0.3 }) {
  const body = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    temperature,
    system: [{ type: 'text', text: systemPrompt }],
    messages,
    tools: [RETURN_TOOL],
    tool_choice: { type: 'tool', name: 'return_back_prompt' },
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.error) {
    const msg = data.error.message || JSON.stringify(data.error);
    const err = new Error(msg);
    err.claudeError = data.error;
    throw err;
  }

  // Extract tool_use block
  const toolUseBlock = (data.content || []).find(b => b.type === 'tool_use' && b.name === 'return_back_prompt');
  if (!toolUseBlock || !toolUseBlock.input) {
    const textFallback = (data.content || []).map(b => b.text || '').join('');
    throw new Error(`Claude did not return tool_use. Raw text: ${textFallback.substring(0, 300)}`);
  }

  const { positivo, negativo } = toolUseBlock.input;
  return {
    positivo: typeof positivo === 'string' ? positivo : '',
    negativo: typeof negativo === 'string' ? negativo : '',
    usage: data.usage || null,
  };
}


// ============================================================
// BUILD USER MESSAGE CONTENT
// ============================================================

function buildUserMessages({ frontalImageUrl, backProductImageBase64, backProductImageMimeType, cleanedFrontal, visual, camadas, productType, backMode, feedbackFromLastAttempt }) {
  const hasBackPhoto = !!(backProductImageBase64 && backProductImageMimeType);

  // Build real-request content (goes in the LAST user message)
  const realContent = [];
  realContent.push({ type: 'image', source: { type: 'url', url: frontalImageUrl } });

  if (hasBackPhoto) {
    realContent.push({
      type: 'image',
      source: { type: 'base64', media_type: backProductImageMimeType, data: backProductImageBase64 },
    });
  }

  const imageContext = hasBackPhoto
    ? 'IMAGE 1 (approved frontal of the model wearing the product): attached FIRST.\nIMAGE 2 (product back photo; focus on the garment, ignore who wears it): attached SECOND.'
    : 'IMAGE 1 (approved frontal of the model): attached above.\n(No back photo of the product was provided; assume plain back.)';

  const feedbackBlock = feedbackFromLastAttempt
    ? `\n\n# PREVIOUS ATTEMPT FEEDBACK (fix these in this retry)\n${feedbackFromLastAttempt}\n`
    : '';

  const realText = `${imageContext}

SANITIZED FRONTAL PROMPT (context only, not to be copied):
${cleanedFrontal || 'N/A'}

VISUAL DATA:
- hair: ${visual?.cabelo || 'N/A'}
- footwear: ${visual?.calcado || 'N/A'}
- accessories: ${visual?.acessorios || 'N/A'}
- scene: ${visual?.cenario || 'N/A'}
- light: ${visual?.iluminacao || 'N/A'}

LAYERS:
- moment: ${camadas?.momento || 'N/A'}
- season: ${camadas?.estacao || 'N/A'}
- aesthetic: ${camadas?.estetica || 'N/A'}

DETECTED PRODUCT TYPE: ${productType}
BACK MODE: ${backMode}
${feedbackBlock}
Now produce the back-view prompt via the tool. Do NOT reproduce the sanitized frontal text verbatim. Analyze the images, decide if the back is distinctive, and write per the structure.`;

  realContent.push({ type: 'text', text: realText });

  // Build few-shot conversation with deterministic tool_use IDs
  // Structure required by Anthropic API:
  //   user[text ex1] -> assistant[tool_use ex1] ->
  //   user[tool_result ex1 + text ex2] -> assistant[tool_use ex2] ->
  //   user[tool_result ex2 + text ex3] -> assistant[tool_use ex3] ->
  //   user[tool_result ex3 + real request]
  // Never two consecutive messages with the same role.
  const messages = [];

  if (FEW_SHOT.length === 0) {
    messages.push({ role: 'user', content: realContent });
    return messages;
  }

  // First few-shot: user text only
  messages.push({
    role: 'user',
    content: [{ type: 'text', text: FEW_SHOT[0].user }],
  });

  for (let i = 0; i < FEW_SHOT.length; i++) {
    const currentId = `example_${i + 1}`;

    // Assistant turn: tool_use with the canonical answer
    messages.push({
      role: 'assistant',
      content: [{
        type: 'tool_use',
        id: currentId,
        name: 'return_back_prompt',
        input: FEW_SHOT[i].assistantJson,
      }],
    });

    // Next user turn: tool_result + EITHER next few-shot text OR real request
    const isLast = (i === FEW_SHOT.length - 1);
    const userBlocks = [
      { type: 'tool_result', tool_use_id: currentId, content: 'OK' },
    ];

    if (isLast) {
      userBlocks.push(...realContent);
    } else {
      userBlocks.push({ type: 'text', text: FEW_SHOT[i + 1].user });
    }

    messages.push({ role: 'user', content: userBlocks });
  }

  return messages;
}


// ============================================================
// MAIN HANDLER
// ============================================================

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
      frontalImageUrl,
      frontalPrompt,
      visual,
      camadas,
      backProductImageBase64,
      backProductImageMimeType,
      backMode: rawBackMode,
    } = req.body || {};

    if (!frontalImageUrl) {
      return res.status(400).json({ error: 'frontalImageUrl is required' });
    }

    // Normalize back mode
    const backMode = rawBackMode === 'over-shoulder' ? 'over-shoulder' : 'pure';
    const hasBackPhoto = !!(backProductImageBase64 && backProductImageMimeType);

    // ---- LAYER A: sanitize ----
    const { cleaned: cleanedFrontal, removedCount, warning: sanitizeWarning } = sanitizeFrontalPrompt(frontalPrompt, backMode);
    if (sanitizeWarning) console.warn(`[generate-back v3.7] ${sanitizeWarning}`);

    // ---- LAYER B: detect product type ----
    const productType = detectProductType(cleanedFrontal, visual, camadas);

    // ---- LAYER C: call Claude (attempt 1) ----
    const systemPrompt = hasBackPhoto ? SYSTEM_PROMPT_V37 : SYSTEM_PROMPT_V37_FALLBACK;

    let messages = buildUserMessages({
      frontalImageUrl, backProductImageBase64, backProductImageMimeType,
      cleanedFrontal, visual, camadas, productType, backMode,
      feedbackFromLastAttempt: null,
    });

    let claudeResult;
    try {
      claudeResult = await callClaude({ apiKey: API_KEY, systemPrompt, messages });
    } catch (err) {
      console.error('[generate-back v3.7] attempt 1 failed:', err.message);
      return res.status(500).json({ error: `Claude call failed: ${err.message}` });
    }

    // ---- LAYER D: validate (and retry once if critical) ----
    let validation = validatePositivePrompt(claudeResult.positivo);
    let retryUsed = false;

    if (validation.isCritical) {
      retryUsed = true;
      const feedback = `Your previous response was missing: ${validation.criticalMissing.join(', ')}. You MUST start the positive prompt with "Woman standing back view" (or "Same woman in same setting, now standing with back to camera"). This is mandatory.`;

      const retryMessages = buildUserMessages({
        frontalImageUrl, backProductImageBase64, backProductImageMimeType,
        cleanedFrontal, visual, camadas, productType, backMode,
        feedbackFromLastAttempt: feedback,
      });

      try {
        claudeResult = await callClaude({ apiKey: API_KEY, systemPrompt, messages: retryMessages });
        validation = validatePositivePrompt(claudeResult.positivo);
      } catch (err) {
        console.error('[generate-back v3.7] retry failed:', err.message);
        // fall through: we still run enforcement on original
      }
    }

    // ---- LAYER E: enforcement (always runs) ----
    const { positivo: finalPositivo, actions: enforcementActions } = enforcePositive(claudeResult.positivo);
    const finalNegativo = buildNegative(claudeResult.negativo, productType);

    // ---- Structured diagnostic log ----
    const diagnostic = {
      version: 'v3.7',
      hasBackPhoto,
      backMode,
      productType,
      sanitize: { removedCount, warning: sanitizeWarning },
      validation: {
        hasBackView: validation.hasBackView,
        hasWomanOpener: validation.hasWomanOpener,
        hasIphoneSig: validation.hasIphoneSig,
        hasSkinTextures: validation.hasSkinTextures,
        hasRefImage: validation.hasRefImage,
        hasFullBody: validation.hasFullBody,
        hasUgcStyle: validation.hasUgcStyle,
        hasVertical: validation.hasVertical,
        hasOldBlock: validation.hasOldBlock,
        criticalMissing: validation.criticalMissing,
        warnings: validation.warnings,
      },
      retryUsed,
      enforcementActions,
      finalPositivoLen: finalPositivo.length,
      finalNegativoLen: finalNegativo.length,
      claudeUsage: claudeResult.usage,
    };

    console.log('[generate-back v3.7] OK', JSON.stringify(diagnostic));

    return res.status(200).json({
      positivo: finalPositivo,
      negativo: finalNegativo,
      _diagnostic: diagnostic,
    });
  } catch (error) {
    console.error('[generate-back v3.7] fatal error:', error);
    return res.status(500).json({ error: error.message });
  }
}
