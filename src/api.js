// API helper functions for all backend calls (v4.4 — adds 3 Avatar IA generation helpers)
//
// CHANGELOG:
// v3.0 — dual-photo analyzeIdentity + facePrompt pipeline (legacy/FLUX.2 pro)
// v4.0 — adiciona 4 helpers VTON novos:
//   - analyzeFace          → /api/analyze-face
//   - analyzeProductVton   → /api/analyze-product-vton
//   - generateVtonPrompt   → /api/generate-vton-prompt
//   - generateVtonImage    → /api/generate-vton-image
// v4.1 — UGC Falante Sessão 1 (fundamentos: voz):
//   - recommendVoice       → /api/ugc-voice-recommend
// v4.2 — UGC Falante Sessão 2 (geração de assets):
//   - generateUgcImageBase → /api/ugc-image-base
//   - generateUgcScript    → /api/ugc-script
//   - generateUgcVeoPrompt → /api/ugc-veo-prompt
// v4.3 — Avatar IA Sessão 1 (Lote C — influencer-type helpers):
//   - getRealInfluencers   → filtra profiles type !== 'avatar' (inclui legacy sem type)
//   - getAiAvatars         → filtra profiles type === 'avatar'
//   - Sem novo endpoint nem nova localStorage key (reusa marcos-studio-vton-profiles)
// v4.4 — Avatar IA Sessão 2 (geração — 3 endpoints novos):
//   - generateAvatarPrompt → /api/avatar-prompt        (Claude Sonnet 4 → JSON MIRR0R)
//   - generateAvatar       → /api/avatar-generate      (Nano Banana Pro 2× variações)
//   - generateCardPreview  → /api/avatar-card-preview  (Nano Banana Pro 1 imagem preview)
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

// ══════════ Influencer-type filters (v4.3 — Avatar IA Sessão 1) ══════════
// Mesma localStorage key (single source of truth — Decisão #8 da arquitetura
// Avatar IA). Usa o discriminador `type` no profile:
//   - type === 'avatar'  → Avatar IA (gerado do zero pelo wizard)
//   - type !== 'avatar'  → Influencer Real (foto real subida) — incluindo
//                          profiles legacy sem campo `type` (default = real)
//
// Retrocompat: profiles antigos (Cassandra, Lígia) não têm `type`. Default
// pra 'real' garantindo zero migração de dados (mesma lógica que a Sessão 3.5
// fez com `gender`).

export function getRealInfluencers() {
  return getVtonProfiles().filter(p => p.type !== 'avatar');
}

export function getAiAvatars() {
  return getVtonProfiles().filter(p => p.type === 'avatar');
}

// ══════════ Avatar IA generation helpers (v4.4 — Sessão 2) ══════════
// 3 helpers que ligam o frontend (Sessão 3 do plano) aos 3 endpoints
// criados na Sessão 2 da arquitetura Avatar IA.
//
// Pipeline completo:
//   1. AvatarWizard coleta dados → resolve via data files → chama generateAvatarPrompt
//   2. /api/avatar-prompt devolve { personaPrompt, englishPrompt, validationWarnings }
//   3. AvatarResult chama generateAvatar(englishPrompt) → recebe 2 imagens pra escolher
//   4. Cards do wizard (Decisão #10) chamam generateCardPreview com prompt simples
//
// Custos: prompt ~$0.003 (Claude) · generate ~$0.10 (2 fotos) · cardPreview ~$0.05.

// Resolve campos do wizard pra strings em inglês e chama Claude Sonnet 4
// pra construir o JSON MIRR0R-style descritivo do avatar.
//
// Espera receber objeto JÁ resolvido (frontend faz lookup nos data files):
//   { name, gender, age,
//     ethnicityDescriptions: [...], skinToneDescription, bodyTypeDescription,
//     eyeColorDescription, lipsDescription,
//     hairStyleDescription, hairColorDescription, beardStyleDescription?,
//     glassesDescription, piercingsDescriptions: [...],
//     editorialLine?, signature?, niche? }
//
// Retorna: { personaPrompt, englishPrompt, validationWarnings }
export async function generateAvatarPrompt(payload) {
  const res = await fetch('/api/avatar-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `avatar-prompt failed: ${res.status}`);
  }
  return data;  // { personaPrompt, englishPrompt, validationWarnings }
}

