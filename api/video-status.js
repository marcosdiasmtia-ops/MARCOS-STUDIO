// Poll video generation status using fal.ai provided URLs
//
// CHANGELOG vFix-status2 (raio-X de diagnóstico):
//   Mantém o no-store da vFix-status1 (matou o 304/cache).
//   ➕ Agora LOGA o status real do fal em cada polling, pra sabermos se o job
//      está IN_QUEUE (preso na fila — limite de 1 job/usuário), IN_PROGRESS
//      (gerando devagar) ou ERROR/FAILED. Isso aparece na coluna "Mensagens"
//      do log do Vercel e tira a dúvida de uma vez.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // vFix-status1: nunca cachear o status (cada polling precisa ser fresco).
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

  const { requestId, endpoint, statusUrl, responseUrl } = req.query;
  if (!requestId) return res.status(400).json({ error: 'requestId required' });

  // Use provided URLs (correct) or construct fallback
  const finalStatusUrl = statusUrl || `https://queue.fal.run/${endpoint}/requests/${requestId}/status`;
  const finalResponseUrl = responseUrl || `https://queue.fal.run/${endpoint}/requests/${requestId}`;

  try {
    const statusRes = await fetch(finalStatusUrl, {
      headers: { 'Authorization': `Key ${FAL_KEY}` }
    });

    if (!statusRes.ok) {
      const errBody = await statusRes.text();
      // vFix-status2: loga o erro real do fal (status HTTP + corpo).
      console.error(`[video-status] ${requestId} HTTP ${statusRes.status}: ${errBody.slice(0, 300)}`);
      return res.status(200).json({ status: 'IN_QUEUE', error: `Status check returned ${statusRes.status}` });
    }

    const status = await statusRes.json();

    // vFix-status2: raio-X — loga o status real do fal em cada polling.
    console.log(`[video-status] ${requestId} → status=${status.status || 'UNKNOWN'} | queue_position=${status.queue_position ?? 'n/a'}`);

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(finalResponseUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` }
      });
      const result = await resultRes.json();
      console.log(`[video-status] ${requestId} → COMPLETED, video=${result?.video?.url ? 'OK' : 'SEM URL'}`);
      return res.status(200).json({ status: 'COMPLETED', result });
    }

    return res.status(200).json({ status: status.status || 'IN_QUEUE', logs: status.logs || [] });
  } catch (error) {
    console.error(`[video-status] ${requestId} Error:`, error.message);
    return res.status(200).json({ status: 'IN_QUEUE', error: error.message });
  }
}
