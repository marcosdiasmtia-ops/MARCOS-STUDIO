// Upload image to fal.ai storage and return URL
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

  try {
    const { base64, mimeType, fileName } = req.body;

    // Convert base64 to binary
    const binaryData = Buffer.from(base64, 'base64');

    // Upload to fal.ai storage
    const uploadRes = await fetch('https://fal.run/fal-ai/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': mimeType || 'image/png',
        'X-Fal-File-Name': fileName || 'image.png'
      },
      body: binaryData
    });

    // fal.ai returns the URL directly or as JSON
    const contentType = uploadRes.headers.get('content-type');
    let result;
    if (contentType?.includes('application/json')) {
      result = await uploadRes.json();
    } else {
      const url = await uploadRes.text();
      result = { url: url.trim() };
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
