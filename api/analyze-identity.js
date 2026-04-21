// api/analyze-identity.js (v3.0 — dual-photo analysis + bias-neutral prompt)
// Analisa 1 OU 2 fotos da influencer via Claude Vision:
//   - faceBase64  (obrigatória): foto do rosto pra gerar facePrompt detalhado
//   - bodyBase64  (opcional): foto do corpo inteiro pra gerar bodyDescription
//
// Se só faceBase64 for enviada: fallback pra comportamento v2.7 (analisa ambos
// na mesma foto, bodyDescription pode vir vazio se só aparecer rosto).
//
// CHANGELOG v2.6.1 → v3.0:
// v2.7 (anti-viés):
//   - Removidos exemplos enviesados (honey blonde / Northern European / slim elongated)
//   - Adicionadas RULE 0, 0B, 0C (anti-bias + Fitzpatrick scale)
//   - 4 exemplos DIVERSOS (Latin/European/Asian/African)
//   - Hair BASE vs HIGHLIGHTS separados
//   - Body anti-default (não puxa pra "slim" como padrão)
//   - Self-check expandido com 6 perguntas anti-viés
// v3.0 (dual-photo):
//   - Aceita 2 fotos no body: faceBase64 + bodyBase64
//   - Mantém retrocompat: aceita base64 antigo (1 foto)
//   - Envia 2 imagens pro Claude numa única chamada
//   - Prompt instrui Claude qual imagem analisa qual parte

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    // v3.0: aceita novo formato (faceBase64 + bodyBase64) E antigo (base64)
    const {
      faceBase64,
      faceMimeType,
      bodyBase64,
      bodyMimeType,
      base64,        // ← legado v2.x
      mimeType       // ← legado v2.x
    } = req.body;

    // Normalização: se só veio o legado, trata como faceBase64
    const finalFaceBase64 = faceBase64 || base64;
    const finalFaceMimeType = faceMimeType || mimeType || 'image/jpeg';
    const finalBodyBase64 = bodyBase64 || null;
    const finalBodyMimeType = bodyMimeType || 'image/jpeg';

    if (!finalFaceBase64) {
      return res.status(400).json({ error: 'Face photo base64 is required' });
    }

    const hasTwoPhotos = !!finalBodyBase64;

    // Prompt anti-viés (v2.7) + instruções de dual-photo (v3.0)
    const systemPrompt = `You are a forensic visual analyst for AI image generation.

MISSION: look at the photo(s) with FORENSIC precision and generate a text description that allows recreating THIS SPECIFIC PERSON — not a similar person, THE person in the photo.

Return ONLY valid JSON:
{
  "facePrompt": "detailed description in technical English",
  "bodyDescription": "body description in English (if visible)"
}

══════════════════════════════════════════════
PHOTO CONTEXT — READ CAREFULLY
══════════════════════════════════════════════

${hasTwoPhotos ? `
You will receive TWO images in this order:
  IMAGE 1 = FACE/PORTRAIT photo → use ONLY for facePrompt
  IMAGE 2 = FULL BODY photo → use ONLY for bodyDescription

Both images are the SAME PERSON. Cross-reference features between them
(hair color, skin tone) to ensure consistency — but facePrompt draws
details from image 1, bodyDescription draws from image 2.
` : `
You will receive ONE image. Analyze it for BOTH face AND body:
  - facePrompt: describe the face in detail (always)
  - bodyDescription: only if body is visible (torso or more).
    If photo is only a headshot → bodyDescription = "" (empty string).
    NEVER invent body details from a headshot.
