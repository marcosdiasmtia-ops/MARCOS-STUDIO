// src/VtonStudio.jsx (v1.0 — aba VTON nova)
//
// Componente principal da aba VTON do MARCOS-STUDIO.
// Implementa o pipeline validado em 24/04/2026:
//
// 1. Gerenciar influencers VTON cadastradas (CRUD básico)
// 2. Cadastrar nova influencer (upload de 1 foto de rosto + Claude Vision analisa)
// 3. Selecionar influencer + upload de produto (frontal + costas)
// 4. Claude analisa produto + gera 3 roteiros UGC sugeridos
// 5. Marcos seleciona quais roteiros gerar (checkbox múltiplo)
// 6. Sistema gera as imagens via Nano Banana Pro
// 7. Sistema gera os vídeos via Kling 3.0 (15s, mudo)
// 8. Galeria de vídeos finais
//
// SEPARADO da aba legacy — não interfere em FLUX.2 pro pipeline.

import { useState, useEffect } from 'react';
import {
  uploadToFal,
  analyzeFace,
  analyzeProductVton,
  generateVtonPrompt,
  generateVtonImage,
  generateVideo,
  checkVideoStatus,
  getVtonProfiles,
  saveVtonProfile,
  deleteVtonProfile,
} from './api.js';

// ─────────────────────────────────────────────────────────────────
// HELPER — Comprime imagem antes de mandar pra API
// Resize automático pra max 1280px (mantém proporção) + JPEG quality 0.85
// Resolve fotos grandes (>2MB ou dimensões > 2000px) que estouravam o
// limite do Claude API (5MB base64 / dimensões altas).
// ─────────────────────────────────────────────────────────────────
async function compressImage(file, maxDim = 1280, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calcula novas dimensões mantendo proporção
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        // Desenha em canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Exporta como JPEG comprimido
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];

        resolve({
          base64,
          mimeType: 'image/jpeg',
          preview: dataUrl,
          originalWidth: img.naturalWidth,
          originalHeight: img.naturalHeight,
          finalWidth: width,
          finalHeight: height,
        });
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

// Estágios da aba VTON
const STAGE = {
  INFLUENCER_LIST:    'influencer_list',     // tela inicial: lista de influencers
  INFLUENCER_NEW:     'influencer_new',      // cadastrar nova
  INFLUENCER_DETAIL:  'influencer_detail',   // editar uma existente
  PRODUCT_UPLOAD:     'product_upload',      // upload do produto
  ANALYZING:          'analyzing',           // Claude analisando produto + gerando roteiros
  ROTEIROS:           'roteiros',            // mostrar 3 roteiros + selecionar
  GENERATING:         'generating',          // gerando imagens + vídeos
  RESULTS:            'results',             // galeria de vídeos finais
};

