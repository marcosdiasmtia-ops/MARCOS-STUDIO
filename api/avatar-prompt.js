// api/avatar-prompt.js (v1.1 — Avatar IA Sessão 3 PATCH — força framing FRONTAL)
//
// PATCH v1.1 (sobre v1.0):
//   - Resolve "débito da Decisão #9": v1.0 gerava avatares CANDID lateral/3/4,
//     incompatíveis com VTON e UGC Falante (que precisam de rosto frontal).
//   - Força framing frontal MANTENDO o realismo (candid feel + skin texture +
//     50mm + available daylight) — combinação compatível com pipeline downstream.
//   - 4 mudanças cirúrgicas: schema.composition, system prompt requirement,
//     buildEnglishPrompt reinforcement, header.
//
// Endpoint que recebe os dados RESOLVIDOS do wizard de Avatar IA e gera um
// JSON descritivo no formato MIRR0R™ (curso novaera.ai), em inglês,
// com vocabulário pró-realismo (Decisão #9 — 4 alavancas).
//
// Espelha o padrão de api/ugc-script.js (validado em produção).
//
// REFERÊNCIAS arquiteturais:
//   - Decisão #2: Claude Sonnet 4 replica MIRR0R via system prompt
//   - Decisão #9: Realismo ULTRA — vocabulário pró-imperfeição natural
//   - Cirúrgico: validação de gênero gramatical no JSON
//   - Alavanca 1 da Decisão #9: prompt + lista anti-genérico imposta
//
// Input (POST body) — frontend resolve data files antes de enviar:
//   {
//     name: string,
//     gender: 'male' | 'female',
//     age: number (18-70),
//     ethnicityDescriptions: string[],   // 1 ou 2 itens
//     skinToneDescription: string,
//     bodyTypeDescription: string,
//     eyeColorDescription: string,
//     lipsDescription: string,
//     hairStyleDescription: string,
//     hairColorDescription: string,
//     beardStyleDescription: string | null,    // só se gender=male
//     glassesDescription: string,
//     piercingsDescriptions: string[],         // 0+ itens
//     editorialLine?: string,                  // pt-BR opcional (Etapa 7)
//     signature?: string,                      // pt-BR opcional (Etapa 7)
//     niche?: string,                          // ID do nicho TikTok Shop
//   }
//
// Output (200):
//   {
//     personaPrompt: { subject, accessories, photography, background },
//     englishPrompt: string,           // concat pronto pro Nano Banana Pro
//     validationWarnings: string[],
//   }
//
// Custo estimado por chamada: ~$0,003 (Claude Sonnet 4, ~1500 input + ~600 output tokens).

// ═══════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT — Decisão #9 Alavanca 1 imposta integralmente
// ═══════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are MIRR0R-PRO, an expert at writing photorealistic image generation prompts for AI avatar creation. You receive structured input describing a virtual influencer and produce a detailed JSON description optimized for Nano Banana Pro (Google's text-to-image model).

# YOUR PRIMARY DIRECTIVE: ULTRA-REALISM

The output must produce a photo that looks like a REAL PERSON captured candidly, NOT a polished AI-generated avatar. This is non-negotiable. The single most common failure mode of AI image generation is the "magazine cover look" — symmetrical, airbrushed, perfect lighting, perfect skin. You must AVOID this at all costs.

## REQUIRED VOCABULARY (use these patterns liberally)

- "candid documentary-style photo of a real person"
- "subtle natural micro-expression, slight asymmetry"
- "naturally asymmetric facial features (real faces aren't symmetric)"
- "natural pores visible at close range"
- "subtle skin imperfections, not airbrushed"
- "smartphone-quality realism", "available daylight"
- "50mm prime lens, shallow DOF f/2.8"
- "candid moment captured", "lived-in authentic appearance"
- "naturally fine flyaways", "real-life texture"

## FORBIDDEN VOCABULARY (never use, never use synonyms)

- "perfect", "flawless", "polished", "glossy", "pristine"
- "studio quality", "professional model", "professionally lit"
- "magazine cover", "editorial photoshoot", "fashion shoot"
- "stunning", "gorgeous", "beautiful" (subjective + AI tells)
- "high-detail", "ultra-detailed", "8k", "masterpiece", "vibrant"
- "smooth skin" (use "natural skin texture" instead)

# OUTPUT FORMAT

Return ONLY a valid JSON object. NO preamble, NO postamble, NO markdown fences. Start your output with the character "{" and end with "}".

