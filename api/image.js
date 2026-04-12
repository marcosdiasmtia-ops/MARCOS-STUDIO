// fal.ai Nano Banana image generation proxy
// Routes to /edit (with reference images) or text-to-image (without)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

  try {
    const { prompt, image_urls, aspect_ratio = '9:16' } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    // Choose endpoint: /edit requires image_urls, text-to-image does not
    const hasImages = Array.isArray(image_urls) && image_urls.length > 0;
    const endpoint = hasImages ? 'fal-ai/nano-banana/edit' : 'fal-ai/nano-banana';

    console.log(`[image] Using endpoint: ${endpoint}, hasImages: ${hasImages}`);

    // Build request body
    const body = {
      prompt,
      aspect_ratio,
      output_format: 'png',
      num_images: 1
    };
    if (hasImages) {
      body.image_urls = image_urls;
    }

    // Submit to queue
    const submitRes = await fetch(`https://queue.fal.run/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${FAL_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      console.error(`[image] fal.ai submit error ${submitRes.status}:`, errText);
      return res.status(submitRes.status).json({ error: `fal.ai error: ${submitRes.status}`, details: errText });
    }

    const submitData = await submitRes.json();

    if (submitData.images) {
      // Sync mode - result immediately
      return res.status(200).json(submitData);
    }

    const requestId = submitData.request_id;
    if (!requestId) return res.status(500).json({ error: 'No request_id', data: submitData });

    // Use URLs from submit response (correct paths without subpath)
    const statusUrl = submitData.status_url || `https://queue.fal.run/fal-ai/nano-banana/requests/${requestId}/status`;
    const responseUrl = submitData.response_url || `https://queue.fal.run/fal-ai/nano-banana/requests/${requestId}`;

    console.log(`[image] Queued: ${requestId}`);
    console.log(`[image] Status URL: ${statusUrl}`);

    // Poll for result
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` }
      });
      if (!statusRes.ok) {
        console.error(`[image] Status check error ${statusRes.status}`);
        continue;
      }
      const status = await statusRes.json();

      if (status.status === 'COMPLETED') {
        const resultRes = await fetch(responseUrl, {
          headers: { 'Authorization': `Key ${FAL_KEY}` }
        });
        const result = await resultRes.json();
        return res.status(200).json(result);
      }

      if (status.status === 'FAILED') {
        console.error(`[image] Generation failed:`, status);
        return res.status(500).json({ error: 'Image generation failed', details: status });
      }
    }

    return res.status(408).json({ error: 'Timeout waiting for image', requestId });
  } catch (error) {
    console.error('Image API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