export default function VtonStudio() {
  const [stage, setStage] = useState(STAGE.INFLUENCER_LIST);
  const [profiles, setProfiles] = useState([]);
  const [selectedInfluencer, setSelectedInfluencer] = useState(null);
  const [editingInfluencer, setEditingInfluencer] = useState(null);

  // Cadastro de nova influencer
  const [newInfName, setNewInfName] = useState('');
  const [newInfPhoto, setNewInfPhoto] = useState(null);  // { base64, mimeType, preview }
  const [newInfAnalysis, setNewInfAnalysis] = useState(null);  // { hair, ageHint, vibe, signature }
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);

  // Produto
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productFront, setProductFront] = useState(null);
  const [productBack, setProductBack] = useState(null);

  // Análise do produto
  const [productAnalysis, setProductAnalysis] = useState(null);
  // { frontDescription, backDescription, hasBackInterest, backReason }

  // Roteiros sugeridos
  const [roteiros, setRoteiros] = useState([]);
  const [selectedRoteiros, setSelectedRoteiros] = useState([]);  // ids dos selecionados

  // Geração final
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const [genResults, setGenResults] = useState([]);  // [{ roteiro, frontalUrl, backUrl?, videoUrl }, ...]
  const [genError, setGenError] = useState(null);

  // Carrega perfis do localStorage ao montar
  useEffect(() => {
    setProfiles(getVtonProfiles());
  }, []);

  // ──────────────────────────────────────────────────────
  // CADASTRO DE INFLUENCER
  // ──────────────────────────────────────────────────────

  async function handleNewInfPhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Comprime pra max 1280px JPEG quality 0.85 (resolve foto grande)
      const data = await compressImage(file, 1280, 0.85);
      console.log('[VTON] compressed face:',
        `${data.originalWidth}x${data.originalHeight} → ${data.finalWidth}x${data.finalHeight}`);
      setNewInfPhoto(data);
      setAnalyzeError(null);
      setNewInfAnalysis(null);

      // Chama Claude Vision automaticamente
      setAnalyzing(true);
      const analysis = await analyzeFace({
        faceBase64: data.base64,
        faceMimeType: data.mimeType,
      });
      setNewInfAnalysis(analysis);
    } catch (err) {
      console.error('[VTON] analyze face error:', err);
      setAnalyzeError(err.message || 'Erro ao analisar foto');
    } finally {
      setAnalyzing(false);
    }
  }

  function handleSaveNewInfluencer() {
    if (!newInfName.trim() || !newInfPhoto || !newInfAnalysis) return;

    const profile = {
      id: editingInfluencer?.id || `vton_${Date.now()}`,
      name: newInfName.trim(),
      facePhoto: {
        base64: newInfPhoto.base64,
        mimeType: newInfPhoto.mimeType,
        preview: newInfPhoto.preview,
      },
      hair: newInfAnalysis.hair,
      ageHint: newInfAnalysis.ageHint,
      vibe: newInfAnalysis.vibe,
      signature: newInfAnalysis.signature,
      bodyHint: editingInfluencer?.bodyHint || null,
      createdAt: editingInfluencer?.createdAt || new Date().toISOString(),
    };

    const updatedProfiles = saveVtonProfile(profile);
    setProfiles(updatedProfiles);

    // Limpa form
    setNewInfName('');
    setNewInfPhoto(null);
    setNewInfAnalysis(null);
    setEditingInfluencer(null);

    setStage(STAGE.INFLUENCER_LIST);
  }

  function handleDeleteInfluencer(id) {
    if (!confirm('Deletar essa influencer? Essa ação não pode ser desfeita.')) return;
    const updated = deleteVtonProfile(id);
    setProfiles(updated);
  }

  function handleEditInfluencer(profile) {
    setEditingInfluencer(profile);
    setNewInfName(profile.name);
    setNewInfPhoto({
      base64: profile.facePhoto.base64,
      mimeType: profile.facePhoto.mimeType,
      preview: profile.facePhoto.preview,
    });
    setNewInfAnalysis({
      hair: profile.hair,
      ageHint: profile.ageHint,
      vibe: profile.vibe,
      signature: profile.signature,
    });
    setStage(STAGE.INFLUENCER_NEW);
  }

  // ──────────────────────────────────────────────────────
  // FLUXO DE GERAÇÃO
  // ──────────────────────────────────────────────────────

  function handleSelectInfluencer(profile) {
    setSelectedInfluencer(profile);
    setStage(STAGE.PRODUCT_UPLOAD);
  }

  async function handleProductFile(e, side) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Comprime pra max 1280px JPEG quality 0.85
      const data = await compressImage(file, 1280, 0.85);
      console.log(`[VTON] compressed product ${side}:`,
        `${data.originalWidth}x${data.originalHeight} → ${data.finalWidth}x${data.finalHeight}`);
      if (side === 'front') setProductFront(data);
      else setProductBack(data);
    } catch (err) {
      console.error('[VTON] product file error:', err);
    }
  }

  async function handleAnalyzeProduct() {
    if (!productFront || !productBack) {
      alert('Sobe as 2 fotos do produto (frontal + costas)');
      return;
    }
    setStage(STAGE.ANALYZING);
    setGenStatus('Claude analisando produto...');

    try {
      // Etapa 1: analisar produto
      const analysis = await analyzeProductVton({
        frontBase64: productFront.base64,
        frontMimeType: productFront.mimeType,
        backBase64: productBack.base64,
        backMimeType: productBack.mimeType,
        productName,
        productDescription: productDesc,
      });
      setProductAnalysis(analysis);
      setGenStatus('Buscando cenários trending no TikTok Shop...');

      // Etapa 2: gerar 3 roteiros
      const data = await generateVtonPrompt({
        influencer: {
          name: selectedInfluencer.name,
          hair: selectedInfluencer.hair,
          ageHint: selectedInfluencer.ageHint,
          vibe: selectedInfluencer.vibe,
          signature: selectedInfluencer.signature,
          bodyHint: selectedInfluencer.bodyHint,
        },
        product: {
          name: productName,
          frontDescription: analysis.frontDescription,
          backDescription: analysis.backDescription,
          hasBackInterest: analysis.hasBackInterest,
          backReason: analysis.backReason,
        },
      });

      setRoteiros(data.roteiros);
      // Pré-seleciona todos os 3
      setSelectedRoteiros(data.roteiros.map(r => r.id));
      setStage(STAGE.ROTEIROS);
    } catch (err) {
      console.error('[VTON] analyze/generate error:', err);
      setGenError(err.message || 'Erro inesperado');
      setStage(STAGE.PRODUCT_UPLOAD);
    }
  }

  function toggleRoteiro(id) {
    setSelectedRoteiros(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleGenerateAll() {
    const selected = roteiros.filter(r => selectedRoteiros.includes(r.id));
    if (selected.length === 0) {
      alert('Marca pelo menos 1 roteiro pra gerar');
      return;
    }

    const totalCost = selected.reduce((s, r) => s + r.estimatedCost + 1.68, 0);
    if (!confirm(`Gerar ${selected.length} vídeo(s)?\nCusto estimado: $${totalCost.toFixed(2)}\n(${selected.length} × Nano Banana + ${selected.length} × Kling 15s mudo)`)) {
      return;
    }

    setStage(STAGE.GENERATING);
    setGenError(null);
    setGenResults([]);

    try {
      // Upload das fotos uma vez (compartilhadas entre roteiros)
      setGenStatus('Subindo foto da influencer...');
      const facePhotoUrl = await uploadToFal(
        selectedInfluencer.facePhoto.base64,
        selectedInfluencer.facePhoto.mimeType,
        'face.jpg'
      );

      setGenStatus('Subindo foto frontal do produto...');
      const productFrontUrl = await uploadToFal(
        productFront.base64,
        productFront.mimeType,
        'product-front.jpg'
      );

      setGenStatus('Subindo foto de costas do produto...');
      const productBackUrl = await uploadToFal(
        productBack.base64,
        productBack.mimeType,
        'product-back.jpg'
      );

      // Gera roteiro por roteiro
      const results = [];
      for (let i = 0; i < selected.length; i++) {
        const r = selected[i];
        setGenStatus(`Roteiro ${i + 1}/${selected.length}: gerando imagem frontal...`);

        const frontalRes = await generateVtonImage({
          facePhotoUrl,
          productPhotoUrl: productFrontUrl,
          prompt: r.promptFrontal,
        });

        let backUrl = null;
        if (r.hasBack && r.promptBack) {
          setGenStatus(`Roteiro ${i + 1}/${selected.length}: gerando imagem de costas...`);
          const backRes = await generateVtonImage({
            facePhotoUrl,
            productPhotoUrl: productBackUrl,
            prompt: r.promptBack,
          });
          backUrl = backRes.imageUrl;
        }

        setGenStatus(`Roteiro ${i + 1}/${selected.length}: gerando vídeo Kling 15s mudo...`);

        const videoSubmit = await generateVideo({
          engine: 'kling',
          prompt: `Cinematic UGC fashion video, gentle natural movement, slight head turn, subtle expression change, 15 seconds, vertical format`,
          image_url: frontalRes.imageUrl,
          element_image_url: backUrl,
          duration: 15,
          aspect_ratio: '9:16',
          generate_audio: false,
          negative_prompt: '',
        });

        // Polling do status
        let videoUrl = null;
        if (videoSubmit.requestId) {
          const maxPolls = 90;
          for (let p = 0; p < maxPolls; p++) {
            await new Promise(r => setTimeout(r, 3000));
            const status = await checkVideoStatus(
              videoSubmit.requestId,
              videoSubmit.endpoint,
              videoSubmit.statusUrl,
              videoSubmit.responseUrl
            );
            if (status?.video?.url) {
              videoUrl = status.video.url;
              break;
            }
            if (status?.status === 'FAILED' || status?.status === 'ERROR') {
              throw new Error(`Vídeo falhou: ${JSON.stringify(status).substring(0, 200)}`);
            }
            setGenStatus(`Roteiro ${i + 1}/${selected.length}: vídeo em progresso (${(p + 1) * 3}s)...`);
          }
        } else if (videoSubmit?.video?.url) {
          videoUrl = videoSubmit.video.url;
        }

        results.push({
          roteiro: r,
          frontalUrl: frontalRes.imageUrl,
          backUrl,
          videoUrl,
        });
        setGenResults([...results]);
      }

      setGenStatus('');
      setStage(STAGE.RESULTS);
    } catch (err) {
      console.error('[VTON] generate error:', err);
      setGenError(err.message || 'Erro inesperado');
    }
  }

  function handleStartNewProduct() {
    setProductName('');
    setProductPrice('');
    setProductDesc('');
    setProductFront(null);
    setProductBack(null);
    setProductAnalysis(null);
    setRoteiros([]);
    setSelectedRoteiros([]);
    setGenResults([]);
    setGenError(null);
    setGenStatus('');
    setStage(STAGE.PRODUCT_UPLOAD);
  }

  // ──────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────

  // STAGE 1: Lista de influencers cadastradas
  if (stage === STAGE.INFLUENCER_LIST) {
    return (
      <div className="container">
        <div className="header">
          <span className="badge">VTON • Virtual Try-On</span>
          <h1 className="title">Estúdio VTON</h1>
          <p className="subtitle">Pipeline validado: 1 foto + Nano Banana Pro + Kling 3.0</p>
        </div>

        <div className="card">
          <div className="card-header-row">
            <h3 className="card-title">Influencers cadastradas ({profiles.length})</h3>
            <button
              className="back-btn"
              onClick={() => {
                setEditingInfluencer(null);
                setNewInfName('');
                setNewInfPhoto(null);
                setNewInfAnalysis(null);
                setStage(STAGE.INFLUENCER_NEW);
              }}
            >+ Nova</button>
          </div>

          {profiles.length === 0 && (
            <p className="hint">Cadastra a primeira influencer pra começar.</p>
          )}

          {profiles.map(p => (
            <div key={p.id} className="card influencer-selector" onClick={() => handleSelectInfluencer(p)} style={{marginBottom:8, cursor:'pointer'}}>
              <div className="inf-row">
                <div className="inf-avatar">
                  {p.facePhoto?.preview ? (
                    <img src={p.facePhoto.preview} alt={p.name} />
                  ) : '👤'}
                </div>
                <div className="inf-info">
                  <div className="inf-name">{p.name}</div>
                  <div className="inf-hint">
                    {p.hair?.color || '?'} · {p.vibe || '?'}
                  </div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button
                    className="back-btn"
                    onClick={e => { e.stopPropagation(); handleEditInfluencer(p); }}
                    style={{fontSize:11, padding:'4px 10px'}}
                  >Editar</button>
                  <button
                    className="back-btn"
                    onClick={e => { e.stopPropagation(); handleDeleteInfluencer(p.id); }}
                    style={{fontSize:11, padding:'4px 10px', color:'#ff8888'}}
                  >Deletar</button>
                  <span className="inf-arrow">›</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // STAGE 2: Cadastrar nova influencer
  if (stage === STAGE.INFLUENCER_NEW) {
    return (
      <div className="container">
        <button className="back-btn" onClick={() => setStage(STAGE.INFLUENCER_LIST)} style={{marginBottom:14}}>← Voltar</button>

        <div className="header">
          <h1 className="title">{editingInfluencer ? 'Editar Influencer' : 'Nova Influencer'}</h1>
          <p className="subtitle">Cadastro mínimo: 1 foto de rosto bem iluminada</p>
        </div>

        <div className="card">
          <h3 className="card-title">Dados básicos</h3>

          <div className="field">
            <label>Nome</label>
            <input
              type="text"
              value={newInfName}
              onChange={e => setNewInfName(e.target.value)}
              placeholder="Ex: Aline"
            />
          </div>

          <div className="field">
            <label>Foto de rosto (close-up bem iluminado)</label>
            <label className="upload-area">
              {newInfPhoto?.preview ? (
                <img src={newInfPhoto.preview} alt="rosto" />
              ) : (
                <span>📸 Clica pra subir foto de rosto</span>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleNewInfPhotoUpload}
                style={{display:'none'}}
              />
            </label>
          </div>

          {analyzing && (
            <div className="loading-screen" style={{minHeight:120, padding:20}}>
              <div className="spinner"></div>
              <div className="loading-sub">Claude analisando rosto...</div>
            </div>
          )}

          {analyzeError && (
            <div className="error-box"><p>{analyzeError}</p></div>
          )}

          {newInfAnalysis && (
            <div className="card" style={{marginTop:12, background:'rgba(212,165,116,0.05)'}}>
              <h3 className="card-title">Análise automática</h3>
              <div className="field">
                <label>Cabelo</label>
                <div style={{fontSize:13, color:'var(--t2)'}}>
                  {newInfAnalysis.hair.color} · {newInfAnalysis.hair.texture} · {newInfAnalysis.hair.length}
                </div>
              </div>
              <div className="field">
                <label>Idade aparente</label>
                <div style={{fontSize:13, color:'var(--t2)'}}>{newInfAnalysis.ageHint}</div>
              </div>
              <div className="field">
                <label>Vibe</label>
                <div style={{fontSize:13, color:'var(--t2)'}}>{newInfAnalysis.vibe}</div>
              </div>
              <div className="field">
                <label>Pele</label>
                <div style={{fontSize:13, color:'var(--t2)'}}>{newInfAnalysis.signature.skin}</div>
              </div>
              {newInfAnalysis.signature.accent && (
                <div className="field">
                  <label>Sinal distintivo</label>
                  <div style={{fontSize:13, color:'var(--t2)'}}>{newInfAnalysis.signature.accent}</div>
                </div>
              )}
              <p className="hint" style={{marginTop:8}}>Esses campos vão ser usados nos prompts UGC.</p>
            </div>
          )}

          <button
            className="main-btn"
            onClick={handleSaveNewInfluencer}
            disabled={!newInfName.trim() || !newInfPhoto || !newInfAnalysis || analyzing}
            style={{marginTop:20}}
          >
            {editingInfluencer ? 'Salvar alterações' : 'Cadastrar influencer'}
          </button>
        </div>
      </div>
    );
  }

  // STAGE 3: Upload do produto
  if (stage === STAGE.PRODUCT_UPLOAD) {
    return (
      <div className="container">
        <button className="back-btn" onClick={() => setStage(STAGE.INFLUENCER_LIST)} style={{marginBottom:14}}>← Voltar</button>

        <div className="header">
          <h1 className="title">Novo produto</h1>
          <p className="subtitle">Influencer: <strong style={{color:'var(--g)'}}>{selectedInfluencer.name}</strong></p>
        </div>

        <div className="card">
          <h3 className="card-title">Dados do produto</h3>

          <div className="field">
            <label>Nome do produto</label>
            <input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Ex: Conjunto azul peplum" />
          </div>

          <div className="grid-2">
            <div className="field">
              <label>Preço <span className="opt">(opcional)</span></label>
              <input type="text" value={productPrice} onChange={e => setProductPrice(e.target.value)} placeholder="R$ 89,90" />
            </div>
            <div className="field">
              <label>Categoria <span className="opt">(opcional)</span></label>
              <input type="text" value={productDesc} onChange={e => setProductDesc(e.target.value)} placeholder="Ex: vestido, conjunto" />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label>Foto frontal (on-model)</label>
              <label className="upload-area">
                {productFront?.preview ? (
                  <img src={productFront.preview} alt="frontal" />
                ) : (
                  <span>📸 Frontal</span>
                )}
                <input type="file" accept="image/*" onChange={e => handleProductFile(e, 'front')} style={{display:'none'}} />
              </label>
            </div>
            <div className="field">
              <label>Foto de costas (on-model)</label>
              <label className="upload-area">
                {productBack?.preview ? (
                  <img src={productBack.preview} alt="costas" />
                ) : (
                  <span>📸 Costas</span>
                )}
                <input type="file" accept="image/*" onChange={e => handleProductFile(e, 'back')} style={{display:'none'}} />
              </label>
            </div>
          </div>

          {genError && (
            <div className="error-box" style={{marginTop:12}}><p>{genError}</p></div>
          )}

          <button
            className="main-btn"
            onClick={handleAnalyzeProduct}
            disabled={!productName.trim() || !productFront || !productBack}
            style={{marginTop:20}}
          >
            Analisar produto + gerar 3 roteiros
          </button>
        </div>
      </div>
    );
  }

  // STAGE 4: Analisando
  if (stage === STAGE.ANALYZING) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <div className="loading-title">Analisando produto</div>
        <div className="loading-sub">{genStatus}</div>
      </div>
    );
  }

  // STAGE 5: Roteiros
  if (stage === STAGE.ROTEIROS) {
    const totalCost = roteiros
      .filter(r => selectedRoteiros.includes(r.id))
      .reduce((s, r) => s + r.estimatedCost + 1.68, 0);

    return (
      <div className="container">
        <button className="back-btn" onClick={() => setStage(STAGE.PRODUCT_UPLOAD)} style={{marginBottom:14}}>← Voltar</button>

        <div className="header">
          <h1 className="title">3 roteiros sugeridos</h1>
          <p className="subtitle">
            {productAnalysis?.hasBackInterest
              ? `Vale exibir costas: ${productAnalysis.backReason}`
              : 'Esse produto não tem detalhe traseiro relevante — todos os roteiros são frontais'}
          </p>
        </div>

        {roteiros.map(r => {
          const selected = selectedRoteiros.includes(r.id);
          return (
            <div
              key={r.id}
              className="card"
              onClick={() => toggleRoteiro(r.id)}
              style={{
                cursor:'pointer',
                borderColor: selected ? 'var(--gb)' : 'var(--bd)',
                background: selected ? 'var(--gd)' : 'var(--sf)'
              }}
            >
              <div className="card-header-row">
                <h3 className="card-title">{r.sceneName}</h3>
                <span className={selected ? 'pill' : ''}>{selected ? '✓ Selecionado' : '○ Marcar'}</span>
              </div>
              <p style={{fontSize:14, color:'var(--t)', marginBottom:8}}>{r.description}</p>
              <div className="pills-row">
                <span className="pill">{r.poseType === 'frontal' ? 'Frontal' : 'Costas/3-4'}</span>
                <span className="pill">{r.hasBack ? '2 imagens' : '1 imagem'}</span>
                <span className="pill">${(r.estimatedCost + 1.68).toFixed(2)}</span>
              </div>
            </div>
          );
        })}

        <div className="card" style={{background:'var(--blb)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:11, color:'var(--t2)', textTransform:'uppercase', fontWeight:700}}>Total</div>
              <div style={{fontSize:24, fontWeight:700, color:'var(--g)'}}>${totalCost.toFixed(2)}</div>
              <div style={{fontSize:12, color:'var(--t3)'}}>{selectedRoteiros.length} vídeo(s) selecionado(s)</div>
            </div>
            <button
              className="main-btn"
              onClick={handleGenerateAll}
              disabled={selectedRoteiros.length === 0}
              style={{width:'auto', padding:'14px 28px'}}
            >
              Gerar selecionados
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STAGE 6: Gerando
  if (stage === STAGE.GENERATING) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <div className="loading-title">Gerando vídeos</div>
        <div className="loading-sub">{genStatus}</div>
        {genResults.length > 0 && (
          <p className="hint">{genResults.length} concluído(s)</p>
        )}
        {genError && (
          <div className="error-box"><p>{genError}</p></div>
        )}
      </div>
    );
  }

  // STAGE 7: Resultados
  if (stage === STAGE.RESULTS) {
    return (
      <div className="container">
        <div className="results-header">
          <div>
            <span className="results-badge">VTON Concluído</span>
            <h1 className="results-title">{genResults.length} vídeo(s) gerado(s)</h1>
            <p className="results-sub">{selectedInfluencer.name} · {productName}</p>
          </div>
          <button className="back-btn" onClick={handleStartNewProduct}>+ Novo produto</button>
        </div>

        {genResults.map((res, idx) => (
          <div key={idx} className="card">
            <div className="card-header-row">
              <h3 className="card-title">{res.roteiro.sceneName}</h3>
              <span className="pill">{res.roteiro.poseType === 'frontal' ? 'Frontal' : 'Costas/3-4'}</span>
            </div>

            <div className="grid-2" style={{marginBottom:14}}>
              <div>
                <label style={{fontSize:11, color:'var(--t2)', textTransform:'uppercase', display:'block', marginBottom:6}}>Imagem frontal</label>
                <img src={res.frontalUrl} alt="frontal" style={{width:'100%', borderRadius:'var(--rs)'}} />
              </div>
              {res.backUrl && (
                <div>
                  <label style={{fontSize:11, color:'var(--t2)', textTransform:'uppercase', display:'block', marginBottom:6}}>Imagem costas</label>
                  <img src={res.backUrl} alt="costas" style={{width:'100%', borderRadius:'var(--rs)'}} />
                </div>
              )}
            </div>

            {res.videoUrl ? (
              <div>
                <label style={{fontSize:11, color:'var(--t2)', textTransform:'uppercase', display:'block', marginBottom:6}}>Vídeo final (15s mudo, 9:16)</label>
                <video src={res.videoUrl} controls style={{width:'100%', borderRadius:'var(--rs)'}} />
                <a href={res.videoUrl} download style={{display:'inline-block', marginTop:8, fontSize:13, color:'var(--g)'}}>
                  ⬇ Baixar vídeo
                </a>
              </div>
            ) : (
              <div className="error-box"><p>Vídeo falhou — verifica logs Vercel</p></div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return null;
}
