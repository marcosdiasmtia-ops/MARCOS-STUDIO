// api/analyze-face.js (v1.0 — VTON cadastro mínimo)
//
// Analisa 1 foto de close-up de rosto da influencer via Claude Vision e retorna
// estrutura AGNÓSTICA com os 4 campos do cadastro VTON v1:
//   { hair, ageHint, vibe, signature }
//
// Esse endpoint substitui (no fluxo VTON) o api/analyze-identity.js legacy.
// O legacy continua existindo intacto pro fluxo FLUX.2 pro tradicional.
//
// PRINCÍPIOS — Regra 15 do Notion (Sistema agnóstico):
//   - NUNCA hardcodar fenótipo, etnia, cor de pele "padrão"
//   - Claude descreve EXATAMENTE o que vê na foto, sem default
//   - Sem viés europeu, anti-bias Fitzpatrick I-VI
//   - Sem envelhecimento (default jovem quando incerto)
//
// Input:
//   { faceBase64, faceMimeType }  // close-up de rosto bem iluminado
//
// Output (JSON):
//   {
//     hair: { color: string, texture: string, length: string },
//     ageHint: string,           // ex: "early thirties"
//     vibe: string,              // 1-3 palavras, ex: "elegant refined"
//     signature: {
//       skin: string,            // descrição da pele real
//       accent: string | null,   // traço marcante real (opcional)
//       makeup: string           // ex: "soft natural"
//     }
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
    const { faceBase64, faceMimeType } = req.body;

    if (!faceBase64) {
      return res.status(400).json({ error: 'faceBase64 is required' });
    }

    const finalMimeType = faceMimeType || 'image/jpeg';

    const systemPrompt = `You are a forensic visual analyst for AI image generation in a UGC fashion content system.

MISSION: look at the close-up face photo with forensic precision and extract STRUCTURED DATA that will be used to build UGC prompts (Nano Banana Pro VTON pipeline).

Return ONLY valid JSON. No prose, no markdown, no explanation. Just JSON.

Schema:
{
  "hair": {
    "color":   "natural language description of hair color exactly as seen",
    "texture": "wavy | straight | curly | coily | textured",
    "length":  "natural language description of length"
  },
  "ageHint":   "natural language age range like 'early twenties' or 'mid thirties'",
  "vibe":      "1-3 words capturing the overall style energy",
  "signature": {
    "skin":   "natural language description of skin tone and texture",
    "accent": "any distinctive REAL feature like piercing, freckles, dimples, mole, scar — or null if none",
    "makeup": "description of makeup style — or 'no makeup' if bare"
  }
}

═════════════════════════════════════════════════════════
ANTI-BIAS RULES — NON-NEGOTIABLE
═════════════════════════════════════════════════════════

RULE A — DESCRIBE WHAT YOU SEE, NOT WHAT YOU EXPECT
  - Look at the photo. Describe what is THERE.
  - Do NOT default to "honey blonde", "fair skin", "European features".
  - If the person is Black, write Black features. If Asian, Asian features.
    If Latin, Latin features. If Middle Eastern, Middle Eastern features.
  - Use Fitzpatrick skin scale awareness (I through VI). All valid.

RULE B — NO ENVELHECIMENTO (anti-aging bias)
  - When in doubt, default to YOUNGER, not older.
  - Do NOT use words like "mature", "weathered", "expression lines",
    "outdoor lifestyle" unless the person is clearly 40+.
  - Smooth skin = young. Wavy hair ≠ old. Confident posture ≠ old.

RULE C — VIBE IS STYLE, NOT PERSONALITY
  - "vibe" should describe the styling energy, not psychology.
  - Good examples:
    * "elegant refined"
    * "sporty energetic"
    * "edgy urban"
    * "soft natural"
    * "bold confident"
    * "minimalist clean"
  - Bad examples (don't use):
    * "happy", "sad", "introverted" (psychology)
    * "European", "American" (geography)
    * "thin", "curvy" (body — not in this endpoint)

RULE D — HAIR SEPARATION
  - "hair.color" is the BASE color first. If there are highlights/balayage,
    mention them after the base.
  - Example: "deep brown with warm caramel highlights"
  - Example: "natural black"
  - Example: "honey blonde with sun-kissed lighter ends"
  - Example: "auburn with copper highlights"

RULE E — ACCENT IS REAL OR NULL
  - Only include "signature.accent" if you can clearly SEE the feature.
  - Don't invent. If the face is clean and unmarked → "accent": null
  - Examples valid: "small nose piercing on left nostril", "freckles
    across nose bridge", "single mole near left jawline", "dimples
    when smiling"
  - If unsure → null

RULE F — MAKEUP IS DESCRIPTIVE
  - "no makeup" / "barely-there natural" / "soft natural with light
    eye definition" / "bold lip with neutral eye" / "smoky eye" /
    "full glam"
  - Don't moralize. Just describe.

═════════════════════════════════════════════════════════
EXAMPLES OF VALID OUTPUTS (DIVERSE)
═════════════════════════════════════════════════════════

Example 1 (Latin woman):
{
  "hair": { "color": "deep brown with warm caramel highlights", "texture": "wavy", "length": "long, past shoulders" },
  "ageHint": "late twenties",
  "vibe": "elegant refined",
  "signature": { "skin": "warm olive with natural texture", "accent": "small nose piercing on right nostril", "makeup": "soft natural" }
}

Example 2 (Black woman):
{
  "hair": { "color": "natural deep black", "texture": "coily", "length": "shoulder-length afro" },
  "ageHint": "early thirties",
  "vibe": "bold confident",
  "signature": { "skin": "deep with subtle warm undertones, smooth", "accent": null, "makeup": "bold lip with neutral eye" }
}

Example 3 (East Asian woman):
{
  "hair": { "color": "natural black with subtle brown ends", "texture": "straight", "length": "long, mid-back" },
  "ageHint": "mid twenties",
  "vibe": "minimalist clean",
  "signature": { "skin": "fair with cool undertones, porcelain", "accent": null, "makeup": "barely-there natural" }
}

Example 4 (European woman):
{
  "hair": { "color": "honey blonde with lighter sun-kissed ends", "texture": "wavy", "length": "long, past shoulders" },
  "ageHint": "early thirties",
  "vibe": "soft natural",
  "signature": { "skin": "fair with warm undertones, light freckles", "accent": "freckles across nose bridge", "makeup": "soft natural" }
}

═════════════════════════════════════════════════════════
OUTPUT
═════════════════════════════════════════════════════════

Look at the image. Apply RULES A-F. Output ONLY the JSON, nothing else.`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: finalMimeType,
                  data: faceBase64
                }
              },
              {
                type: 'text',
                text: 'Analyze this face photo and return ONLY the JSON object as specified.'
              }
            ]
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error('[analyze-face] Claude API error:', claudeResponse.status, errText);
      return res.status(500).json({ error: `Claude API error: ${claudeResponse.status}` });
    }

    const claudeData = await claudeResponse.json();
    const rawText = claudeData?.content?.[0]?.text || '';

    // Extrai o JSON do output do Claude (pode vir com markdown wrapper apesar das instruções)
    let parsed;
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[analyze-face] Failed to parse Claude output:', rawText);
      return res.status(500).json({
        error: 'Failed to parse face analysis',
        rawOutput: rawText
      });
    }

    // Validação leve do schema
    if (!parsed?.hair?.color || !parsed?.hair?.texture || !parsed?.hair?.length) {
      return res.status(500).json({
        error: 'Invalid hair structure in response',
        rawOutput: parsed
      });
    }
    if (!parsed?.ageHint || !parsed?.vibe || !parsed?.signature) {
      return res.status(500).json({
        error: 'Missing required fields in response',
        rawOutput: parsed
      });
    }

    console.log('[analyze-face] OK:', JSON.stringify(parsed).substring(0, 200));
    return res.status(200).json(parsed);

  } catch (error) {
    console.error('[analyze-face] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