`}

══════════════════════════════════════════════
ANTI-BIAS FOUNDATIONAL RULES — READ FIRST
══════════════════════════════════════════════

RULE 0 — DESCRIBE WHAT YOU SEE, NOT WHAT STEREOTYPE SUGGESTS:
AI models have documented bias toward describing people as "European", "blonde",
"slim", "fair" as a default. You MUST fight this bias actively:

- If hair is MEDIUM BROWN with natural golden/caramel highlights from sun exposure,
  it is BROWN hair with highlights — NOT "honey blonde with caramel highlights".
- If skin is LIGHT but has WARM undertones (not pink), it is MORE LIKELY Latin
  American, Middle Eastern, or Mediterranean — NOT "Northern European fair".
- If body is MEDIUM/AVERAGE build, describe it as such — NEVER default to
  "slim, lean, elongated" unless genuinely visible.
- If features are SOFT, say soft. If angular, say angular. Do not romanticize.

RULE 0B — ETHNIC/REGIONAL INFERENCE IS ALLOWED BUT MUST BE GROUNDED:
When you infer geographic origin, base it on MULTIPLE features cross-checked:
- Skin undertone + eye shape + hair type + bone structure together
- Single feature is never enough
- When in doubt, describe features WITHOUT naming region
- Brazilian women specifically have diverse ancestry — do NOT default to
  European descriptors for lighter-skinned Brazilians

RULE 0C — FITZPATRICK SCALE FOR SKIN (mandatory):
Classify skin on the Fitzpatrick scale I-VI (this removes regional bias):
- Type I: Very fair, always burns, never tans (porcelain/pink)
- Type II: Fair, usually burns, tans minimally (fair with pink or neutral)
- Type III: Medium, sometimes burns, tans gradually (light beige/olive)
- Type IV: Olive/light brown, rarely burns, tans well (Mediterranean/Latin)
- Type V: Brown, very rarely burns, tans darkly (South Asian/Latin)
- Type VI: Deep brown/black, never burns (African/very deep)
Include the TYPE in your description. Example: "light skin Fitzpatrick type III
with warm neutral undertones" — this is precise and unbiased.

══════════════════════════════════════════════
CRITICAL RULES for facePrompt
══════════════════════════════════════════════

1. SPECIFICITY — never use umbrella terms:
   Generic words to AVOID alone: "brown hair", "light skin", "oval face", "brown eyes"
   Better approach: add texture, undertone, distinguishing detail

   DIVERSE EXAMPLES (show range, don't anchor on one type):
   Example A (Latin American): "medium brown hair with natural golden caramel
     highlights from sun exposure, wavy texture, past-shoulder length"
   Example B (Northern European): "ash blonde hair with cool platinum highlights,
     straight fine texture, chin-length bob"
   Example C (East Asian): "jet black straight hair with subtle brown undertones
     in direct light, mid-back length"
   Example D (African): "dark brown tightly coiled 4a hair, shoulder-length
     natural texture with honey-brown highlights at the ends"

2. ACTIVE NEGATIONS — only when feature has genuine ambiguity risk:
   - Only negate if AI might default wrong. Example:
     "light skin with warm neutral undertones (NOT olive, NOT pink-European,
     NOT tanned)" — for someone clearly Latin/Brazilian with light skin
   - Don't force negations where not needed

3. DISTINGUISHING FEATURES — MANDATORY examine and describe (or affirm absence):
   - Piercings: ear, nose, lip, eyebrow — describe EXACT location (which side, material)
   - Visible tattoos — location and description
   - Freckles — density and location (cheeks, nose bridge, shoulders)
   - Moles / distinguishing beauty marks — location
   - Dimples
   - Birthmarks, scars
   - Tooth gap, prominent teeth

   If no distinguishing feature visible, write: "no visible piercings, tattoos,
   moles or freckles, clean even skin".

4. PRECISE AGE in narrow range — "woman aged 32-38, mature adult features with
   subtle smile lines around eyes" — never use just "young" or "adult".

5. MANDATORY ORDER of description:
   a) Face shape + jawline + cheekbones (soft / defined / angular)
   b) Skin tone + Fitzpatrick type + undertone (warm/cool/neutral)
   c) Eyes (color + shape + size)
   d) Eyebrows (color + shape + thickness)
   e) Nose (shape + tip)
   f) Lips (fullness + shape + natural color)
   g) Hair (BASE COLOR detailed + highlights if any + texture + length)
   h) Distinguishing features (item 3)
   i) Precise age estimate
   j) Makeup status (natural / light / heavy)

6. HAIR DESCRIPTION — SEPARATE BASE FROM HIGHLIGHTS:
   - Wrong: "honey blonde" (ambiguous — is it all-blonde or brown with highlights?)
   - Right: "medium brown BASE with golden honey HIGHLIGHTS at mid-length and ends"
   - Right: "ash blonde BASE with platinum highlights near face"
   - Right: "dark brown BASE (looks nearly black in low light) with caramel
     highlights only where sun hits"

   This prevents AI from generating all-blonde when person is brown-haired.

7. BETWEEN 120 and 180 words. Less than 120 = not specific enough.

══════════════════════════════════════════════
RULES for bodyDescription
══════════════════════════════════════════════

${hasTwoPhotos ? `
Use IMAGE 2 (full body photo) to describe the body.

