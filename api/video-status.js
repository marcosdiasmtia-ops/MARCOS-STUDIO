// Poll video generation status using fal.ai provided URLs
//
// CHANGELOG vFix-status3 (EXTRAÇÃO ROBUSTA DA URL):
//   O job passou a CONCLUIR (vFix5 consertou os campos), mas vinha "SEM URL"
//   porque a URL do vídeo no response da fila não estava em result.video.url.
//   ➕ Agora a URL é procurada em TODOS os caminhos conhecidos do fal e
//      normalizada pra result.video.url (o front não precisa mudar).
//   ➕ Se mesmo assim não achar, loga o JSON cru do result (diagnóstico final).
//   Mantém: no-store (vFix-status1) + log do status real (vFix-status2).
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

      // vFix-status3: o caminho da URL do vídeo no response da fila varia por
      // endpoint/forma de resposta. O job CONCLUÍDO vinha com "SEM URL" porque
      // procurávamos só em result.video.url. Agora procuramos em TODOS os
      // caminhos conhecidos e NORMALIZAMOS pra result.video.url — que é o que o
      // front (VtonStudio) lê. Assim o front nem precisa mudar.
      const videoUrl =
        result?.video?.url ||
        result?.data?.video?.url ||
        result?.response?.video?.url ||
        result?.output?.video?.url ||
        (typeof result?.video === 'string' ? result.video : null) ||
        result?.videos?.[0]?.url ||
        result?.data?.videos?.[0]?.url ||
        result?.output?.[0]?.url ||
        null;

      if (videoUrl) {
        console.log(`[video-status] ${requestId} → COMPLETED, video=OK (${String(videoUrl).slice(0, 70)})`);
      } else {
        // Diagnóstico definitivo: loga o JSON cru pra revelarmos a forma real
        // caso a URL esteja em algum caminho ainda não mapeado.
        console.error(`[video-status] ${requestId} → COMPLETED mas SEM URL. Result cru: ${JSON.stringify(result).slice(0, 700)}`);
      }

      // Normaliza pra result.video.url (formato esperado pelo front).
      const normalized = videoUrl
        ? { ...result, video: { ...(result.video || {}), url: videoUrl } }
        : result;

      return res.status(200).json({ status: 'COMPLETED', result: normalized, videoUrl });
    }

    return res.status(200).json({ status: status.status || 'IN_QUEUE', logs: status.logs || [] });
  } catch (error) {
    console.error(`[video-status] ${requestId} Error:`, error.message);
    return res.status(200).json({ status: 'IN_QUEUE', error: error.message });
  }
}
