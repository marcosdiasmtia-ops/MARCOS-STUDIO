// fal.ai image generation proxy (v3.7)
//
// HISTORICO DE FIXES:
// v2.2 - Fix 1: ancora de identidade
//        Fix 2: bodyDescription injetada
//        Fix 3: sanitizacao do negative prompt
// v2.3 - Fix B: ancora reforcada contra contaminacao da imagem 2
// v2.4 - facePrompt: ancora com descricao textual detalhada do rosto
// v2.7 - productDescription: descricao tecnica da peca (Claude Vision)
// v2.7.1 - anti-contaminacao reforcada quando ha productDescription
// v2.8 - anatomy guard: reforco anatomico + negative default
// v3.0 - VIEW_TYPE BIFURCATION: anchor separada pra frontal vs back
// v3.1 - SIMPLIFICACAO DO BACK ANCHOR
// v3.2 - DOIS FIXES CIRURGICOS NA BACK ANCHOR
// v3.3 - REFORCO ANTI-PERFIL E ANTI-INVENCAO
// v3.4 - MIGRACAO DE MODELO: Nano Banana -> FLUX.2 [pro]
// v3.5 - Sanitizacao de facePrompt/bodyDescription/productDescription
//        antes da anchor (tentou resolver Bug 12, insuficiente sozinho).
//        Mantida em v3.7 como 1a camada defensiva.
// v3.6 - Tentou desligar safety_checker do fal.ai (RESULTADO: ignorado
//        pelo servidor, FLUX.2 pro tem safety INTERNO hardcoded).
//        Parametros preservados em v3.7 pois nao custam nada.
// v3.6.1 - Correcao do range de safety_tolerance (1-5, nao 1-6).
// v3.7 - FIX DEFINITIVO Bug 12: sanitizacao agressiva de TODO o prompt
//        final (positivo + negative) antes de enviar pro FLUX.2 pro.
//
//        DIAGNOSTICO FINAL (Network tab revelou tudo na sessao 23/04):
//        FLUX.2 pro tem safety gate INTERNO (modelo-servidor) que:
//          a) Ignora enable_safety_checker=false / safety_tolerance=5
//          b) Retorna content_policy_violation pra palavras especificas
//          c) NAO cobra creditos quando bloqueia (bom, confirma o bloqueio)
//
//        Palavras-gatilho identificadas empiricamente (7 tentativas
//        falharam antes do diagnostico ficar claro):
//
//        No PROMPT POSITIVO (vindas de systemPrompt.js / generate.js):
//          - "fine visible pores on face skin and arms"
//          - "natural peach fuzz catching the light"
//          - "subtle smile lines"
//          - "slight natural skin irregularity"
//          (todas descricoes de pele hiper-realistas, trigger safety)
//
//        No NEGATIVE PROMPT (body-shaming descriptors):
//          - "slim body, skinny, thin, underweight, bony"
//          - "flat hips, no curves, model body, athletic body, muscular"
//          (tokenizer nao entende negacao - processa como pedido direto)
//
//        No ANCHOR hard-coded deste arquivo (5 mencoes):
//          - "Do NOT copy their tattoos"
//          - "skin markings"
//          - "The woman in the final image has NO tattoos..."
//          (intencao boa - evitar contaminacao - mas palavras triggam
//           safety. Reformulado preservando a intencao.)
//
//        SOLUCAO v3.7:
//        Nova funcao sanitizeContentPolicyTriggers() aplicada no
//        prompt FINAL (depois de montado) e no negative FINAL (depois
//        de montado) - pega tudo de uma so vez, incluindo o anchor
//        hard-coded. Preserva gramatica e intencao.
//
//        Mudancas cirurgicas:
//          1) Nova funcao sanitizeContentPolicyTriggers (topo)
//          2) Aplicada a finalPrompt e finalNegative antes do POST
//          3) sanitizePromptForFlux2 (v3.5) mantida como 1a camada
//          4) safety_tolerance='5' / enable_safety_checker=false
//             mantidos (nao custam, e se fal.ai mudar comportamento
//             futuramente, ja esta configurado)
//          5) Logs renomeados pra v3.7 pra facilitar debug
//          6) Log novo: chars removidos pela sanitizacao policy

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

