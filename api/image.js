// fal.ai image generation proxy (v3.8)
//
// ═══════════════════════════════════════════════════════════════════════
// REESCRITA ARQUITETURAL — MULTI-INFLUENCER, LINGUAGEM NATURAL
// ═══════════════════════════════════════════════════════════════════════
//
// HISTORICO RESUMIDO:
// v2.x - v3.3: fase Nano Banana com anchor defensivo pesado (5+ mencoes
//               a "tattoos", negacoes all-caps, "CRITICAL IDENTITY RULE",
//               etc). Estrategia defensiva que FUNCIONAVA no Nano Banana.
// v3.4: migracao pra FLUX.2 [pro] mantendo anchor pesado herdado.
//       Apareceu Bug 12 (content_policy_violation em todas as geracoes).
// v3.5: sanitizacao do facePrompt (tentou resolver Bug 12, insuficiente).
// v3.6: desativar safety_checker (fal.ai ignora esses parametros no
//       FLUX.2 pro — safety gate esta DENTRO do modelo, server-side).
// v3.6.1: fix de range numerico (nao resolveu Bug 12, filter persiste).
// v3.7: sanitizacao agressiva de prompt+negative+anchor (nao resolveu).
//
// v3.8: DIAGNOSTICO DEFINITIVO + REESCRITA ARQUITETURAL
//
// DESCOBERTA (sessao 23/04/2026):
// FLUX.2 [pro] e um modelo "zero config" (documentacao oficial fal.ai):
//   - Ignora enable_safety_checker, safety_tolerance, negative_prompt
//   - Safety gate esta NO PROPRIO MODELO (VLM Mistral-3 interno)
//   - Foi desenhado pra linguagem NATURAL com sintaxe "image 1/2/3"
//   - Rejeita descricoes hiper-detalhadas (Fitzpatrick, aged XX-YY,
//     "fine visible pores", "peach fuzz") e muitas negacoes (do NOT x5)
//     por confundir com tentativa de identificacao biometrica
//
// TESTE DE ISOLAMENTO (playground fal.ai, 4 geracoes confirmadas):
//   - Foto real da Ligia + prompt simples = funciona ✅
//   - Foto + prompt hiper-detalhado = content_policy_violation ❌
//   - Foto + prompt "image 1 wearing image 2" = funciona ✅
//   - Foto + prompt rear view simples = funciona ✅ (bugs 7,8 resolvidos)
//
// CONCLUSAO: anchor anterior (600+ chars com "tattoos" x5, negacoes,
// "CRITICAL IDENTITY RULE:") era incompativel com FLUX.2. O modelo ja
// preserva identidade SOZINHO a partir da foto (image 1) - nao precisa
// de facePrompt/bodyDescription injetado no prompt.
//
// ═══════════════════════════════════════════════════════════════════════
// MUDANCAS v3.8
// ═══════════════════════════════════════════════════════════════════════
//
// REESCRITO:
//   - buildIdentityAnchorFrontal: 1-2 frases naturais, sintaxe "image 1/2"
//   - buildIdentityAnchorBack: idem, com reforco positivo de rear view
//
// MANTIDO (rede de seguranca defensiva):
//   - sanitizePromptForFlux2 (v3.5) - limpa facePrompt/bodyDescription SE
//     ainda forem passados (retrocompat, embora nao sejam mais injetados)
//   - sanitizeContentPolicyTriggers (v3.7) - limpa prompt final
//   - ANATOMY_GUARD_POSITIVE - melhora maos/pes
//   - detectSmoothBackHint - detecta "smooth back" no prompt
//   - aspectRatioToImageSize - conversao de formato
//   - Polling, CORS, error handling, retrocompat 100%
//
// REMOVIDO (codigo morto/gatilho):
//   - LIGIA_SPECIFIC_NEGATIVES (Bug 13 - era hardcoded de quando so tinha
//     Ligia, quebrava multi-influencer)
//   - sanitizeNegativePrompt (chamava LIGIA_SPECIFIC_NEGATIVES)
//   - STRICT_BACK_NEGATIVE (ia pro negative_prompt que FLUX.2 ignora)
//   - ANATOMY_GUARD_NEGATIVE (idem)
//   - safety_tolerance: '5' (FLUX.2 ignora)
//   - enable_safety_checker: false (FLUX.2 ignora)
//   - negative_prompt inteiro no body pro FLUX.2 (nao e suportado nativo)
//   - Injecao de face_prompt/body_description no anchor (contraproducente
//     no FLUX.2 - ele ja le identidade da imagem 1 sozinho)
//
// NAO IMPACTADO:
//   - Frontend (src/api.js e App.jsx continuam chamando com mesma assinatura)
//   - Perfis salvos em localStorage (facePrompt/bodyDescription preservados
//     pra uso futuro se quisermos voltar a injeta-los)
//   - generate-back.js (continua gerando o prompt como antes)
//
// RESULTADO ESPERADO:
//   - Zero content_policy_violation
//   - Funciona pra QUALQUER influencer cadastrada (multi-ethnic, multi-body)
//   - Bugs historicos 6, 7, 8 (costas) resolvidos pelo proprio FLUX.2 pro
//   - Bug 9 (tatuagem contamina) persiste - responsabilidade do usuario
//     escolher foto de produto limpa
// ═══════════════════════════════════════════════════════════════════════

