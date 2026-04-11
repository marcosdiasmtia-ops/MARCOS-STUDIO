// fal.ai Nano Banana image generation proxy
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

    // Submit to queue
    const submitRes = await fetch('https://queue.fal.run/fal-ai/nano-banana/edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${FAL_KEY}`
      },
      body: JSON.stringify({
        prompt,
        image_urls,
        aspect_ratio,
        output_format: 'png',
        num_images: 1
      })
    });

    const submitData = await submitRes.json();

    if (submitData.images) {
      // Sync mode - result immediately
      return res.status(200).json(submitData);
    }

    const requestId = submitData.request_id;
    if (!requestId) return res.status(500).json({ error: 'No request_id', data: submitData });

    // Poll for result
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(`https://queue.fal.run/fal-ai/nano-banana/edit/requests/${requestId}/status`, {
        headers: { 'Authorization': `Key ${FAL_KEY}` }
      });
      const status = await statusRes.json();

      if (status.status === 'COMPLETED') {
        const resultRes = await fetch(`https://queue.fal.run/fal-ai/nano-banana/edit/requests/${requestId}`, {
          headers: { 'Authorization': `Key ${FAL_KEY}` }
        });
        const result = await resultRes.json();
        return res.status(200).json(result);
      }

      if (status.status === 'FAILED') {
        return res.status(500).json({ error: 'Image generation failed', details: status });
      }
    }

    return res.status(408).json({ error: 'Timeout waiting for image', requestId });
  } catch (error) {
    console.error('Image API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
