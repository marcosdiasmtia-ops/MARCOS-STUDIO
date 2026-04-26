// API helper functions for all backend calls (v4.0 — adds VTON helpers)
//
// CHANGELOG:
// v3.0 — dual-photo analyzeIdentity + facePrompt pipeline (legacy/FLUX.2 pro)
// v4.0 — adiciona 4 helpers VTON novos:
//   - analyzeFace          → /api/analyze-face
//   - analyzeProductVton   → /api/analyze-product-vton
//   - generateVtonPrompt   → /api/generate-vton-prompt
//   - generateVtonImage    → /api/generate-vton-image
//
// Adiciona também:
//   - getVtonProfiles, saveVtonProfile, deleteVtonProfile (storage separado
//     dos perfis legacy pra não interferir)
//
// MANTIDO INTACTO (v3.0):
//   - callClaude, generateContent, searchTrends, uploadToFal
//   - analyzeIdentity, analyzeProduct, generateImage, generateBackPrompt
//   - generateVideo, checkVideoStatus, fileToBase64
//   - getProfiles, saveProfile, deleteProfile (perfis legacy FLUX.2 pro)

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

// ══════════ Profile storage LEGACY (v2.4 — inclui facePrompt) ══════════
// O perfil legacy tem: { id, name, photo, bodyDescription, facePrompt, createdAt }
// Usado pela aba legacy FLUX.2 pro. NÃO MEXER.
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

// ═══════════════════════════════════════════════════════════════════════
// VTON HELPERS (v4.0 — aba VTON nova com Nano Banana Pro pipeline)
// ═══════════════════════════════════════════════════════════════════════

// Analisa close-up de rosto e retorna { hair, ageHint, vibe, signature }
// pra cadastro VTON mínimo.
export async function analyzeFace({ faceBase64, faceMimeType }) {
  const res = await fetch('/api/analyze-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      faceBase64,
      faceMimeType: faceMimeType || 'image/jpeg',
    })
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('analyze-face response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Erro ao analisar rosto (${res.status}). Verifique os logs no Vercel.`);
  }
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return data;  // { hair, ageHint, vibe, signature }
}

// Analisa frontal+costas do produto numa única chamada.
// Retorna { frontDescription, backDescription, hasBackInterest, backReason }
export async function analyzeProductVton({
  frontBase64,
  frontMimeType,
  backBase64,
  backMimeType,
  productName,
  productDescription,
}) {
  const res = await fetch('/api/analyze-product-vton', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      frontBase64,
      frontMimeType: frontMimeType || 'image/jpeg',
      backBase64,
      backMimeType: backMimeType || 'image/jpeg',
      productName,
      productDescription,
    })
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('analyze-product-vton response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Erro ao analisar produto VTON (${res.status}).`);
  }
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return data;  // { frontDescription, backDescription, hasBackInterest, backReason }
}

// Gera 3 roteiros UGC sugeridos via Claude + web_search dinâmico.
// Cada roteiro vem etiquetado com poseType e custo previsto.
export async function generateVtonPrompt({ influencer, product, preferredScene }) {
  const res = await fetch('/api/generate-vton-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      influencer,
      product,
      preferredScene,
    })
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('generate-vton-prompt response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Erro ao gerar roteiros VTON (${res.status}).`);
  }
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return data;  // { roteiros: [...] }
}

// Gera 1 imagem VTON com Nano Banana Pro (face + produto + prompt UGC).
// Retorna { imageUrl, prompt, seed, requestId }
export async function generateVtonImage({ facePhotoUrl, productPhotoUrl, prompt }) {
  const res = await fetch('/api/generate-vton-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      facePhotoUrl,
      productPhotoUrl,
      prompt,
    })
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('generate-vton-image response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Erro ao gerar imagem VTON (${res.status}).`);
  }
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return data;  // { imageUrl, prompt, seed, requestId }
}

// ══════════ VTON Profile storage (v4.0 — separado do legacy) ══════════
// O perfil VTON tem: { id, name, facePhoto, hair, ageHint, vibe, signature, bodyHint, createdAt }
// Storage separado pra não interferir nos perfis legacy.
const VTON_PROFILES_KEY = 'marcos-studio-vton-profiles';

