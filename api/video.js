// fal.ai video generation proxy — supports Kling 3.0, Veo 3, Grok Imagine
//https://github.com/marcosdiasmtia-ops/MARCOS-STUDIO/blob/main/api/video.js
// CHANGELOG vFix1 (Etapa 1 — correção do bug de migração do Kling v3):
//   🐛 CAUSA: o trecho 'kling' usava parâmetros da versão ANTIGA do Kling.
//      O endpoint já é v3, mas o body mandava os nomes velhos, então o fal
//      IGNORAVA a imagem e o áudio saía sem pedir. Resultado: vídeo "todo errado"
//      (cria coisa do nada, não foca no produto, e "quer falar").
//   ✅ FIX:
//      1. image_url  → start_image_url   (Kling v3 i2v só lê start_image_url;
//         com o nome certo, a imagem da influencer volta a ser o frame inicial)
//      2. generate_audio: false fixo (a não ser que venha true explícito) +
//         negative_prompt anti-fala → mata o "quer falar"/lip-sync indesejado
//   ⏭️ ETAPA 2 (separada): religar a referência do produto/costas via
//      input.elements = [{ frontal_image_url, reference_image_urls }] + @Element1
//      no prompt. NÃO incluída aqui de propósito (mexe também no prompt e
//      merece teste isolado). O campo antigo 'element_reference_image_url' foi
//      removido por ser inválido no v3 (era ignorado de qualquer forma).
const ENDPOINTS = {
  'kling': 'fal-ai/kling-video/v3/standard/image-to-video',
  'kling-pro': 'fal-ai/kling-video/v3/pro/image-to-video',
  'kling-o3': 'fal-ai/kling-video/o3/standard/image-to-video',
  'veo3': 'fal-ai/veo3/image-to-video',
  'veo3-fast': 'fal-ai/veo3/fast/image-to-video',
  'veo31': 'fal-ai/veo3.1/image-to-video',
  'grok': 'xai/grok-imagine-video/image-to-video',
  'grok-text': 'xai/grok-imagine-video/text-to-video',
};

// Termos anti-fala/anti-artefato adicionados ao negative_prompt do Kling.
const KLING_NO_TALK = 'talking, speaking, mouth moving, lip sync, lip-sync, ' +
  'singing, subtitles, captions, text overlay, watermark, extra people, ' +
  'duplicate person, morphing, warping, distortion';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

  try {
    const { engine, prompt, image_url, negative_prompt, duration, aspect_ratio,
            element_image_url, generate_audio } = req.body;

    const endpoint = ENDPOINTS[engine];
    if (!endpoint) return res.status(400).json({ error: `Unknown engine: ${engine}. Options: ${Object.keys(ENDPOINTS).join(', ')}` });

    // Build input based on engine
    let input = { prompt };

    if (engine.startsWith('kling')) {
      // Junta o negative_prompt do cliente (se houver) com os termos anti-fala.
      const neg = [negative_prompt, KLING_NO_TALK].filter(Boolean).join(', ');

      input = {
        prompt,
        start_image_url: image_url,        // FIX: era image_url (ignorado pelo v3)
        negative_prompt: neg,
        duration: String(duration || '5'),
        aspect_ratio: aspect_ratio || '9:16',
        cfg_scale: 0.5,
        // FIX: silêncio por padrão. Só gera áudio se vier generate_audio === true.
        generate_audio: generate_audio === true,
      };
      // NOTA Etapa 2: a referência do produto (element_image_url) entrará aqui
      // como input.elements = [{ frontal_image_url: element_image_url }] e o
      // prompt precisará citar @Element1. Mantido fora nesta etapa de propósito.
    } else if (engine.startsWith('veo')) {
      input = {
        prompt,
        image_url,
        aspect_ratio: aspect_ratio || '9:16',
      };
      if (generate_audio !== undefined) {
        input.generate_audio = generate_audio;
      }
    } else if (engine.startsWith('grok')) {
      input = { prompt };
      if (image_url) input.image_url = image_url;
      if (aspect_ratio) input.aspect_ratio = aspect_ratio;
    }

    console.log(`[video] Submitting to ${endpoint}`);

    // Submit to queue
    const submitRes = await fetch(`https://queue.fal.run/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${FAL_KEY}`
      },
      body: JSON.stringify(input)
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      console.error(`[video] Submit error ${submitRes.status}:`, errText);
      return res.status(submitRes.status).json({ error: `fal.ai error: ${submitRes.status}`, details: errText });
    }

    const submitData = await submitRes.json();
    const requestId = submitData.request_id;

    if (!requestId) {
      // Might be sync result
      if (submitData.video) return res.status(200).json(submitData);
      return res.status(500).json({ error: 'No request_id', data: submitData });
    }

    console.log(`[video] Queued: ${requestId}`);

    // Return request_id + URLs from fal.ai response for client-side polling
    return res.status(202).json({
      requestId,
      endpoint,
      statusUrl: submitData.status_url || `https://queue.fal.run/${endpoint}/requests/${requestId}/status`,
      responseUrl: submitData.response_url || `https://queue.fal.run/${endpoint}/requests/${requestId}`,
    });
  } catch (error) {
    console.error('Video API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