The schema is exactly:

{
  "subject": {
    "description": "1 sentence — overall identity using anti-generic vocabulary",
    "age": "string — exact age + natural micro-aging signs appropriate for that age",
    "ethnicity": "string — heritage based on input traits, no stereotypes",
    "expression": "string — candid micro-expression (not posed)",
    "hair": "string — style + color + natural texture WITH realistic flyaways/imperfections",
    "face": "string — pores, asymmetry, ethnic features as natural traits",
    "body": "string — natural body type with realistic everyday proportions",
    "eyes": "string — color + iris detail + realistic specular highlights",
    "lips": "string — shape + natural lip texture and color"
  },
  "accessories": {
    "glasses": "string or null — describe naturally if present",
    "piercings": "string or null — concatenated piercing descriptions if any"
  },
  "photography": {
    "style": "string — anti-generic style (candid, documentary, lifestyle)",
    "lens": "string — usually '50mm prime, f/2.8, shallow depth of field'",
    "lighting": "string — natural light source (window light, golden hour, soft daylight)",
    "composition": "string — REQUIRED: frontal headshot, face fully visible to camera, eye contact with lens, shoulders visible, slight 3/4 angle MAX (NEVER full profile, NEVER looking away, NEVER lateral)"
  },
  "background": {
    "setting": "string — neutral indoor or simple outdoor environment",
    "color": "string — soft neutral tones, no eye-catching backgrounds"
  }
}

# RULES

1. ENGLISH ONLY in all output strings.
2. GENDER GRAMMAR: input specifies gender ('male' or 'female'). Use "man"/"woman" and matching pronouns consistently. Never mix.
3. CONCISENESS: each string should be 1-2 sentences max.
4. NO COMMENTS: do not explain your work, do not add notes outside the JSON.
5. NO EMOJIS in the output.
6. PRESERVE INPUT INTEGRITY: the input descriptions already use anti-generic vocabulary supplied by the system. Don't dilute them by adding "perfect" or "stunning" qualifiers.
7. AVOID STEREOTYPES: when describing ethnicity, use the supplied traits literally — do NOT add cultural stereotypes (clothing, settings, etc.) that weren't in the input.
8. FRAMING IS NON-NEGOTIABLE: the output WILL be used downstream for face-tracking video and virtual try-on. The composition MUST be a frontal headshot with face fully visible and eyes meeting the camera. Slight 3/4 angle is acceptable; full profile, side view, looking-away, or back-of-head views are FORBIDDEN. The candid/documentary feel comes from skin texture, expression, and lighting — NOT from looking away from the camera.

