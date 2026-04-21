// API helper functions for all backend calls (v3.0 — dual-photo analyzeIdentity + facePrompt pipeline)

export async function callClaude(system, userMessage) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages: [{ role: 'user', content: userMessage }], max_tokens: 4096 })
  });
  const data = await res.json();
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  const text = data.content?.map(i => i.text || '').join('') || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

export async function generateContent(params) {
  const res = await fetch('/api/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  const text = data.content?.map(i => i.text || '').join('') || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

export async function searchTrends(categoria, tipoProduto) {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoria, tipo_produto: tipoProduto })
  });
  const data = await res.json();
  return data.trends || '';
}

export async function uploadToFal(base64, mimeType, fileName) {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mimeType, fileName })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.url;
}

// v3.0: analisa 1 OU 2 fotos da influencer via Claude Vision e devolve
// { facePrompt, bodyDescription } pra preencher o formulário automaticamente.
//
// ASSINATURA v3.0 (nova — recomendada):
//   analyzeIdentity({ faceBase64, faceMimeType, bodyBase64?, bodyMimeType? })
//     → faceBase64 (obrigatória): foto do rosto pra facePrompt
//     → bodyBase64 (opcional): foto de corpo inteiro pra bodyDescription
//
// ASSINATURA v2.4 (legada — ainda funciona):
//   analyzeIdentity(base64, mimeType)
//     → analisa ambos na mesma foto (fallback)
//
// Isso mantém retrocompat: código antigo que chama com 2 argumentos continua funcionando.
export async function analyzeIdentity(arg1, arg2) {
  // Detecta se é chamada v3.0 (objeto) ou v2.4 (2 argumentos)
  let payload;
  if (typeof arg1 === 'object' && arg1 !== null && !(arg1 instanceof Blob)) {
    // v3.0: { faceBase64, faceMimeType, bodyBase64, bodyMimeType }
    payload = {
      faceBase64: arg1.faceBase64,
      faceMimeType: arg1.faceMimeType || 'image/jpeg',
      bodyBase64: arg1.bodyBase64 || null,
      bodyMimeType: arg1.bodyMimeType || 'image/jpeg',
    };
  } else {
    // v2.4 legado: (base64, mimeType) → manda como faceBase64
    payload = {
      faceBase64: arg1,
      faceMimeType: arg2 || 'image/jpeg',
    };
  }

  const res = await fetch('/api/analyze-identity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('analyze-identity response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Erro ao analisar foto (${res.status}). Verifique os logs no Vercel.`);
  }
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return {
    facePrompt: data.facePrompt || '',
    bodyDescription: data.bodyDescription || ''
  };
}

// v2.7: analisa foto de peca de roupa e retorna descricao tecnica do corte/design
export async function analyzeProduct(base64, mimeType, view = 'frontal') {
  const res = await fetch('/api/analyze-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mimeType, view })
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('analyze-product response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Erro ao analisar produto (${res.status}).`);
  }
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return data.productDescription || '';
}

// v2.4: agora recebe também facePrompt junto com profileName/bodyDescription
// v2.7: agora recebe também productDescription (analise tecnica da peca)
// v3.0: agora recebe também viewType ('frontal' | 'back') — bifurca anchor no backend
export async function generateImage(prompt, imageUrls, extras = {}) {
  const res = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_urls: imageUrls,
      aspect_ratio: '9:16',
      profile_name: extras.profileName || null,
      body_description: extras.bodyDescription || null,
      face_prompt: extras.facePrompt || null,
      product_description: extras.productDescription || null,  // v2.7
      view_type: extras.viewType || 'frontal',                  // v3.0
    })
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('Server response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Servidor retornou erro ${res.status}. Verifique os logs no Vercel → Deployments → Function Logs`);
  }
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  if (!res.ok) throw new Error(`Erro ${res.status}: ${JSON.stringify(data)}`);
  return data.images?.[0]?.url || null;
}

// v3.3 — agora aceita backProductImageBase64 + backProductImageMimeType
// (foto de costas do produto) pra Claude olhar a peça e descrever o design
// traseiro no prompt. Campos são opcionais: se não vierem, generate-back
// cai no fallback (comportamento idêntico ao v3.1).
export async function generateBackPrompt({
  frontalImageUrl,
  frontalPrompt,
  visual,
  camadas,
  backProductImageBase64,
  backProductImageMimeType,
}) {
  const res = await fetch('/api/generate-back', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      frontalImageUrl,
      frontalPrompt,
      visual,
      camadas,
      backProductImageBase64,
      backProductImageMimeType,
    })
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('Back prompt response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Erro ao gerar prompt de costas. Verifique os logs no Vercel.`);
  }
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  return data;
}

export async function generateVideo(params) {
  const res = await fetch('/api/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('Video API response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Servidor retornou erro ${res.status}. Verifique os logs no Vercel.`);
  }
  if (data.error) throw new Error(data.error);
  return data;
}

export async function checkVideoStatus(requestId, endpoint, statusUrl, responseUrl) {
  const params = new URLSearchParams({ requestId });
  if (endpoint) params.set('endpoint', endpoint);
  if (statusUrl) params.set('statusUrl', statusUrl);
  if (responseUrl) params.set('responseUrl', responseUrl);
  const res = await fetch(`/api/video-status?${params.toString()}`);
  const data = await res.json();
  return data;
}

// File to base64
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve({ base64, mimeType: file.type, preview: reader.result });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ══════════ Profile storage (v2.4 — inclui facePrompt) ══════════
// O perfil agora tem: { id, name, photo, bodyDescription, facePrompt, createdAt }
const PROFILES_KEY = 'ligia-ugc-profiles';

export function getProfiles() {
  try {
    const stored = localStorage.getItem(PROFILES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveProfile(profile) {
  const profiles = getProfiles();
  const idx = profiles.findIndex(p => p.id === profile.id);
  if (idx >= 0) {
    profiles[idx] = { ...profiles[idx], ...profile };
  } else {
    profiles.push({ ...profile, id: Date.now().toString(), createdAt: new Date().toISOString() });
  }
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  return profiles;
}

export function deleteProfile(id) {
  const profiles = getProfiles().filter(p => p.id !== id);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  return profiles;
}