export function getVtonProfiles() {
  try {
    const stored = localStorage.getItem(VTON_PROFILES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveVtonProfile(profile) {
  const profiles = getVtonProfiles();
  const idx = profiles.findIndex(p => p.id === profile.id);
  if (idx >= 0) {
    profiles[idx] = { ...profiles[idx], ...profile };
  } else {
    profiles.push({
      ...profile,
      id: profile.id || `vton_${Date.now()}`,
      createdAt: profile.createdAt || new Date().toISOString(),
    });
  }
  localStorage.setItem(VTON_PROFILES_KEY, JSON.stringify(profiles));
  return profiles;
}

export function deleteVtonProfile(id) {
  const profiles = getVtonProfiles().filter(p => p.id !== id);
  localStorage.setItem(VTON_PROFILES_KEY, JSON.stringify(profiles));
  return profiles;
}

// ═══════════════════════════════════════════════════════════════════════
// VTON v2.0 HELPERS — pipeline com aprovação manual
// ═══════════════════════════════════════════════════════════════════════
//
// Esses helpers complementam os helpers VTON v1 (que continuam funcionando).
// Implementam o fluxo de aprovação por etapa do VTON v2.0:
//   1. generateVtonRoteiros (modo roteiros_only — sem prompts pesados)
//   2. generateBackPromptVton (encadeamento serial após frontal aprovada)
//   3. analyzeFidelity (auditoria opcional sob demanda)

// Gera 3 ROTEIROS leves (sceneName, description, movementPlan, videoPrompt)
// SEM gerar promptFrontal/promptBack ainda. Os prompts serão gerados depois,
// sob demanda, conforme usuário aprovar etapa por etapa.
//
// Internamente chama o mesmo endpoint /api/generate-vton-prompt mas com
// mode='roteiros_only' (que retorna schema mais leve).
export async function generateVtonRoteiros({ influencer, product, preferredScene }) {
  const res = await fetch('/api/generate-vton-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      influencer,
      product,
      preferredScene,
      mode: 'roteiros_only',
    })
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('generate-vton-roteiros response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Erro ao gerar roteiros VTON (${res.status}).`);
  }
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return data;  // { roteiros: [...] } — sem promptFrontal/promptBack
}

// Gera o promptBack OLHANDO a imagem frontal real via Claude Vision.
// Garante consistência visual entre frontal e costas (cabelo, iluminação,
// cenário, acessórios).
//
// Use este helper depois que o usuário APROVOU a imagem frontal.
export async function generateBackPromptVton({
  frontalImageUrl,
  influencer,
  product,
  movementPlan,
  sceneName,
  videoPrompt,
}) {
  const res = await fetch('/api/generate-back-prompt-vton', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      frontalImageUrl,
      influencer,
      product,
      movementPlan,
      sceneName,
      videoPrompt,
    })
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('generate-back-prompt-vton response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Erro ao gerar prompt de costas VTON (${res.status}).`);
  }
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return data;  // { promptBack, visualAnalysis }
}

// Audita FIDELIDADE da imagem gerada vs produto real (sob demanda).
// Retorna checklist FACTUAL (✅ ok / ⚠️ divergente).
//
// Use este helper quando o usuário CLICAR "Analisar fidelidade" na UI.
// NÃO chama automaticamente — Sugestão 3 da arquitetura v2.0 (rejeitada
// pelo Marcos: análise é opcional).
export async function analyzeFidelity({
  generatedImageUrl,
  productFrontPhotoUrl,
  productBackPhotoUrl,
  productAnalysis,
  viewType,  // 'frontal' | 'back'
}) {
  const res = await fetch('/api/analyze-fidelity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generatedImageUrl,
      productFrontPhotoUrl,
      productBackPhotoUrl,
      productAnalysis,
      viewType: viewType || 'frontal',
    })
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('analyze-fidelity response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Erro ao analisar fidelidade (${res.status}).`);
  }
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return data;  // { overall, summary, checklist, criticalIssues, minorIssues }
}