// Recebe o englishPrompt (vindo de generateAvatarPrompt) e dispara o
// Nano Banana Pro pra gerar 2 variações simultâneas (Decisão #6).
//
// Tempo típico: 30-60s (NÃO usar com loading bloqueante curto — usar progress).
//
// Retorna: { images: [{url, seed?}, {url, seed?}], prompt, requestId }
export async function generateAvatar(englishPrompt, name) {
  const res = await fetch('/api/avatar-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ englishPrompt, name }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `avatar-generate failed: ${res.status}`);
  }
  return data;  // { images: [...], prompt, requestId }
}

// Gera 1 imagem preview pra um card do wizard (Decisão #5 revisada + #10).
// Frontend monta um prompt curto descrevendo o atributo (ex: "candid headshot
// of a Nordic woman with fair complexion, ..."), passa o aspectRatio desejado,
// e o cacheKey só pra log.
//
// Default aspectRatio = '1:1' (cards quadrados). Outros: '3:4', '4:5', '9:16', etc.
//
// Tempo típico: 15-30s.
//
// Retorna: { url, seed, requestId, prompt }
export async function generateCardPreview(prompt, aspectRatio = '1:1', cacheKey = null) {
  const res = await fetch('/api/avatar-card-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspectRatio, cacheKey }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `avatar-card-preview failed: ${res.status}`);
  }
  return data;  // { url, seed, requestId, prompt }
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

// ═══════════════════════════════════════════════════════════════════════
// UGC FALANTE HELPERS (v4.1 — Sessão 1 de codificação)
// ═══════════════════════════════════════════════════════════════════════
//
// Helpers da nova aba UGC Falante. Este é o primeiro de uma série:
//   Sessão 1: voz (este helper)
//   Sessão 2: image-base, script, veo-prompt
//   Sessão 3-4: UI (wizard + galeria + output)

// Recomenda voz Veo 3 baseada em (estilo × gênero da influencer).
// Espelha o conceito "voz dinâmica = ƒ(influencer × estilo)" da arquitetura
// UGC Falante v3.0, validado empiricamente em 01/05/2026.
//
// @param {string} styleId — id do estilo UGC (ex: 'natural', 'autoridade',
//   'amigavel', 'urgente', 'curioso', 'storytelling', 'comparacao',
//   'confissao', 'alerta', 'hack', 'custo_beneficio')
// @param {'female'|'male'} [gender='female'] — gênero da influencer
// @returns {Promise<{voiceId: string, styleId: string, gender: string,
//   source: 'mapped'|'fallback'}>}
//
// Combina com o objeto-voz completo de src/data/ugc-veo-voices.js:
//   import { getVoiceById } from './data/ugc-veo-voices.js';
//   const { voiceId } = await recommendVoice('autoridade');
//   const voice = getVoiceById(voiceId); // → { id, gender, tone, ... }
export async function recommendVoice(styleId, gender = 'female') {
  const res = await fetch('/api/ugc-voice-recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ styleId, gender })
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('ugc-voice-recommend response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Erro ao recomendar voz (${res.status}). Verifique os logs no Vercel.`);
  }
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return data; // { voiceId, styleId, gender, source }
}


// ───────────────────────────────────────────────────────────────────────
// SESSÃO 2 — Geração de assets (image-base + script + veo-prompt)
// ───────────────────────────────────────────────────────────────────────

// Gera o FRAME INICIAL (estático) do vídeo UGC Falante via Nano Banana Pro.
// Esse frame vai ser animado pelo Veo 3 frame-to-video como Take 1.
//
// Espelha o padrão de generateVtonImage (mesmo modelo no fal.ai). O prompt
// deve vir já montado pelo frontend (combinando strings dos 7 data files
// de UGC Falante: ugc-styles, ugc-categories, ugc-durations, ugc-cameras,
// ugc-realism, ugc-scenarios + dados da influencer e produto).
//
// @param {object} input
// @param {string} input.facePhotoUrl    — URL pública da foto de rosto da influencer
// @param {string} input.productPhotoUrl — URL pública da foto do produto
// @param {string} input.prompt          — prompt em inglês, mín 100 chars
// @returns {Promise<{imageUrl: string, prompt: string, seed: number|null,
//   requestId: string}>}
export async function generateUgcImageBase({ facePhotoUrl, productPhotoUrl, prompt }) {
  const res = await fetch('/api/ugc-image-base', {
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
    console.error('ugc-image-base response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Erro ao gerar frame UGC Falante (${res.status}).`);
  }
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return data; // { imageUrl, prompt, seed, requestId }
}

// Gera o PACOTE PÓS-PRODUÇÃO COMPLETO em uma única chamada Claude Sonnet 4.
// Diferencial vs Trendly: além do roteiro, gera frases on-screen + descrição
// + hashtags + sugestão de música + 3 versões de CTA (Tema 8 + Item 8 da
// arquitetura UGC Falante v3.0).
//
// @param {object} input
// @param {object} input.influencer       — { name, bodyDescription?, vibe? }
// @param {object} input.product          — { name, description?, price?, originalPrice? }
// @param {string} input.styleId          — id de ugc-styles.js (ex: 'autoridade')
// @param {string} input.durationId       — '8s'|'16s'|'24s'|'32s'|'40s'
// @param {string} input.categoryId       — id de ugc-categories.js
// @param {string} [input.viralTranscript] — diferencial: usar transcrição viral como base
// @param {Array}  [input.previousScripts] — pra Claude não repetir vídeos anteriores
// @param {string} [input.trendData]      — dados de /api/search (futuro)
// @returns {Promise<{
//   script: Array<{takeNumber: number, fala: string, wordCount: number, durationSeconds: number}>,
//   onScreenPhrases: Array<{takeNumber: number, phrase: string}>,
//   description: string,
//   hashtags: string[],
//   musicSuggestion: {genre: string, mood: string, bpm: string, searchTerms: string[]},
//   ctas: {spoken: string, onScreen: string, written: string}
// }>}
export async function generateUgcScript(input) {
  const res = await fetch('/api/ugc-script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('ugc-script response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Erro ao gerar roteiro UGC Falante (${res.status}).`);
  }
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return data; // { script, onScreenPhrases, description, hashtags, musicSuggestion, ctas }
}

// Gera N PROMPTS EM INGLÊS pra Veo 3 (1 por take, com 8 blocos cada).
// Cada prompt inclui: INTRO, ENVIRONMENT, VISUAL REALISM, CAMERA, BEHAVIOR,
// SPEECH (com voz Veo 3 + fala PT-BR verbatim), PRODUCT INTERACTION,
// GENERAL GUIDELINES (incluindo a instrução crítica "end with stable pose
// for continuation video" — Item 4 da arquitetura UGC Falante).
//
// @param {object} input
// @param {object} input.influencer  — { name, bodyDescription?, vibe? }
// @param {object} input.product     — { name, description? }
// @param {string} input.styleId     — id de ugc-styles.js
// @param {string} input.durationId  — '8s'|'16s'|'24s'|'32s'|'40s'
// @param {string} input.cameraId    — id de ugc-cameras.js
// @param {string} input.realismId   — id de ugc-realism.js
// @param {string} input.scenarioId  — id de ugc-scenarios.js
// @param {string} input.voiceId     — voiceId resolvido por recommendVoice()
// @param {Array}  input.script      — array de takes vindo de generateUgcScript()
// @param {object} input.dataContext — strings já resolvidas dos data files:
//   { styleName, scenarioPrompt, cameraPrompt, realismPrompt, behaviorVibe, voiceTone }
// @param {boolean} [input.hasStarterFrame=false] — true quando Take 1 tem frame
// @returns {Promise<{prompts: Array<{takeNumber: number, prompt: string}>}>}
export async function generateUgcVeoPrompt(input) {
  const res = await fetch('/api/ugc-veo-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('ugc-veo-prompt response (not JSON):', res.status, text.substring(0, 500));
    throw new Error(`Erro ao gerar prompts Veo 3 (${res.status}).`);
  }
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return data; // { prompts: [{takeNumber, prompt}, ...] }
}
