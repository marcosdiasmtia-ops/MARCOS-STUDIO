// Poll video generation status
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

  const { requestId, endpoint } = req.query;
  if (!requestId || !endpoint) return res.status(400).json({ error: 'requestId and endpoint required' });

  try {
    const statusRes = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}/status`, {
      headers: { 'Authorization': `Key ${FAL_KEY}` }
    });
    const status = await statusRes.json();

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}`, {
        headers: { 'Authorization': `Key ${FAL_KEY}` }
      });
      const result = await resultRes.json();
      return res.status(200).json({ status: 'COMPLETED', result });
    }

    return res.status(200).json({ status: status.status, logs: status.logs || [] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