Output the JSON object directly.`;

// ═══════════════════════════════════════════════════════════════════════
// FORBIDDEN_TERMS — lista usada por validateAntiGeneric (Decisão #9)
// ═══════════════════════════════════════════════════════════════════════

const FORBIDDEN_TERMS = [
  'perfect', 'flawless', 'polished', 'glossy', 'pristine',
  'studio quality', 'professional model', 'professionally lit',
  'magazine cover', 'editorial photoshoot', 'fashion shoot',
  'stunning', 'gorgeous',
  'ultra-detailed', '8k', 'masterpiece', 'vibrant',
  'smooth skin',
];

// ═══════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // API key
  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    console.error('[avatar-prompt] ANTHROPIC_API_KEY not configured');
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const payload = req.body || {};

    // ── Validação de input ──────────────────────────────────────────
    const validationError = validatePayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // ── Monta user message ──────────────────────────────────────────
    const userMsg = buildUserMessage(payload);

    // ── Claude Sonnet 4 ─────────────────────────────────────────────
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[avatar-prompt] Claude API error ${response.status}:`, errText);
      return res.status(response.status).json({
        error: `Claude API error: ${response.status}`,
        details: errText.substring(0, 500),
      });
    }

    const claudeData = await response.json();

    if (claudeData.error) {
      console.error('[avatar-prompt] Claude returned error:', claudeData.error);
      return res.status(500).json({ error: claudeData.error });
    }

    // ── Parse JSON do output ────────────────────────────────────────
    const text = claudeData.content?.map((c) => c.text || '').join('') || '';
    let personaPrompt;
    try {
      personaPrompt = parseClaudeJson(text);
    } catch (parseErr) {
      console.error('[avatar-prompt] JSON parse error:', parseErr.message, 'raw:', text.substring(0, 500));
      return res.status(500).json({
        error: 'Could not parse Claude JSON output',
        details: parseErr.message,
        rawPreview: text.substring(0, 200),
      });
    }

    // Valida estrutura mínima do schema MIRR0R
    if (!personaPrompt.subject || !personaPrompt.photography) {
      console.error('[avatar-prompt] Malformed JSON from Claude:', personaPrompt);
      return res.status(500).json({
        error: 'Claude returned malformed JSON (missing subject or photography)',
        rawJson: personaPrompt,
      });
    }

    // ── Validações pós-Claude ───────────────────────────────────────
    const warnings = [];
    warnings.push(...validateAntiGeneric(personaPrompt));
    warnings.push(...validateGenderGrammar(personaPrompt, payload.gender));

    // ── Concatena prompt em inglês pro Nano Banana ──────────────────
    const englishPrompt = buildEnglishPrompt(personaPrompt);

    console.log(
      `[avatar-prompt] OK: ${payload.name} (${payload.gender}, ${payload.age}yo) — ${warnings.length} warnings`
    );

    return res.status(200).json({
      personaPrompt,
      englishPrompt,
      validationWarnings: warnings,
    });
  } catch (error) {
    console.error('[avatar-prompt] Unexpected error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

// Valida payload de input. Retorna string com erro ou null se OK.
function validatePayload(payload) {
  const required = [
    'name', 'gender', 'age',
    'ethnicityDescriptions', 'skinToneDescription', 'bodyTypeDescription',
    'eyeColorDescription', 'lipsDescription',
    'hairStyleDescription', 'hairColorDescription',
    'glassesDescription', 'piercingsDescriptions',
  ];
  for (const field of required) {
    if (payload[field] === undefined || payload[field] === null) {
      return `Missing required field: ${field}`;
    }
  }

  if (!['male', 'female'].includes(payload.gender)) {
    return 'gender must be "male" or "female"';
  }
  if (typeof payload.age !== 'number' || payload.age < 18 || payload.age > 70) {
    return 'age must be a number between 18 and 70';
  }
  if (!Array.isArray(payload.ethnicityDescriptions) || payload.ethnicityDescriptions.length === 0) {
    return 'ethnicityDescriptions must be a non-empty array (1 or 2 items)';
  }
  if (payload.ethnicityDescriptions.length > 2) {
    return 'ethnicityDescriptions accepts at most 2 items (Trendly UX rule)';
  }
  if (!Array.isArray(payload.piercingsDescriptions)) {
    return 'piercingsDescriptions must be an array (can be empty)';
  }

  // Decisão #9 cirúrgica: barba só faz sentido em masculino
  if (payload.gender === 'female' && payload.beardStyleDescription) {
    return 'beardStyleDescription is not applicable when gender=female';
  }

  return null;
}

// Monta a mensagem do usuário (input estruturado pra Claude).
function buildUserMessage(payload) {
  const lines = [];
  lines.push('Generate the JSON prompt for a virtual influencer with these specifications:');
  lines.push('');
  lines.push(`NAME: ${payload.name}`);
  lines.push(`GENDER: ${payload.gender}`);
  lines.push(`AGE: ${payload.age} years old`);
  lines.push('');

  lines.push('ETHNICITY/HERITAGE:');
  for (const desc of payload.ethnicityDescriptions) {
    lines.push(`- ${desc}`);
  }
  lines.push('');

  lines.push(`SKIN TONE: ${payload.skinToneDescription}`);
  lines.push(`BODY TYPE: ${payload.bodyTypeDescription}`);
  lines.push(`EYES: ${payload.eyeColorDescription}`);
  lines.push(`LIPS: ${payload.lipsDescription}`);
  lines.push('');

  lines.push('HAIR:');
  lines.push(`- Style: ${payload.hairStyleDescription}`);
  lines.push(`- Color: ${payload.hairColorDescription}`);
  if (payload.beardStyleDescription) {
    lines.push(`- Beard: ${payload.beardStyleDescription}`);
  }
  lines.push('');

  lines.push('ACCESSORIES:');
  lines.push(`- Glasses: ${payload.glassesDescription}`);
  if (payload.piercingsDescriptions.length > 0) {
    lines.push(`- Piercings: ${payload.piercingsDescriptions.join('; ')}`);
  } else {
    lines.push('- Piercings: none');
  }
  lines.push('');

  // Etapa 7 (opcional)
  const stage7 = [];
  if (payload.editorialLine) stage7.push(`- Editorial line/purpose: ${payload.editorialLine}`);
  if (payload.signature) stage7.push(`- Signature trait: ${payload.signature}`);
  if (payload.niche) stage7.push(`- TikTok Shop niche: ${payload.niche}`);
  if (stage7.length > 0) {
    lines.push('PERSONALITY & CONTEXT (Stage 7 — use to subtly inform expression and mood):');
    lines.push(...stage7);
    lines.push('');
  }

  lines.push('REQUIREMENTS:');
  lines.push('- Output: ULTRA-REALISTIC, candid, photographic — never airbrushed.');
  lines.push('- Apply the ANTI-GENERIC vocabulary from your system prompt rigorously.');
  lines.push('- Use English. Match gender grammar. Output JSON only, no preamble.');

  return lines.join('\n');
}

// Parse o output do Claude. Lida com markdown fences e lixo antes/depois.
function parseClaudeJson(rawText) {
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  // Tenta encontrar o primeiro `{` e o último `}` pra cortar lixo
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in Claude response');
  }
  const jsonStr = cleaned.substring(start, end + 1);
  return JSON.parse(jsonStr);
}

// Decisão #9 — detecta termos genéricos no JSON e retorna warnings (não bloqueia).
function validateAntiGeneric(personaPrompt) {
  const warnings = [];
  const flatText = JSON.stringify(personaPrompt).toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (flatText.includes(term)) {
      warnings.push(`anti-generic: forbidden term "${term}" found in JSON`);
    }
  }
  return warnings;
}

