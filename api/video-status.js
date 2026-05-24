// Poll video generation status using fal.ai provided URLs
//
// CHANGELOG vFix-status1:
//   🐛 CAUSA do "timeout falso": o Vercel estava CACHEANDO as respostas deste
//      endpoint (todas voltavam 304 Not Modified). Resultado: o app recebia
//      sempre a resposta velha ("em progresso") e NUNCA enxergava o COMPLETED,
//      mesmo quando o Kling já tinha terminado o vídeo → estourava os 450s.
//   ✅ FIX: headers Cache-Control: no-store (+ variações de CDN do Vercel) pra
//      forçar resposta fresca em CADA polling. Agora o app vê o vídeo pronto.
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
      console.error(`[video-status] Status check error ${statusRes.status}`);
      return res.status(200).json({ status: 'IN_QUEUE', error: `Status check returned ${statusRes.status}` });
    }

    const status = await statusRes.json();

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(finalResponseUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` }
      });
      const result = await resultRes.json();
      return res.status(200).json({ status: 'COMPLETED', result });
    }

    return res.status(200).json({ status: status.status || 'IN_QUEUE', logs: status.logs || [] });
  } catch (error) {
    console.error('[video-status] Error:', error);
    return res.status(200).json({ status: 'IN_QUEUE', error: error.message });
  }
}
