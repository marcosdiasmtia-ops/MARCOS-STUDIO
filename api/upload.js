// Convert base64 to data URI for fal.ai
// fal.ai accepts data URIs directly in image_url/image_urls fields
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { base64, mimeType } = req.body;

    if (!base64) return res.status(400).json({ error: 'base64 is required' });

    // Return data URI — fal.ai handles decoding automatically
    const dataUri = `data:${mimeType || 'image/png'};base64,${base64}`;
    return res.status(200).json({ url: dataUri });
  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
