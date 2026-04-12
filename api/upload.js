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
    if (!base64) return res.status(400).json({ error: 'base64 is required' });
    const binaryData = Buffer.from(base64, 'base64');
    const uploadRes = await fetch('https://rest.alpha.fal.ai/storage/upload', {
      method: 'PUT',
      headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': mimeType || 'image/png' },
      body: binaryData
    });
    if (uploadRes.ok) {
      const url = await uploadRes.text();
      return res.status(200).json({ url: url.trim().replace(/"/g, '') });
    }
    console.log('Upload fallback to data URI');
    const dataUri = `data:${mimeType || 'image/png'};base64,${base64}`;
    return res.status(200).json({ url: dataUri });
  } catch (error) {
    console.error('Upload Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}   