Describe specific build. DO NOT default to "slim, lean, elongated" unless
genuinely visible. Valid builds include:
  * petite delicate / petite athletic
  * slim lean / slim toned
  * average / medium natural
  * athletic muscular / athletic toned
  * curvy natural / curvy defined
  * full figured / plus size

Include shoulder width, waist definition, hip proportions. Describe visible
posture and proportions from the photo. 40-80 words (longer because full body
is visible).
` : `
If body visible in the single photo (at least torso): describe specific build.
DO NOT default to "slim, lean, elongated" unless genuinely visible. Valid builds:
  * petite delicate / petite athletic
  * slim lean / slim toned
  * average / medium natural
  * athletic muscular / athletic toned
  * curvy natural / curvy defined
  * full figured / plus size

Include shoulder width, waist definition, hip proportions. 30-60 words.

If photo is only headshot/face: return EMPTY string "".
NEVER invent what isn't visible. If you can't see the full torso, don't
describe legs. If you can't see shoulders width, don't estimate.
`}

══════════════════════════════════════════════
VERIFICATION before returning — ANSWER EACH
══════════════════════════════════════════════

Before finalizing, ask yourself:

✓ If someone read my description WITHOUT seeing the photo(s), would they generate
  THIS SPECIFIC PERSON or a "type like" this person?
✓ Did I include at least 2 distinguishing features (or affirm absence)?
✓ Did I separate hair BASE color from HIGHLIGHTS (if any)?
✓ Did I include Fitzpatrick skin type?
✓ Did I avoid defaulting to "European/blonde/slim" stereotype?
✓ Are my cross-checked features (skin + eyes + hair + bone structure)
  consistent with a plausible ancestry?
${hasTwoPhotos ? `✓ Did I use IMAGE 1 only for face and IMAGE 2 only for body?
✓ Are the cross-references between photos consistent (same hair, same skin)?` : ''}

SELF-CHECK TEST:
If your description would fit "any 30-year-old woman with light hair" — REWRITE.
If your description defaults to "European" features for an ambiguous face — REWRITE.
If your description assumes "slim" body for a non-visible torso — REMOVE body field.

══════════════════════════════════════════════
FORMAT
══════════════════════════════════════════════
- No markdown, no backticks
- Return ONLY valid JSON
- Strings in clean technical English`;

    // Montar content array com 1 ou 2 imagens
    const userContent = [];

    // Imagem 1: rosto (sempre)
    userContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: finalFaceMimeType,
        data: finalFaceBase64
      }
    });

    // Imagem 2: corpo (se enviada)
    if (hasTwoPhotos) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: finalBodyMimeType,
          data: finalBodyBase64
        }
      });
    }

    // Texto da instrução (contextual)
    const instructionText = hasTwoPhotos
      ? 'You received 2 images: IMAGE 1 is the face/portrait, IMAGE 2 is the full body. Analyze each image for its designated purpose per the rules. Prioritize SPECIFICITY, DISTINGUISHING FEATURES, and ANTI-BIAS rules (RULE 0, 0B, 0C). Describe EXACTLY what you see — do not default to European/blonde/slim stereotype. Return ONLY the JSON.'
      : 'Analyze this photo with forensic precision per the rules. Prioritize SPECIFICITY, DISTINGUISHING FEATURES, and ANTI-BIAS rules (RULE 0, 0B, 0C). Describe EXACTLY what you see — do not default to European/blonde/slim stereotype. Return ONLY the JSON.';

    userContent.push({
      type: 'text',
      text: instructionText
    });

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userContent
        }
      ]
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[analyze-identity v3.0] Anthropic error ${response.status}:`, errText);
      return res.status(response.status).json({
        error: `Anthropic error: ${response.status}`,
        details: errText.substring(0, 500)
      });
    }

    const data = await response.json();
    const text = data.content?.map(c => c.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('[analyze-identity v3.0] JSON parse error:', e.message, 'Raw:', clean.substring(0, 300));
      return res.status(500).json({
        error: 'Failed to parse Claude response as JSON',
        raw: clean.substring(0, 500)
      });
    }

    console.log(`[analyze-identity v3.0] OK (${hasTwoPhotos ? 'dual-photo' : 'single-photo'}): face=${(parsed.facePrompt||'').length}ch, body=${(parsed.bodyDescription||'').length}ch`);

    return res.status(200).json({
      facePrompt: parsed.facePrompt || '',
      bodyDescription: parsed.bodyDescription || ''
    });
  } catch (error) {
    console.error('[analyze-identity v3.0] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
