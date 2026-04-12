export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

  const requestId = req.query.requestId || req.body?.requestId;
  const endpoint = req.query.endpoint || req.body?.endpoint;

  if (!requestId || !endpoint) {
    return res.status(400).json({ error: 'requestId and endpoint required', query: req.query });
  }

  try {
    const statusRes = await fetch(
      `https://queue.fal.run/${endpoint}/requests/${requestId}/status`,
      { headers: { 'Authorization': `Key ${FAL_KEY}` } }
    );
    const statusText = await statusRes.text();
    if (!statusRes.ok) return res.status(200).json({ status: 'IN_PROGRESS' });

    let status;
    try { status = JSON.parse(statusText); } catch {
      return res.status(200).json({ status: 'IN_PROGRESS' });
    }

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/${endpoint}/requests/${requestId}`,
        { headers: { 'Authorization': `Key ${FAL_KEY}` } }
      );
      const resultText = await resultRes.text();
      try {
        const result = JSON.parse(resultText);
        return res.status(200).json({ status: 'COMPLETED', result });
      } catch {
        return res.status(200).json({ status: 'IN_PROGRESS' });
      }
    }

    if (status.status === 'FAILED') {
      return res.status(200).json({ status: 'FAILED', error: 'Generation failed' });
    }

    return res.status(200).json({ status: status.status || 'IN_PROGRESS' });
  } catch (error) {
    return res.status(200).json({ status: 'IN_PROGRESS', error: error.message });
  }
}