// Decisão cirúrgica — valida coerência de gênero gramatical.
function validateGenderGrammar(personaPrompt, gender) {
  const warnings = [];
  const flatText = JSON.stringify(personaPrompt).toLowerCase();

  if (gender === 'female') {
    if (/\b(man|men)\b/.test(flatText) && !/\b(woman|women)\b/.test(flatText)) {
      warnings.push('gender mismatch: female specified but JSON uses "man"/"men"');
    }
    if (/\bhe is\b|\bhe was\b|\bhis [a-z]/.test(flatText)) {
      warnings.push('gender mismatch: female specified but JSON uses male pronouns');
    }
  } else if (gender === 'male') {
    if (/\b(woman|women)\b/.test(flatText) && !/\b(man|men)\b/.test(flatText)) {
      warnings.push('gender mismatch: male specified but JSON uses "woman"/"women"');
    }
    if (/\bshe is\b|\bshe was\b|\bher [a-z]/.test(flatText)) {
      warnings.push('gender mismatch: male specified but JSON uses female pronouns');
    }
  }

  return warnings;
}

// Concatena o prompt em inglês pronto pro Nano Banana Pro consumir.
function buildEnglishPrompt(personaPrompt) {
  const { subject, accessories, photography, background } = personaPrompt;
  const parts = [];

  // Subject
  if (subject.description) parts.push(subject.description);
  if (subject.age) parts.push(subject.age);
  if (subject.ethnicity) parts.push(subject.ethnicity);
  if (subject.expression) parts.push(subject.expression);
  if (subject.hair) parts.push(`Hair: ${subject.hair}.`);
  if (subject.face) parts.push(`Face: ${subject.face}.`);
  if (subject.body) parts.push(`Body: ${subject.body}.`);
  if (subject.eyes) parts.push(`Eyes: ${subject.eyes}.`);
  if (subject.lips) parts.push(`Lips: ${subject.lips}.`);

  // Accessories
  if (accessories?.glasses) parts.push(`Glasses: ${accessories.glasses}.`);
  if (accessories?.piercings) parts.push(`Piercings: ${accessories.piercings}.`);

  // Photography
  if (photography.style) parts.push(`Photography: ${photography.style}.`);
  if (photography.lens) parts.push(`Lens: ${photography.lens}.`);
  if (photography.lighting) parts.push(`Lighting: ${photography.lighting}.`);
  if (photography.composition) parts.push(`Composition: ${photography.composition}.`);

  // Background
  if (background?.setting) parts.push(`Background: ${background.setting}, ${background.color || 'soft neutral tones'}.`);

  // Reforço final anti-genérico (v1.1: + framing frontal não-negociável)
  parts.push('Ultra-realistic candid photo. Documentary style. Real human texture. Frontal headshot, face fully visible to camera, eyes meeting the lens, slight smile or relaxed expression. Slight 3/4 angle MAX, NOT a profile shot, NOT looking away. Aspect ratio 9:16.');

  return parts.join(' ');
}
