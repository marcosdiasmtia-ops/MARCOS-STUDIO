// fal.ai video generation proxy — supports Kling 3.0, Veo 3, Grok Imagine
//
// CHANGELOG vFix5 (CORREÇÃO DO CONTRATO DE CAMPOS — v3/standard):
//   🔧 Engine alvo do VTON volta a ser 'kling' = v3/standard/image-to-video.
//      Esse endpoint tem o schema 100% confirmado na doc do fal e aceita
//      EXATAMENTE a arquitetura do Marcos: start_image_url (frontal) +
//      elements:[{frontal_image_url}] (costas, @Element1) + multi_prompt + 3-15s.
//      (O o3/standard/image-to-video usava 'image_url' e NÃO tinha 'elements' —
//       por isso o vFix4 mandava frontal e costas que eram IGNORADAS pelo fal.)
//   🔧 clampDuration: v3/standard NÃO é mais cortado em 5/10. Toda a família
//      Kling v3/o3 aceita 3 a 15s (premissa antiga estava errada).
//   🔧 shot_type:'customize' agora é enviado SEMPRE que houver multi_prompt —
//      é OBRIGATÓRIO no schema quando multi_prompt é usado (faltava antes).
//
// CHANGELOG vFix4 (15 SEGUNDOS + ELEMENTOS — arquitetura do Marcos):
//   ✅ Imagem de COSTAS entra como ELEMENTO: elements: [{ frontal_image_url }]
//      citado no prompt como @Element1 (formato oficial do Kling v3).
//   ✅ @Element1 injetado automaticamente no prompt se não estiver lá.
//   ✅ Suporte a multi_prompt (multi-shot): INÍCIO/MEIO/CTA viram cenas.
//   Mantém da vFix1: start_image_url, generate_audio off por padrão, anti-fala.
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

// Cláusula que amarra a roupa/costas ao elemento (injetada se faltar @Element1).
const ELEMENT_CLAUSE = ' Keep the outfit identical to @Element1, matching the ' +
  'exact back view of the garment — same design, color, pattern and details — ' +
  'when the person turns around.';

// Ajusta a duração ao que cada família de endpoint aceita.
// vFix5: toda a família Kling v3/o3 (standard, pro, 4k) aceita 3 a 15s.
// (A regra antiga "v3/standard só 5/10" estava errada e cortava os 15s.)
function clampDuration(endpoint, duration) {
  let n = parseInt(duration, 10);
  if (isNaN(n)) return '5';
  if (n < 3) return '3';
  if (n > 15) return '15';
  return String(n);
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
    const { engine, prompt, image_url, negative_prompt, duration, aspect_ratio,
            element_image_url, generate_audio, multi_prompt } = req.body;

    const endpoint = ENDPOINTS[engine];
    if (!endpoint) return res.status(400).json({ error: `Unknown engine: ${engine}. Options: ${Object.keys(ENDPOINTS).join(', ')}` });

    // Build input based on engine
    let input = { prompt };

    if (engine.startsWith('kling')) {
      const neg = [negative_prompt, KLING_NO_TALK].filter(Boolean).join(', ');

      // Elemento = imagem de costas (formato oficial do v3).
      const elements = [];
      if (element_image_url) {
        elements.push({ frontal_image_url: element_image_url });
      }

      input = {
        start_image_url: image_url,        // frontal = frame inicial
        negative_prompt: neg,
        duration: clampDuration(endpoint, duration),
        aspect_ratio: aspect_ratio || '9:16',
        cfg_scale: 0.5,
        generate_audio: generate_audio === true,
      };

      if (Array.isArray(multi_prompt) && multi_prompt.length > 0) {
        // Multi-shot (até 15s). Garante @Element1 em alguma cena se houver elemento.
        let shots = multi_prompt;
        if (elements.length > 0) {
          const hasRef = shots.some(s => /@Element1/i.test(s?.prompt || ''));
          if (!hasRef) {
            shots = shots.map((s, i) =>
              i === shots.length - 1
                ? { ...s, prompt: ((s.prompt || '') + ELEMENT_CLAUSE).trim() }
                : s
            );
          }
        }
        input.multi_prompt = shots;
        // vFix5: shot_type é OBRIGATÓRIO no schema quando multi_prompt é usado.
        input.shot_type = 'customize';
      } else {
        // Prompt único. Injeta @Element1 se necessário.
        let finalPrompt = prompt || '';
        if (elements.length > 0 && !/@Element1/i.test(finalPrompt)) {
          finalPrompt = (finalPrompt + ELEMENT_CLAUSE).trim();
        }
        input.prompt = finalPrompt;
      }

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

    console.log(`[video] Submitting to ${endpoint} | dur=${input.duration || 'n/a'} | elements=${input.elements ? input.elements.length : 0} | multiShot=${input.multi_prompt ? input.multi_prompt.length : 0} | shot_type=${input.shot_type || 'n/a'}`);

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
