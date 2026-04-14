// API helper functions for all backend calls

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

export async function generateImage(prompt, imageUrls) {
  const res = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_urls: imageUrls, aspect_ratio: '9:16' })
  });
  // Handle non-JSON error responses (Vercel returns HTML on crashes)
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

export async function generateBackPrompt({ frontalImageUrl, frontalPrompt, visual, camadas }) {
  const res = await fetch('/api/generate-back', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frontalImageUrl, frontalPrompt, visual, camadas })
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
  return data; // { positivo, negativo }
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
  return data; // { requestId, endpoint } or { video }
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

// Profile storage
const PROFILES_KEY = 'ligia-ugc-profiles';

const LIGIA_PROFILE = {
  id: 'ligia',
  name: 'Lígia',
  isLigia: true,
  bodyDescription: 'Curvy natural Brazilian body, defined waist, full rounded hips, smooth flat belly, medium feminine shoulders, natural voluminous figure, NOT athletic NOT muscular NOT slim NOT model NOT thin',
  photo: null, // Ligia uses the v8.2 identity
  createdAt: '2024-01-01'
};

export function getProfiles() {
  try {
    const stored = localStorage.getItem(PROFILES_KEY);
    const profiles = stored ? JSON.parse(stored) : [];
    // Always include Ligia first
    if (!profiles.find(p => p.id === 'ligia')) {
      profiles.unshift(LIGIA_PROFILE);
    }
    return profiles;
  } catch {
    return [LIGIA_PROFILE];
  }
}

export function saveProfile(profile) {
  const profiles = getProfiles();
  const idx = profiles.findIndex(p => p.id === profile.id);
  if (idx >= 0) {
    profiles[idx] = profile;
  } else {
    profiles.push({ ...profile, id: Date.now().toString(), createdAt: new Date().toISOString() });
  }
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  return profiles;
}

export function deleteProfile(id) {
  if (id === 'ligia') return getProfiles(); // Can't delete Ligia
  const profiles = getProfiles().filter(p => p.id !== id);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  return profiles;
}
