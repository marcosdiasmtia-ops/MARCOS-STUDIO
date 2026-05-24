// fal.ai video generation proxy — supports Kling 3.0, Veo 3, Grok Imagine
//
// CHANGELOG vFix2 (Etapa 2 — religa a referência do PRODUTO no Kling v3):
//   Mantém tudo da vFix1 (start_image_url, audio off, negative anti-fala) e
//   adiciona o uso correto da referência de produto/costas:
//   🐛 CAUSA (parte 2): o campo antigo 'element_reference_image_url' não existe
//      no Kling v3 → a foto do produto era descartada. Além disso, mesmo no
//      formato novo, o fal IGNORA o elemento se o prompt não citar @Element1.
//   ✅ FIX:
//      3. element_image_url agora entra no array oficial:
//         input.elements = [{ frontal_image_url: element_image_url }]
//      4. Se o prompt não citar @Element1, o código injeta automaticamente uma
//         instrução amarrando a roupa/produto ao @Element1 (senão o fal ignora).
//
// CHANGELOG vFix1 (Etapa 1):
//      1. image_url → start_image_url (v3 i2v só lê start_image_url)
//      2. generate_audio: false por padrão + negative anti-fala
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

// Instrução injetada no prompt quando há produto de referência mas o prompt
// não cita @Element1 (sem isso o fal ignora o elemento).
const ELEMENT_CLAUSE = ' Keep the clothing/product identical to @Element1, ' +
  'preserving its exact design, color, pattern, print and details, including ' +
  'the back of the garment when the person turns around.';

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

      // Monta o prompt e a referência de produto (Etapa 2).
      let finalPrompt = prompt || '';
      const elements = [];
      if (element_image_url) {
        elements.push({ frontal_image_url: element_image_url });
        // Garante que o prompt cite @Element1, senão o fal ignora o elemento.
        if (!/@Element1/i.test(finalPrompt)) {
          finalPrompt = (finalPrompt + ELEMENT_CLAUSE).trim();
        }
      }

      input = {
        prompt: finalPrompt,
        start_image_url: image_url,        // vFix1: era image_url (ignorado pelo v3)
        negative_prompt: neg,
        duration: String(duration || '5'),
        aspect_ratio: aspect_ratio || '9:16',
        cfg_scale: 0.5,
        // vFix1: silêncio por padrão. Só gera áudio se vier generate_audio === true.
        generate_audio: generate_audio === true,
      };
      // vFix2: referência do produto no formato oficial do v3.
      if (elements.length > 0) {
        input.elements = elements;
      }
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

    console.log(`[video] Submitting to ${endpoint}${input.elements ? ' (com @Element1)' : ''}`);

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