const ANATOMY_GUARD_POSITIVE =
  'Natural foot positioning with both feet pointing forward in anatomically correct angles. ' +
  'Heels properly positioned with toes visible and aligned naturally. ' +
  'Hands with exactly 5 fingers each, correctly proportioned, no extra or missing digits. ' +
  'Anatomically accurate limbs, natural joint angles, proper body proportions throughout';

// v3.8 - Detecta "smooth back" no prompt (hint vindo do generate-back.js
// quando Claude analisa e ve que o produto nao tem detalhe traseiro).
// Usado pro anchor reforcar "keep back smooth" quando aplicavel.
function detectSmoothBackHint(prompt) {
  if (!prompt || typeof prompt !== 'string') return false;
  return /\bsmooth\s+back\b/i.test(prompt) || /\bwith\s+no\s+back\s+details\b/i.test(prompt);
}

// v3.5 - Sanitiza texto antes de enviar pro FLUX.2 pro.
// MANTIDA em v3.8 como rede defensiva caso face_prompt/body_description
// ainda sejam passados pelo frontend (retrocompat). Na v3.8 esses campos
// NAO sao mais injetados no anchor, mas a funcao permanece por seguranca.
function sanitizePromptForFlux2(text) {
  if (!text || typeof text !== 'string') return text || '';
  let out = text;
  out = out.replace(/\s*Fitzpatrick\s+type\s+[IVX]+\s*/gi, ' ');
  out = out.replace(/\s*\(NOT [^)]+\)/gi, '');
  out = out.replace(/\b(?:Woman\s+)?aged\s+\d+\s*-\s*\d+[,.]?\s*/gi, '');
  out = out.replace(
    /\b[Nn]o\s+(?:visible\s+)?piercings?[^.]*?(?:marks?|skin|freckles?|moles?|scars?)\.?\s*/g,
    ''
  );
  out = out.replace(/\bBASE\b/g, 'base');
  out = out.replace(/\s+/g, ' ');
  out = out.replace(/\s+([,.])/g, '$1');
  out = out.replace(/\.\s*\./g, '.');
  out = out.replace(/,\s*,/g, ',');
  out = out.trim();
  return out;
}