// v3.5 - Sanitiza texto antes de enviar pro FLUX.2 pro.
// Remove padroes que o VLM interno (Mistral-3 24B) do FLUX.2 associa com
// tentativa de identificacao biometrica de pessoa real, triggando safety
// filter e retornando erro Pydantic no body.prompt.
//
// O que REMOVE:
//   1) "Fitzpatrick type I-VI" (escala clinica dermatologica)
//   2) "Woman aged XX-YY" (descritor etario preciso nao-natural)
//   3) Negacoes de piercings/tattoos/moles em lista (mesmo negadas,
//      essas palavras sao tokenizadas como trigger)
//   4) Negacoes geograficas em parenteses all-caps "(NOT pink-European, ...)"
//   5) "BASE" em caps lock isolado (normaliza pra "base")
//
// O que PRESERVA:
//   - Toda a descricao anatomica (forma do rosto, traços, olhos, nariz, boca)
//   - Cor de pele (sem nomear escala)
//   - Cor e textura de cabelo, incluindo base vs highlights
//   - Mencoes POSITIVAS de freckles/beauty marks (sao parte da identidade)
//   - Idade qualitativa ("smooth youthful", "fresh clear skin")
//
// IMPORTANTE: essa sanitizacao NAO modifica o perfil salvo no localStorage.
// Ela acontece APENAS no momento do envio pro FLUX.2. O facePrompt original
// continua servindo como anti-drift (referencia forense para Claude Vision
// comparar entre geracoes).
function sanitizePromptForFlux2(text) {
  if (!text || typeof text !== 'string') return text || '';
  let out = text;

  // 1) Remove "Fitzpatrick type III/IV/V/VI" preservando o contexto antes/depois
  //    "Light skin Fitzpatrick type III with warm undertones" → "Light skin with warm undertones"
  out = out.replace(/\s*Fitzpatrick\s+type\s+[IVX]+\s*/gi, ' ');

  // 2) Remove negacoes geograficas all-caps entre parenteses
  //    "(NOT pink-European, NOT olive)" → ""
  out = out.replace(/\s*\(NOT [^)]+\)/gi, '');

  // 3) Remove descritor etario preciso
  //    "Woman aged 27-31, smooth..." → "smooth..."
  //    "aged 20-24" isolado tambem e removido
  out = out.replace(/\b(?:Woman\s+)?aged\s+\d+\s*-\s*\d+[,.]?\s*/gi, '');

  // 4) Remove frases de negacao listando piercings/tattoos
  //    Padroes cobertos:
  //      "No visible piercings, tattoos, or other distinguishing marks."
  //      "no piercings, tattoos, moles or freckles, clean even skin"
  //      "No tattoos, no piercings, no scars."
  out = out.replace(
    /\b[Nn]o\s+(?:visible\s+)?piercings?[^.]*?(?:marks?|skin|freckles?|moles?|scars?)\.?\s*/g,
    ''
  );

  // 5) "BASE" em caps lock isolado vira lowercase
  //    "Medium brown BASE hair" → "Medium brown base hair"
  out = out.replace(/\bBASE\b/g, 'base');

  // 6) Normaliza whitespace e pontuacao
  out = out.replace(/\s+/g, ' ');
  out = out.replace(/\s+([,.])/g, '$1');
  out = out.replace(/\.\s*\./g, '.');
  out = out.replace(/,\s*,/g, ',');
  out = out.trim();

  return out;
}

