// fal.ai Nano Banana image generation proxy (v3.3)
//
// HISTORICO DE FIXES:
// v2.2 - Fix 1: ancora de identidade
//        Fix 2: bodyDescription injetada
//        Fix 3: sanitizacao do negative prompt
// v2.3 - Fix B: ancora reforcada contra contaminacao da imagem 2
// v2.4 - facePrompt: ancora com descricao textual detalhada do rosto
// v2.7 - productDescription: descricao tecnica da peca (Claude Vision)
// v2.7.1 - anti-contaminacao reforcada quando ha productDescription
// v2.8 - anatomy guard: reforco anatomico + negative default pra reduzir
//        pes/maos deformados (limitacao classica do Nano Banana)
// v3.0 - VIEW_TYPE BIFURCATION: anchor separada pra frontal vs back
// v3.1 - SIMPLIFICACAO DO BACK ANCHOR:
//        Aprendizado do projeto legado: Nano Banana quer prompts CURTOS pra back.
// v3.2 - DOIS FIXES CIRURGICOS NA BACK ANCHOR:
//        1) "Rear view of the same woman..." no inicio pra fixar orientacao
//        2) Reforco de que a imagem 2 mostra as COSTAS do produto
// v3.3 - REFORCO ANTI-PERFIL E ANTI-INVENCAO:
//        Problema observado em producao: Nano Banana vazava perfil/three-quarter
//        e inventava zipers em pecas lisas. v3.3 ataca essas duas falhas com
//        5 mudancas cirurgicas:
//        1) Prefixo STRICT REAR VIEW (head facing away, no face visible)
//           antes de "Rear view of the same woman..." pra reforcar posicao.
//        2) Instrucao CONDICIONAL sobre design traseiro substitui a lista
//           "zippers/seams/openings" (que induzia invencao em peca lisa).
//           Agora: "se tem detalhe -> reproduz; se e lisa -> mantem lisa".
//        3) Deteccao automatica de "smooth back" no prompt recebido ->
//           adiciona instrucao anti-invencao especifica.
//        4) Pose anatomy back: ombros quadrados, coluna reta, cabelo
//           posicionado pra nao cobrir o design.
//        5) STRICT_BACK_NEGATIVE: negative especifico de posicao aplicado
//           APENAS quando view_type === 'back'. Inclui face/profile/
//           three-quarter/head-turned/looking-over-shoulder/etc.
//        Nao mexido: FRONTAL anchor, ANATOMY_GUARD geral, sanitizacao,
//        handler principal, polling do fal.ai. Tudo isso funciona.

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

// v3.3 - Negative especifico de posicao, aplicado APENAS em view_type='back'.
// Duplica a protecao do positivo (STRICT REAR VIEW) com linguagem de negative,
// porque Nano Banana responde a ambos e as vezes ignora um dos dois.
const STRICT_BACK_NEGATIVE =
  'face visible, frontal view, front view, profile view, side view, ' +
  'three-quarter view, three quarter view, three-quarter angle, ' +
  'partial face visible, chin visible, cheek visible, mouth visible, ' +
  'eye visible from front, nose visible, ' +
  'head turned sideways, head turned to camera, head tilted to side, ' +
  'looking over shoulder, looking back at camera, glancing at camera, ' +
  'twisted torso, torso rotated to camera';

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

