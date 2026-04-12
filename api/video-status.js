export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

  const requestId = req.query.requestId;
  const endpoint = req.query.endpoint;

  if (!requestId || !endpoint) {
    return res.status(400).json({ error: 'requestId and endpoint are required' });
  }

  try {
    const url = `https://queue.fal.run/${endpoint}/requests/${requestId}/status`;
    console.log('Checking status:', url);

    const statusRes = await fetch(url, {
      headers: { 'Authorization': `Key ${FAL_KEY}` }
    });

    const statusText = await statusRes.text();
    console.log('Status response:', statusRes.status, statusText.substring(0, 300));

    if (!statusRes.ok) {
      return res.status(statusRes.status).json({ error: statusText.substring(0, 500) });
    }

    let status;
    try { status = JSON.parse(statusText); } catch {
      return res.status(500).json({ error: 'Invalid status JSON', raw: statusText.substring(0, 300) });
    }

    if (status.status === 'COMPLETED') {
      const resultUrl = `https://queue.fal.run/${endpoint}/requests/${requestId}`;
      const resultRes = await fetch(resultUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` }
      });
      const resultText = await resultRes.text();
      try {
        const result = JSON.parse(resultText);
        return res.status(200).json({ status: 'COMPLETED', result });
      } catch {
        return res.status(500).json({ error: 'Invalid result JSON', raw: resultText.substring(0, 300) });
      }
    }

    return res.status(200).json({ status: status.status || 'IN_PROGRESS' });
  } catch (error) {
    console.error('Status check error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