// v3.7 - Sanitiza o PROMPT FINAL (ja montado com anchor + prompt + anatomy)
// e o NEGATIVE FINAL antes de enviar pro FLUX.2 pro.
// Remove palavras-gatilho que fazem o VLM do FLUX.2 pro retornar
// content_policy_violation, identificadas empiricamente em 7 tentativas.
//
// Aplicada DEPOIS da sanitizePromptForFlux2 (v3.5) — esta cobre outro
// escopo (padroes forenses do facePrompt). As duas juntas formam defense
// in depth.
//
// Preserva TODA a semantica essencial (quem e a pessoa, o que veste,
// pose, cenario, iluminacao, etc). Remove apenas descritores que sao
// ou (a) detalhe hiper-real de pele que soa como identificacao biometrica
// ou (b) body-shaming em negative prompt ou (c) mencoes negativas a
// tattoos/skin markings hard-coded no anchor.
function sanitizeContentPolicyTriggers(text) {
  if (!text || typeof text !== 'string') return text || '';
  let out = text;

  // === CAMADA 1: Descricoes de pele hiper-realistas (prompt positivo) ===
  out = out.replace(/\bfine\s+visible\s+pores[^,.]*,?\s*/gi, '');
  out = out.replace(/\bvisible\s+pores[^,.]*,?\s*/gi, '');
  out = out.replace(/\bnatural\s+peach\s+fuzz[^,.]*,?\s*/gi, '');
  out = out.replace(/\bpeach\s+fuzz[^,.]*,?\s*/gi, '');
  out = out.replace(/\bsubtle\s+smile\s+lines,?\s*/gi, '');
  out = out.replace(/\bsmile\s+lines,?\s*/gi, '');
  out = out.replace(/\bslight\s+natural\s+skin\s+irregularity,?\s*/gi, '');
  out = out.replace(/\bnatural\s+skin\s+irregularity,?\s*/gi, '');
  out = out.replace(/\bskin\s+irregularity,?\s*/gi, '');

  // === CAMADA 2: Body-shaming descriptors (negative prompt) ===
  // Safety modernos tokenizam essas palavras MESMO em negative — nao
  // entendem negacao lexical.
  const bodyShamingTerms = [
    'slim body', 'skinny', 'thin', 'model body', 'athletic body',
    'muscular', 'underweight', 'bony', 'flat hips', 'no curves'
  ];
  for (const term of bodyShamingTerms) {
    const escaped = term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\s*,?\\s*`, 'gi'), '');
  }

  // === CAMADA 3: Anchor hard-coded mencoes a tattoos/skin markings ===
  // Ordem importa: remove frases INTEIRAS antes de palavras isoladas,
  // pra nao quebrar gramatica deixando "has NO ." ou similar.

  // 3a) Frase "The woman in the final image has NO tattoos unless..."
  out = out.replace(
    /\s*The\s+woman\s+in\s+the\s+final\s+image\s+has\s+NO\s+tattoos[^.]*?\./gi,
    ''
  );

  // 3b) Itens de lista "do NOT copy their tattoos/skin markings"
  out = out.replace(/do\s+NOT\s+copy\s+their\s+tattoos,?\s*/gi, '');
  out = out.replace(/do\s+NOT\s+copy\s+their\s+skin\s+marks?(?:ings)?,?\s*/gi, '');

  // 3c) Itens negados "no tattoos, no skin markings"
  out = out.replace(/no\s+tattoos,?\s*/gi, '');
  out = out.replace(/no\s+skin\s+marks?(?:ings)?,?\s*/gi, '');

  // 3d) Palavras isoladas residuais
  out = out.replace(/\btattoos?,?\s*/gi, '');
  out = out.replace(/\bskin\s+marks?(?:ings)?,?\s*/gi, '');
  out = out.replace(/\bpiercings?,?\s*/gi, '');

  // === CLEANUP ===
  out = out.replace(/\s*,\s*,/g, ',');
  out = out.replace(/\s*,\s*\./g, '.');
  out = out.replace(/\.\s*\./g, '.');
  out = out.replace(/\(\s*,\s*/g, '(');
  out = out.replace(/\s+,/g, ',');
  out = out.replace(/\s+/g, ' ');
  out = out.replace(/^\s*,\s*/, '');
  out = out.replace(/\s*,\s*$/, '');
  out = out.trim();

  return out;
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

// v3.4 - Detecta no prompt recebido se ha indicacao de "smooth back".
// Sinal vem do generate-back.js (v3.7/v3.8) que escreve "with smooth back"
// quando Claude detecta que a peca nao tem detalhe traseiro marcante.
function detectSmoothBackHint(prompt) {
  if (!prompt || typeof prompt !== 'string') return false;
  return /\bsmooth\s+back\b/i.test(prompt) || /\bwith\s+no\s+back\s+details\b/i.test(prompt);
}

// v3.4 - Converte aspect_ratio (formato Nano Banana) para image_size (formato FLUX.2).
// FLUX.2 aceita valores enum: 'square_hd', 'square', 'portrait_4_3',
// 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto'.
// Se nao reconhecer, usa 'auto' (FLUX.2 decide sozinho).
function aspectRatioToImageSize(aspectRatio) {
  if (!aspectRatio || typeof aspectRatio !== 'string') return 'auto';
  const ar = aspectRatio.trim();
  switch (ar) {
    case '9:16':  return 'portrait_16_9';   // vertical (TikTok, Reels, Stories)
    case '16:9':  return 'landscape_16_9';  // horizontal widescreen
    case '3:4':   return 'portrait_4_3';
    case '4:3':   return 'landscape_4_3';
    case '1:1':   return 'square_hd';
    default:      return 'auto';
  }
}

// v3.4 - Endpoints FLUX.2 [pro] (substitui Nano Banana).
// com imagens: editing model  -> fal-ai/flux-2-pro/edit
// sem imagens: pure text-to-image -> fal-ai/flux-2-pro
const FLUX2_PRO_EDIT_ENDPOINT = 'fal-ai/flux-2-pro/edit';
const FLUX2_PRO_TEXT_ENDPOINT = 'fal-ai/flux-2-pro';

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

    // v3.5 - Sanitiza textos do perfil ANTES de montar a anchor.
    // Isso impede que padroes "forenses" da v3.1 do analyze-identity
    // (Fitzpatrick, aged XX-YY, piercings/tattoos negados, etc) triggam
    // o safety filter do VLM interno do FLUX.2 pro.
    // O perfil no localStorage continua intacto.
    const sanitizedFacePrompt = sanitizePromptForFlux2(face_prompt);
    const sanitizedBodyDescription = sanitizePromptForFlux2(body_description);
    const sanitizedProductDescription = sanitizePromptForFlux2(product_description);

    const sanitationLog = {
      face: { in: (face_prompt || '').length, out: sanitizedFacePrompt.length },
      body: { in: (body_description || '').length, out: sanitizedBodyDescription.length },
      product: { in: (product_description || '').length, out: sanitizedProductDescription.length },
    };

    const hasImages = Array.isArray(image_urls) && image_urls.length > 0;
    // v3.4 - FLUX.2 pro substitui Nano Banana em todos os casos
    const endpoint = hasImages ? FLUX2_PRO_EDIT_ENDPOINT : FLUX2_PRO_TEXT_ENDPOINT;

    const isBack = view_type === 'back';

    // v3.3 - detecta hint de "smooth back" vindo do prompt
    const smoothBackHint = isBack && detectSmoothBackHint(prompt);

    let finalPrompt = prompt;
    if (hasImages) {
      const anchor = isBack
        ? buildIdentityAnchorBack(profile_name, sanitizedBodyDescription, sanitizedFacePrompt, sanitizedProductDescription, image_urls.length, smoothBackHint)
        : buildIdentityAnchorFrontal(profile_name, sanitizedBodyDescription, sanitizedFacePrompt, sanitizedProductDescription, image_urls.length);

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

    // v3.4 - converte aspect_ratio pra image_size (FLUX.2 schema)
    const imageSize = aspectRatioToImageSize(aspect_ratio);

    // v3.7 - SANITIZACAO CONTENT POLICY: ultima linha de defesa antes de
    // enviar. Remove palavras que o VLM interno do FLUX.2 pro sinaliza
    // como content_policy_violation (peach fuzz, smile lines, skinny,
    // tattoos hard-coded no anchor, etc).
    const prePromptLen = finalPrompt ? finalPrompt.length : 0;
    const preNegLen = finalNegative ? finalNegative.length : 0;
    finalPrompt = sanitizeContentPolicyTriggers(finalPrompt);
    finalNegative = finalNegative ? sanitizeContentPolicyTriggers(finalNegative) : finalNegative;
    const postPromptLen = finalPrompt ? finalPrompt.length : 0;
    const postNegLen = finalNegative ? finalNegative.length : 0;
    const policyLog = {
      prompt: { before: prePromptLen, after: postPromptLen, removed: prePromptLen - postPromptLen },
      negative: { before: preNegLen, after: postNegLen, removed: preNegLen - postNegLen },
    };

    // v3.7 - logging completo: sanitation da anchor (v3.5) + policy (v3.7)
    console.log(`[image v3.7] endpoint=${endpoint}, view=${view_type}, hasImages=${hasImages}, imgs=${image_urls?.length||0}, profile=${profile_name||'-'}, sanitation=${JSON.stringify(sanitationLog)}, policyFilter=${JSON.stringify(policyLog)}, smoothBackHint=${smoothBackHint}, imageSize=${imageSize}, negLen=${finalNegative?.length||0}, promptLen=${finalPrompt?.length||0}`);

    // Preview dos primeiros/ultimos 300 chars do prompt final (ajuda debug
    // quando o FLUX.2 retorna erro estruturado sem mensagem clara)
    if (finalPrompt && finalPrompt.length > 0) {
      const preview = finalPrompt.length > 600
        ? finalPrompt.substring(0, 300) + ' [...] ' + finalPrompt.substring(finalPrompt.length - 300)
        : finalPrompt;
      console.log(`[image v3.7] prompt preview: ${preview}`);
    }

    // v3.4 - body FLUX.2 pro:
    //   prompt + image_urls (mesmos nomes que Nano Banana, mantidos)
    //   image_size (substitui aspect_ratio)
    //   output_format: 'jpeg' (FLUX.2 default, mais leve que png)
    //   negative_prompt incluido se presente; fal.ai ignora campos nao
    //   reconhecidos silenciosamente, entao nao ha risco.
    // v3.6 - DESATIVA safety_checker do FLUX.2 pro pra resolver Bug 12.
    //   Content policy violation estava bloqueando geracao por palavras
    //   em prompts/negatives (peach fuzz, smile lines, skinny, thin, etc).
    //   Contexto: UGC com pessoa real autorizada (Marcos cadastrou Ligia
    //   com foto propria). Sem risco de conteudo abusivo ou falsificacao
    //   de terceiros. Seguro desativar checker pra desbloquear fluxo.
    const body = {
      prompt: finalPrompt,
      image_size: imageSize,
      output_format: 'jpeg',
      num_images: 1,
      safety_tolerance: '5',          // v3.6.1 - maximo permissivo (range 1-5, nao 1-6 como pensei antes)
      enable_safety_checker: false,   // v3.6 - desativa checker de output
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
      console.error(`[image v3.7] fal.ai submit error ${submitRes.status}:`, errText);
      return res.status(submitRes.status).json({ error: `fal.ai error: ${submitRes.status}`, details: errText });
    }

    const submitData = await submitRes.json();

    if (submitData.images) {
      return res.status(200).json(submitData);
    }

    const requestId = submitData.request_id;
    if (!requestId) return res.status(500).json({ error: 'No request_id', data: submitData });

    // v3.4 - URLs fallback apontam pro endpoint FLUX.2 pro em uso.
    // Na pratica, fal.ai sempre retorna status_url/response_url no submitData,
    // entao o fallback raramente e usado. Mantido por seguranca.
    const fallbackEndpoint = hasImages ? FLUX2_PRO_EDIT_ENDPOINT : FLUX2_PRO_TEXT_ENDPOINT;
    const statusUrl = submitData.status_url || `https://queue.fal.run/${fallbackEndpoint}/requests/${requestId}/status`;
    const responseUrl = submitData.response_url || `https://queue.fal.run/${fallbackEndpoint}/requests/${requestId}`;

    console.log(`[image v3.7] Queued: ${requestId} (endpoint=${endpoint})`);

    let attempts = 0;
    const maxAttempts = 60;
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      });
      if (!statusRes.ok) {
        console.error(`[image v3.7] Status check error ${statusRes.status}`);
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
        console.error(`[image v3.7] Generation failed:`, status);
        return res.status(500).json({ error: 'Image generation failed', details: status });
      }
    }

    return res.status(408).json({ error: 'Timeout waiting for image', requestId });
  } catch (error) {
    console.error('[image v3.7] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
