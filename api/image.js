// fal.ai Nano Banana image generation proxy — FIXED v2
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

    const input = {
      prompt,
      aspect_ratio,
      output_format: 'png',
      num_images: 1
    };

    // Only add image_urls if provided and non-empty
    if (image_urls && image_urls.length > 0) {
      input.image_urls = image_urls;
    }

    console.log('Calling fal.ai with input:', JSON.stringify({ prompt: prompt.substring(0, 100) + '...', image_urls: image_urls?.length || 0 }));

    // Use the fal.ai REST API directly
    const submitRes = await fetch('https://queue.fal.run/fal-ai/nano-banana/edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${FAL_KEY}`
      },
      body: JSON.stringify(input)
    });

    // Get the raw response text first
    const responseText = await submitRes.text();
    console.log('fal.ai response status:', submitRes.status);
    console.log('fal.ai response (first 500 chars):', responseText.substring(0, 500));

    if (!submitRes.ok) {
      return res.status(submitRes.status).json({ 
        error: `fal.ai returned ${submitRes.status}`, 
        details: responseText.substring(0, 500) 
      });
    }

    // Try to parse JSON
    let submitData;
    try {
      submitData = JSON.parse(responseText);
    } catch (parseErr) {
      return res.status(500).json({ 
        error: 'Failed to parse fal.ai response', 
        details: responseText.substring(0, 500) 
      });
    }

    // Check if result came back immediately (sync mode)
    if (submitData.images && submitData.images.length > 0) {
      console.log('Got immediate result with', submitData.images.length, 'images');
      return res.status(200).json(submitData);
    }

    // Queue mode — need to poll
    const requestId = submitData.request_id;
    if (!requestId) {
      return res.status(500).json({ 
        error: 'No request_id and no images in response', 
        data: submitData 
      });
    }

    console.log('Queued with request_id:', requestId);

    // Poll for result (max 2 minutes)
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));

      const statusRes = await fetch(
        `https://queue.fal.run/fal-ai/nano-banana/edit/requests/${requestId}/status`,
        { headers: { 'Authorization': `Key ${FAL_KEY}` } }
      );

      const statusText = await statusRes.text();
      let status;
      try {
        status = JSON.parse(statusText);
      } catch {
        console.log('Status parse error:', statusText.substring(0, 200));
        continue;
      }

      console.log('Poll', i + 1, '- Status:', status.status);

      if (status.status === 'COMPLETED') {
        const resultRes = await fetch(
          `https://queue.fal.run/fal-ai/nano-banana/edit/requests/${requestId}`,
          { headers: { 'Authorization': `Key ${FAL_KEY}` } }
        );
        const resultText = await resultRes.text();
        try {
          const result = JSON.parse(resultText);
          return res.status(200).json(result);
        } catch {
          return res.status(500).json({ error: 'Failed to parse result', details: resultText.substring(0, 500) });
        }
      }

      if (status.status === 'FAILED') {
        return res.status(500).json({ error: 'Image generation failed', details: status });
      }
    }

    return res.status(408).json({ error: 'Timeout waiting for image generation', requestId });

  } catch (error) {
    console.error('Image API Error:', error.message, error.stack);
    return res.status(500).json({ error: error.message });
  }
}
