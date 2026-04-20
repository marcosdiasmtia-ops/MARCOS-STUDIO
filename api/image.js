// fal.ai Nano Banana image generation proxy (v3.1)
//
// HISTÓRICO DE FIXES:
// v2.2 — Fix 1: âncora de identidade
//        Fix 2: bodyDescription injetada
//        Fix 3: sanitização do negative prompt
// v2.3 — Fix B: âncora reforçada contra contaminação da imagem 2
// v2.4 — facePrompt: âncora com descrição textual detalhada do rosto
// v2.7 — productDescription: descrição técnica da peça (Claude Vision)
// v2.7.1 — anti-contaminação reforçada quando há productDescription
// v2.8 — anatomy guard: reforço anatômico + negative default pra reduzir
//        pés/mãos deformados (limitação clássica do Nano Banana)
// v3.0 — VIEW_TYPE BIFURCATION: anchor separada pra frontal vs back
// v3.1 — SIMPLIFICAÇÃO DO BACK ANCHOR:
//        Aprendizado do projeto legado: Nano Banana quer prompts CURTOS pra back.
//        v3.0 tinha regras demais ("face NOT visible, not in profile, not over
//        shoulder, neck aligned...") — modelo confundia e gerava Frankenstein
//        (tronco frontal + cabeça de costas). v3.1 reduz anchor de back pra
//        ~4 linhas, mantendo só identidade + anti-contaminação de produto.

const ANATOMY_GUARD_POSITIVE =
  'Natural foot positioning with both feet pointing forward in anatomically correct angles. ' +
  'Heels properly positioned with toes visible and aligned naturally. ' +
  'Hands with exactly 5 fingers each, correctly proportioned, no extra or missing digits. ' +
  'Anatomically accurate limbs, natural joint angles, proper body proportions throughout';

const ANATOMY_GUARD_NEGATIVE =
  'deformed feet, twisted feet, backwards feet, wrong foot direction, ' +
  'malformed toes, extra toes, missing toes, fused toes, anatomically incorrect ankles, ' +
  'distorted legs, broken bones appearance, weird foot angle, rotated feet, ' +
  'deformed hands, missing fingers, extra fingers, fused fingers, distorted hands, ' +
  'malformed limbs, extra limbs, floating limbs, disproportionate body, ' +
  'low quality, blurry, out of focus, pixelated';

const LIGIA_SPECIFIC_NEGATIVES = [
  'no freckles',
  'nose ring missing',
  'wrong hair color',
  'wrong hair texture',
  'straight hair without waves',
  'different face',
  'blue eyes',
  'brown eyes',
];

function sanitizeNegativePrompt(negativePrompt) {
  if (!negativePrompt || typeof negativePrompt !== 'string') return negativePrompt;
  let sanitized = negativePrompt;
  for (const item of LIGIA_SPECIFIC_NEGATIVES) {
    const re = new RegExp(`\\s*${item.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*,?`, 'gi');
    sanitized = sanitized.replace(re, '');
  }
  sanitized = sanitized.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').replace(/\s*,\s*/g, ', ').trim();
  if (sanitized.startsWith(',')) sanitized = sanitized.slice(1).trim();
  if (sanitized.endsWith(',')) sanitized = sanitized.slice(0, -1).trim();
  return sanitized;
}