// --- FRONTAL anchor (comportamento v2.8, inalterado em v3.3) ---
// Usado quando view_type = 'frontal'. Reforca "identical to first reference"
// porque a foto de referencia E frontal e queremos manter tudo: pose, cenario, face.
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
        `for clothing - do NOT add accessories or pieces not shown there`
      );
      parts.push(
        `CRITICAL IDENTITY RULE: the person generated is the woman from the FIRST reference image ONLY. ` +
        `The second reference image shows the garment modeled by a DIFFERENT person - ` +
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
        `IGNORE completely the person wearing it in the second image - do NOT copy their tattoos, ` +
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

// --- BACK anchor (v3.3 - REFORCO ANTI-PERFIL E ANTI-INVENCAO) ---
//
// Aprendizado de producao v3.2:
//  - Nano Banana vazava perfil/three-quarter apesar do "Rear view" no inicio.
//  - Quando o prompt mencionava "zippers" na lista de detalhes a preservar,
//    a IA inventava ziper mesmo em peca lisa.
//  - Pose das costas variava (peplum mudando, coluna torta).
//
// v3.3 resolve com:
//  1) Prefixo STRICT REAR VIEW antes de tudo (maior peso que negative).
//  2) Instrucao CONDICIONAL sobre design traseiro (se tem -> reproduz;
//     se e lisa -> mantem lisa). Sem listar "zippers" como palavra-chave.
//  3) Deteccao de "smooth back" no prompt recebido do generate-back
//     (sinal vindo da v3.7/v3.8) -> reforco anti-invencao.
//  4) Anatomy pose back: ombros quadrados, coluna reta.
//
// Parametro extra "smoothBackHint" vem do handler apos detectar "smooth back"
// no prompt recebido.
function buildIdentityAnchorBack(profileName, bodyDescription, facePrompt, productDescription, numRefImages, smoothBackHint) {
  const parts = [];

  // v3.3 - Bloco 1: prefixo STRICT REAR VIEW (maior peso que o resto do prompt)
  parts.push(
    `STRICT 100% REAR VIEW. Head facing completely away from the camera. ` +
    `Back of the head and hair are what the camera sees. ` +
    `No face visible at any angle. No profile, no three-quarter, no looking back. ` +
    `Shoulders squared to the camera plane, spine aligned vertically, ` +
    `natural standing pose with weight distributed evenly`
  );

  if (numRefImages >= 2) {
    // v3.2 mantido: "Rear view" pra reforcar orientacao
    parts.push(`Rear view of the same woman shown in the FIRST reference image`);

    if (facePrompt && facePrompt.trim()) {
      parts.push(`Same identity: ${facePrompt.trim()}`);
    }

    if (bodyDescription && bodyDescription.trim()) {
      parts.push(`Body type: ${bodyDescription.trim()}`);
    }

    // v3.3 - Bloco 2: instrucao CONDICIONAL sobre design traseiro.
    // Substitui a lista ambigua do v3.2 por uma regra clara:
    //   SE tem detalhe visivel na imagem 2 -> reproduz;
    //   SE e lisa -> mantem lisa, NAO inventa.
    if (productDescription && productDescription.trim()) {
      parts.push(
        `Wearing the outfit shown in the SECOND reference image. ` +
        `The SECOND reference image shows the BACK of the garment. ` +
        `Examine the back carefully. If a visible detail is present ` +
        `(such as a back opening, cutout, crossed straps, tie knot, ruched panel, ` +
        `decorative seam, or button row), reproduce it EXACTLY as shown. ` +
        `If the back is smooth and undetailed, keep it smooth and clean. ` +
        `Do NOT add details that are not visible in the reference. ` +
        `Garment details: ${productDescription.trim()}`
      );

      // v3.3 - Bloco 3: se o prompt veio com "smooth back", reforco explicito.
      if (smoothBackHint) {
        parts.push(
          `IMPORTANT: the back of this garment is smooth with no decorative details. ` +
          `The back surface is uniform. ` +
          `Do NOT add a zipper, do NOT add seams, do NOT add any invented decoration. ` +
          `Keep the back surface clean and continuous`
        );
      }

      parts.push(
        `Use the SECOND reference image ONLY for garment design, cut, and fabric - ` +
        `do NOT copy any physical feature of the person modeling it there ` +
        `(no tattoos, no skin markings, no hair, no body type, no makeup). ` +
        `Identity comes exclusively from the FIRST reference image`
      );
    } else {
      parts.push(
        `Wearing the outfit shown in the SECOND reference image. ` +
        `If the back of the garment shows visible details reproduce them exactly; ` +
        `if the back is smooth keep it smooth - do NOT invent details. ` +
        `From the second image use ONLY the garment - ignore the person wearing it, ` +
        `do NOT copy their tattoos, skin marks, hair, or body type`
      );

      if (smoothBackHint) {
        parts.push(
          `IMPORTANT: the back of this garment is smooth with no decorative details. ` +
          `Do NOT invent a zipper, seam, or back detail`
        );
      }
    }

    // v3.3 - Bloco 4: pose anatomy especifica pra back
    parts.push(
      `Hair falls naturally over the back and shoulders without completely ` +
      `concealing the garment's back design. ` +
      `Both feet planted on the ground, visible from behind, ankles aligned naturally`
    );
  } else if (numRefImages === 1) {
    // Fallback: so 1 imagem. Mantem a ideia de STRICT REAR VIEW.
    parts.push(`Rear view of the same woman shown in the reference image`);
    if (facePrompt && facePrompt.trim()) {
      parts.push(`Same identity: ${facePrompt.trim()}`);
    }
    if (bodyDescription) parts.push(`Body type: ${bodyDescription.trim()}`);
    if (smoothBackHint) {
      parts.push(`The back of the garment is smooth - do NOT invent details`);
    }
  }

  return parts.length ? parts.join('. ') + '. ' : '';
}

// v3.3 - Detecta no prompt recebido se ha indicacao de "smooth back".
// Sinal vem do generate-back.js (v3.7/v3.8) que escreve "with smooth back"
// quando Claude detecta que a peca nao tem detalhe traseiro marcante.
function detectSmoothBackHint(prompt) {
  if (!prompt || typeof prompt !== 'string') return false;
  return /\bsmooth\s+back\b/i.test(prompt) || /\bwith\s+no\s+back\s+details\b/i.test(prompt);
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
      face_prompt,
      product_description,
      view_type = 'frontal',
      negative_prompt,
    } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const hasImages = Array.isArray(image_urls) && image_urls.length > 0;
    const endpoint = hasImages ? 'fal-ai/nano-banana/edit' : 'fal-ai/nano-banana';

    const isBack = view_type === 'back';

    // v3.3 - detecta hint de "smooth back" vindo do prompt
    const smoothBackHint = isBack && detectSmoothBackHint(prompt);

    let finalPrompt = prompt;
    if (hasImages) {
      const anchor = isBack
        ? buildIdentityAnchorBack(profile_name, body_description, face_prompt, product_description, image_urls.length, smoothBackHint)
        : buildIdentityAnchorFrontal(profile_name, body_description, face_prompt, product_description, image_urls.length);

      if (anchor) {
        finalPrompt = anchor + prompt;
      }
      finalPrompt = finalPrompt.trim();
      if (!finalPrompt.endsWith('.')) finalPrompt += '.';
      finalPrompt += ' ' + ANATOMY_GUARD_POSITIVE + '.';
    }

    let finalNegative = null;
    if (hasImages) {
      const cleanedFrontendNegative = negative_prompt ? sanitizeNegativePrompt(negative_prompt) : '';

      // v3.3 - quando view_type === 'back', adiciona STRICT_BACK_NEGATIVE
      const parts = [];
      if (cleanedFrontendNegative) parts.push(cleanedFrontendNegative);
      if (isBack) parts.push(STRICT_BACK_NEGATIVE);
      parts.push(ANATOMY_GUARD_NEGATIVE);
      finalNegative = parts.join(', ');
    } else if (negative_prompt) {
      finalNegative = sanitizeNegativePrompt(negative_prompt);
    }

    console.log(`[image v3.3] endpoint=${endpoint}, view=${view_type}, hasImages=${hasImages}, imgs=${image_urls?.length||0}, profile=${profile_name||'-'}, bodyDesc=${!!body_description}, facePrompt=${!!face_prompt}, productDesc=${!!product_description}, smoothBackHint=${smoothBackHint}, negLen=${finalNegative?.length||0}, promptLen=${finalPrompt?.length||0}`);

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
      console.error(`[image v3.3] fal.ai submit error ${submitRes.status}:`, errText);
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

    console.log(`[image v3.3] Queued: ${requestId}`);

    let attempts = 0;
    const maxAttempts = 60;
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      });
      if (!statusRes.ok) {
        console.error(`[image v3.3] Status check error ${statusRes.status}`);
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
        console.error(`[image v3.3] Generation failed:`, status);
        return res.status(500).json({ error: 'Image generation failed', details: status });
      }
    }

    return res.status(408).json({ error: 'Timeout waiting for image', requestId });
  } catch (error) {
    console.error('[image v3.3] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