// v3.7 - Sanitiza PROMPT FINAL antes de enviar pro FLUX.2 pro.
// MANTIDA em v3.8 como 2a rede defensiva. Remove palavras que o VLM
// Mistral-3 interno do FLUX.2 sinaliza como content_policy_violation.
// Com os anchors reescritos da v3.8, o volume de remoção aqui deve ser
// zero ou proximo disso — mas a rede continua no lugar caso alguma
// palavra nova chegue via systemPrompt.js / generate.js.
function sanitizeContentPolicyTriggers(text) {
  if (!text || typeof text !== 'string') return text || '';
  let out = text;

  // Camada 1: descricoes de pele hiper-realistas
  out = out.replace(/\bfine\s+visible\s+pores[^,.]*,?\s*/gi, '');
  out = out.replace(/\bvisible\s+pores[^,.]*,?\s*/gi, '');
  out = out.replace(/\bnatural\s+peach\s+fuzz[^,.]*,?\s*/gi, '');
  out = out.replace(/\bpeach\s+fuzz[^,.]*,?\s*/gi, '');
  out = out.replace(/\bsubtle\s+smile\s+lines,?\s*/gi, '');
  out = out.replace(/\bsmile\s+lines,?\s*/gi, '');
  out = out.replace(/\bslight\s+natural\s+skin\s+irregularity,?\s*/gi, '');
  out = out.replace(/\bnatural\s+skin\s+irregularity,?\s*/gi, '');
  out = out.replace(/\bskin\s+irregularity,?\s*/gi, '');

  // Camada 2: body-shaming no negative (embora negative nem seja enviado
  // na v3.8, mantida pra caso o prompt positivo contenha essas palavras)
  const bodyShamingTerms = [
    'slim body', 'skinny', 'thin', 'model body', 'athletic body',
    'muscular', 'underweight', 'bony', 'flat hips', 'no curves'
  ];
  for (const term of bodyShamingTerms) {
    const escaped = term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\s*,?\\s*`, 'gi'), '');
  }

  // Camada 3: mencoes a tattoos/skin markings (legado dos anchors v3.x,
  // nao deveria aparecer mais na v3.8 mas rede defensiva fica)
  out = out.replace(
    /\s*The\s+woman\s+in\s+the\s+final\s+image\s+has\s+NO\s+tattoos[^.]*?\./gi,
    ''
  );
  out = out.replace(/do\s+NOT\s+copy\s+their\s+tattoos,?\s*/gi, '');
  out = out.replace(/do\s+NOT\s+copy\s+their\s+skin\s+marks?(?:ings)?,?\s*/gi, '');
  out = out.replace(/no\s+tattoos,?\s*/gi, '');
  out = out.replace(/no\s+skin\s+marks?(?:ings)?,?\s*/gi, '');
  out = out.replace(/\btattoos?,?\s*/gi, '');
  out = out.replace(/\bskin\s+marks?(?:ings)?,?\s*/gi, '');
  out = out.replace(/\bpiercings?,?\s*/gi, '');

  // Cleanup
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

// ═══════════════════════════════════════════════════════════════════════
// ANCHOR FRONTAL v3.8 — linguagem natural, multi-influencer
// ═══════════════════════════════════════════════════════════════════════
//
// Assinatura preservada pra retrocompat com handler existente.
// Parametros profileName, bodyDescription, facePrompt sao IGNORADOS na
// v3.8 — FLUX.2 pro le identidade direto da imagem 1 sozinho.
// productDescription continua sendo usado pra enriquecer descricao da peca.
//
// Principios:
//   1. Sintaxe "image 1 / image 2" nativa do FLUX.2
//   2. Reforco POSITIVO ("Preserve the exact appearance") em vez de
//      negativo ("do NOT copy"). Positivo nao ativa safety.
//   3. Delimitar uso da imagem 2 ("only for the clothing design")
//   4. Nenhuma descricao biometrica/forense
function buildIdentityAnchorFrontal(profileName, bodyDescription, facePrompt, productDescription, numRefImages) {
  if (numRefImages >= 2) {
    // Caso mais comum: pessoa (img 1) + peca (img 2)
    let anchor =
      `The person from image 1 wearing the outfit from image 2. ` +
      `Preserve the exact appearance of the person shown in image 1 including her face, skin, hair, and natural features. ` +
      `Use image 2 only for the clothing design, color, and cut. `;

    if (productDescription && productDescription.trim()) {
      anchor += `Garment details: ${productDescription.trim()}. `;
    }
    return anchor;
  }

  if (numRefImages === 1) {
    // Fallback: so pessoa, sem peca separada
    return `The person from image 1. Preserve the exact appearance of the person shown in image 1 including her face, skin, hair, and natural features. `;
  }

  // Sem imagens: puro texto (caso raro, text-to-image)
  return '';
}

// ═══════════════════════════════════════════════════════════════════════
// ANCHOR BACK v3.8 — rear view reforcado, multi-influencer
// ═══════════════════════════════════════════════════════════════════════
//
// Estrutura similar ao frontal, com:
//   - Prefixo "Rear view" explicito
//   - Reforco "camera sees the back" em linguagem natural
//   - Se 3 imagens: usa imagem 3 como referencia de design traseiro
//   - smoothBackHint ainda disponivel pra peca lisa
//
// Validado no playground com 2 testes bem-sucedidos (sem content_policy,
// 100% rear view, identidade preservada).
function buildIdentityAnchorBack(profileName, bodyDescription, facePrompt, productDescription, numRefImages, smoothBackHint) {
  if (numRefImages >= 3) {
    // Caso ideal: pessoa (img 1) + peca frente (img 2) + peca costas (img 3)
    let anchor =
      `Rear view of the person from image 1 wearing the outfit shown in image 2 and image 3. ` +
      `Image 2 shows the front of the outfit, image 3 shows the back design - reproduce the back design exactly as shown in image 3. ` +
      `The camera sees the back of her head and her back. ` +
      `Preserve the exact appearance of the person from image 1 including her hair, skin, and natural features. `;

    if (smoothBackHint) {
      anchor += `The back of the garment is smooth - keep it smooth and continuous without adding invented details. `;
    }

    if (productDescription && productDescription.trim()) {
      anchor += `Garment details: ${productDescription.trim()}. `;
    }
    return anchor;
  }

  if (numRefImages === 2) {
    // Caso degradado: pessoa (img 1) + peca frente (img 2), sem costas
    let anchor =
      `Rear view of the person from image 1 wearing the outfit from image 2. ` +
      `The camera sees the back of her head and her back. ` +
      `Preserve the exact appearance of the person from image 1 including her hair, skin, and natural features. ` +
      `If the back of the garment is smooth, keep it smooth without adding invented details. `;

    if (smoothBackHint) {
      anchor += `The back of the garment is smooth and continuous. `;
    }

    if (productDescription && productDescription.trim()) {
      anchor += `Garment details: ${productDescription.trim()}. `;
    }
    return anchor;
  }

  if (numRefImages === 1) {
    return `Rear view of the person from image 1. The camera sees the back of her head and her back. Preserve the exact appearance of the person from image 1. `;
  }

  return '';
}

// Conversao aspect_ratio -> image_size (schema FLUX.2 pro)
function aspectRatioToImageSize(aspectRatio) {
  if (!aspectRatio || typeof aspectRatio !== 'string') return 'auto';
  const ar = aspectRatio.trim();
  switch (ar) {
    case '9:16':  return 'portrait_16_9';
    case '16:9':  return 'landscape_16_9';
    case '3:4':   return 'portrait_4_3';
    case '4:3':   return 'landscape_4_3';
    case '1:1':   return 'square_hd';
    default:      return 'auto';
  }
}

// Endpoints FLUX.2 [pro]
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
      // negative_prompt e IGNORADO na v3.8 - FLUX.2 pro nao suporta
    } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    // v3.8 - face_prompt / body_description NAO sao mais injetados no
    // anchor. Mas ainda passam pela sanitizePromptForFlux2 pra log
    // (mostrar que foram recebidos e ignorados). productDescription
    // continua sendo usado no anchor.
    const sanitizedFacePrompt = sanitizePromptForFlux2(face_prompt);
    const sanitizedBodyDescription = sanitizePromptForFlux2(body_description);
    const sanitizedProductDescription = sanitizePromptForFlux2(product_description);

    const hasImages = Array.isArray(image_urls) && image_urls.length > 0;
    const endpoint = hasImages ? FLUX2_PRO_EDIT_ENDPOINT : FLUX2_PRO_TEXT_ENDPOINT;

    const isBack = view_type === 'back';
    const smoothBackHint = isBack && detectSmoothBackHint(prompt);

    // Monta prompt final = anchor + prompt + anatomy_guard
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

    // v3.8 - Sanitizacao final do prompt (rede defensiva v3.7)
    const prePromptLen = finalPrompt ? finalPrompt.length : 0;
    finalPrompt = sanitizeContentPolicyTriggers(finalPrompt);
    const postPromptLen = finalPrompt ? finalPrompt.length : 0;

    const imageSize = aspectRatioToImageSize(aspect_ratio);

    // Logging v3.8 - mais enxuto
    console.log(
      `[image v3.8] endpoint=${endpoint}, view=${view_type}, hasImages=${hasImages}, ` +
      `imgs=${image_urls?.length||0}, profile=${profile_name||'-'}, ` +
      `policyFilter={before:${prePromptLen},after:${postPromptLen},removed:${prePromptLen-postPromptLen}}, ` +
      `smoothBackHint=${smoothBackHint}, imageSize=${imageSize}, promptLen=${finalPrompt?.length||0}`
    );

    // Preview dos primeiros/ultimos 300 chars (debug)
    if (finalPrompt && finalPrompt.length > 0) {
      const preview = finalPrompt.length > 600
        ? finalPrompt.substring(0, 300) + ' [...] ' + finalPrompt.substring(finalPrompt.length - 300)
        : finalPrompt;
      console.log(`[image v3.8] prompt preview: ${preview}`);
    }

    // v3.8 - Body MINIMO pro FLUX.2 pro.
    // SEM safety_tolerance, SEM enable_safety_checker, SEM negative_prompt
    // (todos ignorados pelo modelo - remove-los reduz poluicao).
    const body = {
      prompt: finalPrompt,
      image_size: imageSize,
      output_format: 'jpeg',
      num_images: 1,
    };
    if (hasImages) body.image_urls = image_urls;

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
      console.error(`[image v3.8] fal.ai submit error ${submitRes.status}:`, errText);
      return res.status(submitRes.status).json({
        error: `fal.ai error: ${submitRes.status}`,
        details: errText
      });
    }

    const submitData = await submitRes.json();

    // Caso 1: fal.ai retornou imagem sincrona (raro)
    if (submitData.images) {
      return res.status(200).json(submitData);
    }

    // Caso 2: enfileirou, precisa fazer polling
    const requestId = submitData.request_id;
    if (!requestId) return res.status(500).json({ error: 'No request_id', data: submitData });

    const fallbackEndpoint = hasImages ? FLUX2_PRO_EDIT_ENDPOINT : FLUX2_PRO_TEXT_ENDPOINT;
    const statusUrl = submitData.status_url || `https://queue.fal.run/${fallbackEndpoint}/requests/${requestId}/status`;
    const responseUrl = submitData.response_url || `https://queue.fal.run/${fallbackEndpoint}/requests/${requestId}`;

    console.log(`[image v3.8] Queued: ${requestId} (endpoint=${endpoint})`);

    let attempts = 0;
    const maxAttempts = 60;
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      });
      if (!statusRes.ok) {
        console.error(`[image v3.8] Status check error ${statusRes.status}`);
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
        console.error(`[image v3.8] Generation failed:`, status);
        return res.status(500).json({ error: 'Image generation failed', details: status });
      }
    }

    return res.status(408).json({ error: 'Timeout waiting for image', requestId });
  } catch (error) {
    console.error('[image v3.8] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
