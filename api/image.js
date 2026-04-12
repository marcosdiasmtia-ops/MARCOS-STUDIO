    
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
    const input = { prompt, aspect_ratio, output_format: 'png', num_images: 1 };
    if (image_urls && image_urls.length > 0) input.image_urls = image_urls;
    const submitRes = await fetch('https://queue.fal.run/fal-ai/nano-banana/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${FAL_KEY}` },
      body: JSON.stringify(input)
    });
    const responseText = await submitRes.text();
    if (!submitRes.ok) return res.status(submitRes.status).json({ error: responseText.substring(0, 500) });
    let data;
    try { data = JSON.parse(responseText); } catch { return res.status(500).json({ error: 'Invalid JSON from fal.ai', raw: responseText.substring(0, 300) }); }
    if (data.images) return res.status(200).json({ status: 'COMPLETED', result: data });
    return res.status(202).json({ status: 'IN_QUEUE', requestId: data.request_id, endpoint: 'fal-ai/nano-banana/edit' });
  } catch (error) {
    console.error('Image API Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}     