// ─── FRONTAL anchor (comportamento v2.8, inalterado) ───
// Usado quando view_type = 'frontal'. Reforça "identical to first reference"
// porque a foto de referência É frontal e queremos manter tudo: pose, cenário, face.
function buildIdentityAnchorFrontal(profileName, bodyDescription, facePrompt, productDescription, numRefImages) {
  const parts = [];

  if (numRefImages >= 2) {
    parts.push(`Woman identical to the FIRST reference image only`);

    if (facePrompt && facePrompt.trim()) {
      parts.push(`Face details (MUST match exactly): ${facePrompt.trim()}`);
    } else {
      parts.push(`same exact face, skin tone, hair color and texture, eye color, body proportions, and any distinctive marks or features visible in that first image`);
    }

    if (bodyDescription && bodyDescription.trim()) {
      parts.push(`Body type: ${bodyDescription.trim()}`);
    }

    if (productDescription && productDescription.trim()) {
      parts.push(
        `She is wearing the EXACT garment shown in the SECOND reference image. ` +
        `Garment details (MUST preserve exactly): ${productDescription.trim()}. ` +
        `Do NOT simplify the design, do NOT make asymmetric cuts symmetric, do NOT change necklines, ` +
        `do NOT alter peplum direction or length. The garment from the second image is the ONLY source ` +
        `for clothing — do NOT add accessories or pieces not shown there`
      );
      parts.push(
        `CRITICAL IDENTITY RULE: the person generated is the woman from the FIRST reference image ONLY. ` +
        `The second reference image shows the garment modeled by a DIFFERENT person — ` +
        `you MUST NOT copy any physical feature of that different person. ` +
        `Do NOT copy their tattoos, do NOT copy their skin markings, do NOT copy their hair, ` +
        `do NOT copy their face, do NOT copy their body proportions, do NOT copy their makeup or accessories. ` +
        `The woman in the final image has NO tattoos unless they were visible in the first reference image. ` +
        `If the first reference woman has clean unmarked skin, the final image must also have clean unmarked skin`
      );
    } else {
      parts.push(
        `She is wearing the clothing item shown in the SECOND reference image. ` +
        `From the second image, use ONLY the garment design, cut, fabric texture and color. ` +
        `IGNORE completely the person wearing it in the second image — do NOT copy their tattoos, ` +
        `skin marks, hair, face, body type, makeup or any other physical feature. ` +
        `The person's identity and body come EXCLUSIVELY from the first reference image.`
      );
    }
  } else if (numRefImages === 1) {
    const faceTxt = facePrompt && facePrompt.trim()
      ? `Face details (MUST match exactly): ${facePrompt.trim()}`
      : 'same exact face, skin tone, hair, body proportions';
    parts.push(
      `Woman identical to the reference image. ${faceTxt}${bodyDescription ? `. Body type: ${bodyDescription.trim()}` : ''}.`
    );
  }

  return parts.length ? parts.join('. ') + '. ' : '';
}

