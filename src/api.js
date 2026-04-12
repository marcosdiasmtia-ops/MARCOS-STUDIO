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

// Poll fal.ai for result
async function pollForResult(requestId, endpoint, maxWait = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 3000));
    
    const res = await fetch(`/api/video-status?requestId=${requestId}&endpoint=${encodeURIComponent(endpoint)}`);
    const data = await res.json();
    
    if (data.status === 'COMPLETED') return data.result;
    if (data.status === 'FAILED') throw new Error('Generation failed');
    // IN_QUEUE or IN_PROGRESS — keep polling
  }
  throw new Error('Timeout — generation took too long');
}

export async function generateImage(prompt, imageUrls) {
  // Step 1: Submit to queue
  const res = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_urls: imageUrls, aspect_ratio: '9:16' })
  });
  const data = await res.json();
  
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));

  // If completed immediately
  if (data.status === 'COMPLETED' && data.result?.images?.[0]) {
    return data.result.images[0].url;
  }

  // If queued — poll for result
  if (data.status === 'IN_QUEUE' && data.requestId) {
    const result = await pollForResult(data.requestId, data.endpoint);
    return result?.images?.[0]?.url || null;
  }

  // Fallback — check if images are directly in response
  if (data.images?.[0]?.url) return data.images[0].url;

  throw new Error('Unexpected response from image API');
}

export async function generateVideo(params) {
  const res = await fetch('/api/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function checkVideoStatus(requestId, endpoint) {
  const res = await fetch(`/api/video-status?requestId=${requestId}&endpoint=${encodeURIComponent(endpoint)}`);
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
  photo: null,
  createdAt: '2024-01-01'
};

export function getProfiles() {
  try {
    const stored = localStorage.getItem(PROFILES_KEY);
    const profiles = stored ? JSON.parse(stored) : [];
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
  if (id === 'ligia') return getProfiles();
  const profiles = getProfiles().filter(p => p.id !== id);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  return profiles;
}