// ─── BACK anchor (v3.1 — SIMPLIFICADO) ───
// Aprendizado: v3.0 era contraditório demais ("back fully to camera" + "face NOT
// visible" + "neck aligned with spine" + imagem frontal visualmente dominante =
// Frankenstein: tronco frontal + cabeça de costas).
// Projeto legado comprovou que Nano Banana quer prompts CURTOS pra back view —
// tipo "Woman standing back view wearing the outfit from reference image". Sem
// regras negativas empilhadas. O modelo entende e executa.
//
// O que mantivemos:
//  - facePrompt (identidade multi-influencer)
//  - productDescription + anti-contaminação (ex: não copiar tatuagem do modelo
//    da foto do produto, que é bug separado do de costas)
// O que removemos:
//  - "Woman identical to FIRST reference" (palavra "identical" induz cópia de pose)
//  - Bloco "CRITICAL ORIENTATION RULE" gigante com múltiplas negações
//  - "face must NOT be visible in profile / partially / over the shoulder" etc
function buildIdentityAnchorBack(profileName, bodyDescription, facePrompt, productDescription, numRefImages) {
  const parts = [];

  if (numRefImages >= 2) {
    // Instrução principal: curta e direta, padrão projeto legado.
    parts.push(`Woman standing back view, same woman as shown in the FIRST reference image`);

    // Identidade textual — ajuda multi-influencer sem empilhar restrições de pose.
    if (facePrompt && facePrompt.trim()) {
      parts.push(`Same identity: ${facePrompt.trim()}`);
    }

    if (bodyDescription && bodyDescription.trim()) {
      parts.push(`Body type: ${bodyDescription.trim()}`);
    }

    // Produto + anti-contaminação (bug separado, mantido porque já funcionava)
    if (productDescription && productDescription.trim()) {
      parts.push(
        `Wearing the outfit shown in the SECOND reference image. ` +
        `Garment details: ${productDescription.trim()}`
      );
      parts.push(
        `Use the SECOND reference image ONLY for garment design, cut, and fabric — ` +
        `do NOT copy any physical feature of the person modeling it there ` +
        `(no tattoos, no skin markings, no hair, no body type, no makeup). ` +
        `Identity comes exclusively from the FIRST reference image`
      );
    } else {
      parts.push(
        `Wearing the outfit shown in the SECOND reference image. ` +
        `From the second image use ONLY the garment — ignore the person wearing it, ` +
        `do NOT copy their tattoos, skin marks, hair, or body type`
      );
    }
  } else if (numRefImages === 1) {
    // Fallback — só 1 imagem (improvável mas tratado)
    parts.push(`Woman standing back view, same woman as shown in the reference image`);
    if (facePrompt && facePrompt.trim()) {
      parts.push(`Same identity: ${facePrompt.trim()}`);
    }
    if (bodyDescription) parts.push(`Body type: ${bodyDescription.trim()}`);
  }

  return parts.length ? parts.join('. ') + '. ' : '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

  try {
    const {
      prompt,
      image_urls,
      aspect_ratio = '9:16',
      profile_name,
      body_description,
      face_prompt,            // v2.4
      product_description,    // v2.7
      view_type = 'frontal',  // v3.0 — 'frontal' | 'back'
      negative_prompt,
    } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const hasImages = Array.isArray(image_urls) && image_urls.length > 0;
    const endpoint = hasImages ? 'fal-ai/nano-banana/edit' : 'fal-ai/nano-banana';

    // v3.0: escolhe anchor correta baseado em view_type
    const isBack = view_type === 'back';
    const anchorFn = isBack ? buildIdentityAnchorBack : buildIdentityAnchorFrontal;

    let finalPrompt = prompt;
    if (hasImages) {
      const anchor = anchorFn(profile_name, body_description, face_prompt, product_description, image_urls.length);
      if (anchor) {
        finalPrompt = anchor + prompt;
      }
      // v2.8: injeta reforço anatômico no final
      finalPrompt = finalPrompt.trim();
      if (!finalPrompt.endsWith('.')) finalPrompt += '.';
      finalPrompt += ' ' + ANATOMY_GUARD_POSITIVE + '.';
    }

    let finalNegative = null;
    if (hasImages) {
      const cleanedFrontendNegative = negative_prompt ? sanitizeNegativePrompt(negative_prompt) : '';
      finalNegative = cleanedFrontendNegative
        ? `${cleanedFrontendNegative}, ${ANATOMY_GUARD_NEGATIVE}`
        : ANATOMY_GUARD_NEGATIVE;
    } else if (negative_prompt) {
      finalNegative = sanitizeNegativePrompt(negative_prompt);
    }

    console.log(`[image v3.1] endpoint=${endpoint}, view=${view_type}, hasImages=${hasImages}, imgs=${image_urls?.length||0}, profile=${profile_name||'—'}, bodyDesc=${!!body_description}, facePrompt=${!!face_prompt}, productDesc=${!!product_description}, negLen=${finalNegative?.length||0}`);

    const body = {
      prompt: finalPrompt,
      aspect_ratio,
      output_format: 'png',
      num_images: 1,
    };
    if (hasImages) body.image_urls = image_urls;
    if (finalNegative) body.negative_prompt = finalNegative;

    const submitRes = await fetch(`https://queue.fal.run/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${FAL_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      console.error(`[image v3.1] fal.ai submit error ${submitRes.status}:`, errText);
      return res.status(submitRes.status).json({ error: `fal.ai error: ${submitRes.status}`, details: errText });
    }

    const submitData = await submitRes.json();

    if (submitData.images) {
      return res.status(200).json(submitData);
    }

    const requestId = submitData.request_id;
    if (!requestId) return res.status(500).json({ error: 'No request_id', data: submitData });

    const statusUrl = submitData.status_url || `https://queue.fal.run/fal-ai/nano-banana/requests/${requestId}/status`;
    const responseUrl = submitData.response_url || `https://queue.fal.run/fal-ai/nano-banana/requests/${requestId}`;

    console.log(`[image v3.1] Queued: ${requestId}`);

    let attempts = 0;
    const maxAttempts = 60;
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      });
      if (!statusRes.ok) {
        console.error(`[image v3.1] Status check error ${statusRes.status}`);
        continue;
      }
      const status = await statusRes.json();

      if (status.status === 'COMPLETED') {
        const resultRes = await fetch(responseUrl, {
          headers: { 'Authorization': `Key ${FAL_KEY}` },
        });
        const result = await resultRes.json();
        return res.status(200).json(result);
      }

      if (status.status === 'FAILED') {
        console.error(`[image v3.1] Generation failed:`, status);
        return res.status(500).json({ error: 'Image generation failed', details: status });
      }
    }

    return res.status(408).json({ error: 'Timeout waiting for image', requestId });
  } catch (error) {
    console.error('[image v3.1] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
