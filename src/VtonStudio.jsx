// src/VtonStudio.jsx (v2.0 — pipeline de aprovação manual)
//
// MUDANÇAS v2.0 (vs v1.2):
//   - Pipeline de aprovação manual em CADA etapa (não mais batch)
//   - Encadeamento serial: gera frontal → aprova → gera prompt costas
//     OLHANDO a frontal real → aprova → vídeo
//   - 2 opções por imagem: gerar via Nano Banana OU anexar externa
//   - Análise de fidelidade OPCIONAL (sob demanda do usuário)
//   - Histórico de tentativas (refazer prompt N vezes)
//   - Barra superior fixa com custo cumulativo + progresso
//   - Roteiros 2 e 3 oferecidos APÓS finalizar o roteiro 1
//
// PRINCÍPIOS:
//   - Aprovação humana evita desperdício ($1,68 Kling não é gerado se
//     imagens não estiverem boas)
//   - Modo automático (Nano Banana) usa MESMO encadeamento serial
//   - Estilo visual idêntico ao legacy (DM Sans, paleta dourada)
//   - Multi-influencer agnóstico (Regra 15 do Notion)

import { useState, useEffect } from 'react';
import {
  uploadToFal,
  analyzeFace,
  analyzeProductVton,
  generateVtonRoteiros,    // v2.0
  generateBackPromptVton,  // v2.0
  analyzeFidelity,         // v2.0
  generateVtonPrompt,      // v1 — fallback completo (se precisar)
  generateVtonImage,
  generateVideo,
  checkVideoStatus,
  getVtonProfiles,
  saveVtonProfile,
  deleteVtonProfile,
} from './api.js';

// Helper de compressão de imagem (resolve fotos grandes que estouram Claude API)
async function compressImage(file, maxDim = 1280, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
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
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
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

// Estágios do fluxo VTON v2.0
const STAGE = {
  INFLUENCER_LIST:      'influencer_list',       // home: lista de influencers
  INFLUENCER_NEW:       'influencer_new',        // cadastrar/editar
  PRODUCT_UPLOAD:       'product_upload',        // upload produto
  ANALYZING_PRODUCT:    'analyzing_product',     // Claude analisa produto + cenários
  ROTEIROS:             'roteiros',              // 3 roteiros — usuário SELECIONA 1
  PROMPT_FRONTAL:       'prompt_frontal',        // mostra promptFrontal + opções
  IMAGE_FRONTAL_REVIEW: 'image_frontal_review',  // mostra imagem frontal + ações
  PROMPT_BACK:          'prompt_back',           // mostra promptBack (encadeado)
  IMAGE_BACK_REVIEW:    'image_back_review',     // mostra imagem costas + ações
  GENERATING_VIDEO:     'generating_video',      // Kling 15s
  VIDEO_DONE:           'video_done',            // galeria + próximos roteiros
};

export default function VtonStudio() {
  const [stage, setStage] = useState(STAGE.INFLUENCER_LIST);
  const [profiles, setProfiles] = useState([]);
  const [selectedInfluencer, setSelectedInfluencer] = useState(null);
  const [editingInfluencer, setEditingInfluencer] = useState(null);

  // Cadastro de influencer
  const [newInfName, setNewInfName] = useState('');
  const [newInfPhoto, setNewInfPhoto] = useState(null);
  const [newInfAnalysis, setNewInfAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);

  // Produto
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productFront, setProductFront] = useState(null);
  const [productBack, setProductBack] = useState(null);
  const [productAnalysis, setProductAnalysis] = useState(null);

  // Roteiros
  const [roteiros, setRoteiros] = useState([]);
  const [activeRoteiro, setActiveRoteiro] = useState(null);
  const [completedRoteiroIds, setCompletedRoteiroIds] = useState([]);
  const [allVideos, setAllVideos] = useState([]);  // [{ roteiro, frontalUrl, backUrl, videoUrl }]

  // Prompt frontal
  const [promptFrontal, setPromptFrontal] = useState('');
  const [editingPromptFrontal, setEditingPromptFrontal] = useState(false);
  const [frontalAttempts, setFrontalAttempts] = useState([]);
  // Cada tentativa: { prompt, imageUrl, fidelity?, source: 'nano_banana' | 'external' }
  const [frontalApprovedUrl, setFrontalApprovedUrl] = useState(null);
  const [frontalApprovedPrompt, setFrontalApprovedPrompt] = useState('');

  // Prompt costas
  const [promptBack, setPromptBack] = useState('');
  const [editingPromptBack, setEditingPromptBack] = useState(false);
  const [backAttempts, setBackAttempts] = useState([]);
  const [backApprovedUrl, setBackApprovedUrl] = useState(null);

  // Estados de ação
  const [actionLoading, setActionLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState('');
  const [actionError, setActionError] = useState(null);

  // URLs do produto no fal.ai (uploaded once, reused)
  const [productFrontUrl, setProductFrontUrl] = useState(null);
  const [productBackUrl, setProductBackUrl] = useState(null);
  const [facePhotoUrl, setFacePhotoUrl] = useState(null);

  // Análise de fidelidade (sob demanda)
  const [fidelityFront, setFidelityFront] = useState(null);
  const [fidelityBack, setFidelityBack] = useState(null);

  // Custo cumulativo
  const [cumulativeCost, setCumulativeCost] = useState(0);

  // Carrega perfis do localStorage
  useEffect(() => {
    setProfiles(getVtonProfiles());
  }, []);

  // ──────────────────────────────────────────────────────
  // CADASTRO DE INFLUENCER (mesmo de v1.2)
  // ──────────────────────────────────────────────────────

  async function handleNewInfPhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await compressImage(file, 1280, 0.85);
      setNewInfPhoto(data);
      setAnalyzeError(null);
      setNewInfAnalysis(null);

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
    const updated = saveVtonProfile(profile);
    setProfiles(updated);
    setNewInfName('');
    setNewInfPhoto(null);
    setNewInfAnalysis(null);
    setEditingInfluencer(null);
    setStage(STAGE.INFLUENCER_LIST);
  }

  function handleDeleteInfluencer(id) {
    if (!confirm('Deletar essa influencer?')) return;
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
  // PRODUTO + GERAÇÃO DE ROTEIROS
  // ──────────────────────────────────────────────────────

  function handleSelectInfluencer(profile) {
    setSelectedInfluencer(profile);
    resetSession();
    setStage(STAGE.PRODUCT_UPLOAD);
  }

  function resetSession() {
    setProductName('');
    setProductPrice('');
    setProductDesc('');
    setProductFront(null);
    setProductBack(null);
    setProductAnalysis(null);
    setRoteiros([]);
    setActiveRoteiro(null);
    setCompletedRoteiroIds([]);
    setAllVideos([]);
    setProductFrontUrl(null);
    setProductBackUrl(null);
    setFacePhotoUrl(null);
    setCumulativeCost(0);
    resetRoteiroState();
  }

  function resetRoteiroState() {
    setPromptFrontal('');
    setEditingPromptFrontal(false);
    setFrontalAttempts([]);
    setFrontalApprovedUrl(null);
    setFrontalApprovedPrompt('');
    setPromptBack('');
    setEditingPromptBack(false);
    setBackAttempts([]);
    setBackApprovedUrl(null);
    setFidelityFront(null);
    setFidelityBack(null);
    setActionError(null);
    setActionStatus('');
  }

  async function handleProductFile(e, side) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await compressImage(file, 1280, 0.85);
      if (side === 'front') setProductFront(data);
      else setProductBack(data);
    } catch (err) {
      console.error('[VTON] product file error:', err);
    }
  }

  async function handleAnalyzeProduct() {
    if (!productFront || !productBack) {
      alert('Sobe as 2 fotos do produto');
      return;
    }
    setStage(STAGE.ANALYZING_PRODUCT);
    setActionError(null);
    setActionStatus('Claude analisando produto...');

    try {
      const analysis = await analyzeProductVton({
        frontBase64: productFront.base64,
        frontMimeType: productFront.mimeType,
        backBase64: productBack.base64,
        backMimeType: productBack.mimeType,
        productName,
        productDescription: productDesc,
      });
      setProductAnalysis(analysis);
      setActionStatus('Buscando cenários e movimentos trending...');

      // Modo v2.0: gera SÓ os roteiros (sem prompts pesados)
      const data = await generateVtonRoteiros({
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
      setCumulativeCost(c => c + 0.03);  // ~$0,03 (Claude analyses + web_search)
      setStage(STAGE.ROTEIROS);
    } catch (err) {
      console.error('[VTON] analyze/generate error:', err);
      setActionError(err.message || 'Erro inesperado');
      setStage(STAGE.PRODUCT_UPLOAD);
    }
  }

  // ──────────────────────────────────────────────────────
  // SELECIONAR ROTEIRO + GERAR PROMPT FRONTAL
  // ──────────────────────────────────────────────────────

  async function handleSelectRoteiro(roteiro) {
    setActiveRoteiro(roteiro);
    resetRoteiroState();
    setActionLoading(true);
    setActionStatus('Gerando prompt da imagem CTA frontal...');

    try {
      // Sobe fotos uma vez, reusa em todas as etapas
      let faceUrl = facePhotoUrl;
      let frontUrl = productFrontUrl;
      let backUrl = productBackUrl;

      if (!faceUrl) {
        setActionStatus('Subindo foto da influencer...');
        faceUrl = await uploadToFal(
          selectedInfluencer.facePhoto.base64,
          selectedInfluencer.facePhoto.mimeType,
          'face.jpg'
        );
        setFacePhotoUrl(faceUrl);
      }
      if (!frontUrl) {
        setActionStatus('Subindo foto frontal do produto...');
        frontUrl = await uploadToFal(productFront.base64, productFront.mimeType, 'product-front.jpg');
        setProductFrontUrl(frontUrl);
      }
      if (!backUrl) {
        setActionStatus('Subindo foto de costas do produto...');
        backUrl = await uploadToFal(productBack.base64, productBack.mimeType, 'product-back.jpg');
        setProductBackUrl(backUrl);
      }

      setActionStatus('Gerando prompt da imagem CTA frontal...');

      // Chama generate-vton-prompt em modo "all" só pra extrair o promptFrontal
      // do roteiro selecionado. Mais simples que criar endpoint separado.
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
          frontDescription: productAnalysis.frontDescription,
          backDescription: productAnalysis.backDescription,
          hasBackInterest: productAnalysis.hasBackInterest,
          backReason: productAnalysis.backReason,
        },
        preferredScene: roteiro.sceneName,
      });

      // Pega o roteiro que mais se assemelha ao selecionado (pelo sceneName)
      const matched = data.roteiros.find(r => r.sceneName === roteiro.sceneName)
                   || data.roteiros[0];
      setPromptFrontal(matched.promptFrontal || '');
      setActiveRoteiro({
        ...roteiro,
        promptFrontal: matched.promptFrontal,
        promptBack: matched.promptBack,
        videoPrompt: matched.videoPrompt,
      });

      setCumulativeCost(c => c + 0.03);
      setStage(STAGE.PROMPT_FRONTAL);
    } catch (err) {
      console.error('[VTON] select roteiro error:', err);
      setActionError(err.message || 'Erro ao gerar prompt frontal');
      setStage(STAGE.ROTEIROS);
    } finally {
      setActionLoading(false);
    }
  }

  // ──────────────────────────────────────────────────────
  // GERAR IMAGEM FRONTAL (Nano Banana OU anexar)
  // ──────────────────────────────────────────────────────

  async function handleGenerateFrontalNanoBanana() {
    if (!promptFrontal || promptFrontal.length < 100) {
      alert('Prompt muito curto');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    setActionStatus('Gerando imagem frontal via Nano Banana Pro...');

    try {
      const result = await generateVtonImage({
        facePhotoUrl,
        productPhotoUrl: productFrontUrl,
        prompt: promptFrontal,
      });

      setFrontalAttempts(prev => [
        ...prev,
        {
          prompt: promptFrontal,
          imageUrl: result.imageUrl,
          source: 'nano_banana',
          timestamp: new Date().toISOString(),
        },
      ]);
      setCumulativeCost(c => c + 0.15);
      setStage(STAGE.IMAGE_FRONTAL_REVIEW);
    } catch (err) {
      console.error('[VTON] generate frontal error:', err);
      setActionError(err.message || 'Erro ao gerar imagem frontal');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAttachFrontalExternal(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionLoading(true);
    setActionError(null);
    setActionStatus('Subindo imagem externa...');

    try {
      const data = await compressImage(file, 1280, 0.85);
      const url = await uploadToFal(data.base64, data.mimeType, 'frontal-external.jpg');

      setFrontalAttempts(prev => [
        ...prev,
        {
          prompt: '(imagem externa anexada)',
          imageUrl: url,
          source: 'external',
          timestamp: new Date().toISOString(),
        },
      ]);
      setStage(STAGE.IMAGE_FRONTAL_REVIEW);
    } catch (err) {
      console.error('[VTON] attach frontal error:', err);
      setActionError(err.message || 'Erro ao anexar imagem');
    } finally {
      setActionLoading(false);
    }
  }

  function handleApproveFrontal() {
    const lastAttempt = frontalAttempts[frontalAttempts.length - 1];
    if (!lastAttempt) return;
    setFrontalApprovedUrl(lastAttempt.imageUrl);
    setFrontalApprovedPrompt(lastAttempt.prompt);
    handleGenerateBackPrompt(lastAttempt.imageUrl);
  }

  async function handleAnalyzeFidelityFrontal() {
    const lastAttempt = frontalAttempts[frontalAttempts.length - 1];
    if (!lastAttempt) return;
    setActionLoading(true);
    setActionError(null);
    setActionStatus('Auditando fidelidade do produto...');

    try {
      const result = await analyzeFidelity({
        generatedImageUrl: lastAttempt.imageUrl,
        productFrontPhotoUrl: productFrontUrl,
        productBackPhotoUrl: productBackUrl,
        productAnalysis,
        viewType: 'frontal',
      });
      setFidelityFront(result);
      setCumulativeCost(c => c + 0.02);
    } catch (err) {
      console.error('[VTON] analyze fidelity error:', err);
      setActionError(err.message || 'Erro na auditoria');
    } finally {
      setActionLoading(false);
    }
  }

  function handleRefazerFrontal(feedback) {
    if (!feedback || feedback.trim().length < 5) {
      alert('Descreve o que quer melhorar (ex: "fenda frontal não apareceu, tecido deveria ser acetinado")');
      return;
    }

    // Adiciona o feedback ao prompt antigo e volta pra tela de prompt
    const newPrompt = `${promptFrontal}\n\nIMPORTANT FEEDBACK FROM USER (must address): ${feedback}`;
    setPromptFrontal(newPrompt);
    setActionError(null);
    setStage(STAGE.PROMPT_FRONTAL);
  }

  // ──────────────────────────────────────────────────────
  // GERAR PROMPT COSTAS (encadeamento serial)
  // ──────────────────────────────────────────────────────

  async function handleGenerateBackPrompt(frontalUrl) {
    // Se hasBack=false, pula direto pro vídeo
    if (!activeRoteiro?.hasBack) {
      handleGenerateVideo(frontalUrl, null);
      return;
    }

    setActionLoading(true);
    setActionError(null);
    setActionStatus('Gerando prompt de costas (referenciando frontal aprovada)...');

    try {
      const result = await generateBackPromptVton({
        frontalImageUrl: frontalUrl,
        influencer: {
          name: selectedInfluencer.name,
          hair: selectedInfluencer.hair,
          ageHint: selectedInfluencer.ageHint,
          vibe: selectedInfluencer.vibe,
          signature: selectedInfluencer.signature,
          bodyHint: selectedInfluencer.bodyHint,
        },
        product: {
          frontDescription: productAnalysis.frontDescription,
          backDescription: productAnalysis.backDescription,
        },
        movementPlan: activeRoteiro.movementPlan,
        sceneName: activeRoteiro.sceneName,
        videoPrompt: activeRoteiro.videoPrompt,
      });

      setPromptBack(result.promptBack);
      setCumulativeCost(c => c + 0.02);
      setStage(STAGE.PROMPT_BACK);
    } catch (err) {
      console.error('[VTON] generate back prompt error:', err);
      setActionError(err.message || 'Erro ao gerar prompt de costas');
      setStage(STAGE.IMAGE_FRONTAL_REVIEW);
    } finally {
      setActionLoading(false);
    }
  }

  // ──────────────────────────────────────────────────────
  // GERAR IMAGEM COSTAS (Nano Banana OU anexar)
  // ──────────────────────────────────────────────────────

  async function handleGenerateBackNanoBanana() {
    if (!promptBack || promptBack.length < 100) {
      alert('Prompt muito curto');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    setActionStatus('Gerando imagem costas via Nano Banana Pro...');

    try {
      const result = await generateVtonImage({
        facePhotoUrl,
        productPhotoUrl: productBackUrl,
        prompt: promptBack,
      });

      setBackAttempts(prev => [
        ...prev,
        {
          prompt: promptBack,
          imageUrl: result.imageUrl,
          source: 'nano_banana',
          timestamp: new Date().toISOString(),
        },
      ]);
      setCumulativeCost(c => c + 0.15);
      setStage(STAGE.IMAGE_BACK_REVIEW);
    } catch (err) {
      console.error('[VTON] generate back error:', err);
      setActionError(err.message || 'Erro ao gerar imagem costas');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAttachBackExternal(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionLoading(true);
    setActionError(null);
    setActionStatus('Subindo imagem externa...');

    try {
      const data = await compressImage(file, 1280, 0.85);
      const url = await uploadToFal(data.base64, data.mimeType, 'back-external.jpg');

      setBackAttempts(prev => [
        ...prev,
        {
          prompt: '(imagem externa anexada)',
          imageUrl: url,
          source: 'external',
          timestamp: new Date().toISOString(),
        },
      ]);
      setStage(STAGE.IMAGE_BACK_REVIEW);
    } catch (err) {
      console.error('[VTON] attach back error:', err);
      setActionError(err.message || 'Erro ao anexar imagem');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAnalyzeFidelityBack() {
    const lastAttempt = backAttempts[backAttempts.length - 1];
    if (!lastAttempt) return;
    setActionLoading(true);
    setActionError(null);
    setActionStatus('Auditando fidelidade do produto (costas)...');

    try {
      const result = await analyzeFidelity({
        generatedImageUrl: lastAttempt.imageUrl,
        productFrontPhotoUrl: productFrontUrl,
        productBackPhotoUrl: productBackUrl,
        productAnalysis,
        viewType: 'back',
      });
      setFidelityBack(result);
      setCumulativeCost(c => c + 0.02);
    } catch (err) {
      console.error('[VTON] analyze fidelity back error:', err);
      setActionError(err.message || 'Erro na auditoria');
    } finally {
      setActionLoading(false);
    }
  }

  function handleApproveBack() {
    const lastAttempt = backAttempts[backAttempts.length - 1];
    if (!lastAttempt) return;
    setBackApprovedUrl(lastAttempt.imageUrl);
    handleGenerateVideo(frontalApprovedUrl, lastAttempt.imageUrl);
  }

  function handleRefazerBack(feedback) {
    if (!feedback || feedback.trim().length < 5) {
      alert('Descreve o que quer melhorar');
      return;
    }
    const newPrompt = `${promptBack}\n\nIMPORTANT FEEDBACK FROM USER (must address): ${feedback}`;
    setPromptBack(newPrompt);
    setActionError(null);
    setStage(STAGE.PROMPT_BACK);
  }

  // ──────────────────────────────────────────────────────
  // GERAR VÍDEO (Kling)
  // ──────────────────────────────────────────────────────

  async function handleGenerateVideo(frontalUrl, backUrl) {
    setStage(STAGE.GENERATING_VIDEO);
    setActionLoading(true);
    setActionError(null);
    setActionStatus('Submetendo ao Kling 3.0...');

    try {
      const videoSubmit = await generateVideo({
        engine: 'kling',
        prompt: activeRoteiro.videoPrompt
          || `Cinematic UGC fashion video, gentle natural movement, ending with the woman looking at camera with subtle natural smile, 15 seconds, vertical format`,
        image_url: frontalUrl,
        element_image_url: backUrl,
        duration: 15,
        aspect_ratio: '9:16',
        generate_audio: false,
        negative_prompt: '',
      });

      let videoUrl = null;
      if (videoSubmit.requestId) {
        const maxPolls = 150;  // 150 × 3s = 450s = 7,5 min
        for (let p = 0; p < maxPolls; p++) {
          await new Promise(r => setTimeout(r, 3000));
          const status = await checkVideoStatus(
            videoSubmit.requestId,
            videoSubmit.endpoint,
            videoSubmit.statusUrl,
            videoSubmit.responseUrl
          );

          // Decodificação correta — fal.ai retorna { status, result: { video: { url } } }
          if (status?.status === 'COMPLETED') {
            const url = status?.result?.video?.url || status?.video?.url;
            if (url) {
              videoUrl = url;
              break;
            }
          }
          // Compat com formato sem campo "status" (fallback)
          if (status?.result?.video?.url) {
            videoUrl = status.result.video.url;
            break;
          }
          if (status?.video?.url) {
            videoUrl = status.video.url;
            break;
          }
          if (status?.status === 'FAILED' || status?.status === 'ERROR') {
            throw new Error(`Vídeo falhou: ${JSON.stringify(status).substring(0, 200)}`);
          }
          setActionStatus(`Vídeo em progresso (${(p + 1) * 3}s de até 450s)...`);
        }
      } else if (videoSubmit?.result?.video?.url) {
        videoUrl = videoSubmit.result.video.url;
      } else if (videoSubmit?.video?.url) {
        videoUrl = videoSubmit.video.url;
      }

      if (!videoUrl) {
        throw new Error('Timeout do Kling — vídeo demorou demais');
      }

      // Salva vídeo concluído
      const newVideo = {
        roteiro: activeRoteiro,
        frontalUrl,
        backUrl,
        videoUrl,
      };
      setAllVideos(prev => [...prev, newVideo]);
      setCompletedRoteiroIds(prev => [...prev, activeRoteiro.id]);
      setCumulativeCost(c => c + 1.68);

      setStage(STAGE.VIDEO_DONE);
    } catch (err) {
      console.error('[VTON] generate video error:', err);
      setActionError(err.message || 'Erro ao gerar vídeo');
    } finally {
      setActionLoading(false);
    }
  }

  // ──────────────────────────────────────────────────────
  // PRÓXIMO ROTEIRO ou FINALIZAR
  // ──────────────────────────────────────────────────────

  function handleNextRoteiro() {
    setActiveRoteiro(null);
    resetRoteiroState();
    setStage(STAGE.ROTEIROS);
  }

  function handleFinishSession() {
    setStage(STAGE.INFLUENCER_LIST);
    resetSession();
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  // ─── Barra superior fixa de progresso (visível na maioria dos estágios)
  function ProgressBar() {
    if ([STAGE.INFLUENCER_LIST, STAGE.INFLUENCER_NEW].includes(stage)) return null;

    const stageLabel = {
      [STAGE.PRODUCT_UPLOAD]:        'Etapa 1/6 · Produto',
      [STAGE.ANALYZING_PRODUCT]:     'Etapa 2/6 · Análise + Roteiros',
      [STAGE.ROTEIROS]:              'Etapa 2/6 · Selecionar roteiro',
      [STAGE.PROMPT_FRONTAL]:        'Etapa 3/6 · Prompt frontal',
      [STAGE.IMAGE_FRONTAL_REVIEW]:  'Etapa 4/6 · Revisar frontal',
      [STAGE.PROMPT_BACK]:           'Etapa 5/6 · Prompt costas',
      [STAGE.IMAGE_BACK_REVIEW]:     'Etapa 5/6 · Revisar costas',
      [STAGE.GENERATING_VIDEO]:      'Etapa 6/6 · Gerando vídeo',
      [STAGE.VIDEO_DONE]:            `Vídeo ${completedRoteiroIds.length} de 3 pronto`,
    }[stage] || '';

    return (
      <div style={{
        background: 'rgba(212,165,116,0.08)',
        border: '1px solid rgba(212,165,116,0.2)',
        borderRadius: 'var(--rs)',
        padding: '10px 16px',
        marginBottom: 14,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
      }}>
        <div>
          <span style={{color: 'var(--g)', fontWeight: 700, marginRight: 12}}>
            {selectedInfluencer?.name}
          </span>
          <span style={{color: 'var(--t2)'}}>· {stageLabel}</span>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{color: 'var(--g)', fontWeight: 700}}>${cumulativeCost.toFixed(2)} gasto</div>
          {completedRoteiroIds.length > 0 && (
            <div style={{color: 'var(--t3)', fontSize: 10}}>
              ✅ {completedRoteiroIds.length}/3 vídeos
            </div>
          )}
        </div>
      </div>
    );
  }

  // STAGE 1: Lista de influencers
  if (stage === STAGE.INFLUENCER_LIST) {
    return (
      <div className="container">
        <div className="header">
          <span className="badge">VTON v2.0 · Aprovação manual</span>
          <h1 className="title">Estúdio VTON</h1>
          <p className="subtitle">Pipeline com aprovação por etapa · Encadeamento serial</p>
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
          {profiles.length === 0 && (<p className="hint">Cadastra a primeira influencer pra começar.</p>)}
          {profiles.map(p => (
            <div
              key={p.id}
              className="card influencer-selector"
              onClick={() => handleSelectInfluencer(p)}
              style={{marginBottom: 8, cursor: 'pointer'}}
            >
              <div className="inf-row">
                <div className="inf-avatar">
                  {p.facePhoto?.preview ? <img src={p.facePhoto.preview} alt={p.name} /> : '👤'}
                </div>
                <div className="inf-info">
                  <div className="inf-name">{p.name}</div>
                  <div className="inf-hint">{p.hair?.color || '?'} · {p.vibe || '?'}</div>
                </div>
                <div style={{display: 'flex', gap: 6}}>
                  <button
                    className="back-btn"
                    onClick={e => { e.stopPropagation(); handleEditInfluencer(p); }}
                    style={{fontSize: 11, padding: '4px 10px'}}
                  >Editar</button>
                  <button
                    className="back-btn"
                    onClick={e => { e.stopPropagation(); handleDeleteInfluencer(p.id); }}
                    style={{fontSize: 11, padding: '4px 10px', color: '#ff8888'}}
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

  // STAGE 2: Cadastrar/editar influencer
  if (stage === STAGE.INFLUENCER_NEW) {
    return (
      <div className="container">
        <button className="back-btn" onClick={() => setStage(STAGE.INFLUENCER_LIST)} style={{marginBottom: 14}}>← Voltar</button>
        <div className="header">
          <h1 className="title">{editingInfluencer ? 'Editar Influencer' : 'Nova Influencer'}</h1>
          <p className="subtitle">Cadastro mínimo: 1 foto de rosto bem iluminada</p>
        </div>
        <div className="card">
          <h3 className="card-title">Dados básicos</h3>
          <div className="field">
            <label>Nome</label>
            <input type="text" value={newInfName} onChange={e => setNewInfName(e.target.value)} placeholder="Ex: Aline" />
          </div>
          <div className="field">
            <label>Foto de rosto (close-up bem iluminado)</label>
            <label className="upload-area">
              {newInfPhoto?.preview ? <img src={newInfPhoto.preview} alt="rosto" /> : <span>📸 Clica pra subir</span>}
              <input type="file" accept="image/*" onChange={handleNewInfPhotoUpload} style={{display: 'none'}} />
            </label>
          </div>
          {analyzing && (
            <div className="loading-screen" style={{minHeight: 120, padding: 20}}>
              <div className="spinner"></div>
              <div className="loading-sub">Claude analisando rosto...</div>
            </div>
          )}
          {analyzeError && (<div className="error-box"><p>{analyzeError}</p></div>)}
          {newInfAnalysis && (
            <div className="card" style={{marginTop: 12, background: 'rgba(212,165,116,0.05)'}}>
              <h3 className="card-title">Análise automática</h3>
              <div className="field"><label>Cabelo</label><div style={{fontSize: 13, color: 'var(--t2)'}}>{newInfAnalysis.hair.color} · {newInfAnalysis.hair.texture} · {newInfAnalysis.hair.length}</div></div>
              <div className="field"><label>Idade aparente</label><div style={{fontSize: 13, color: 'var(--t2)'}}>{newInfAnalysis.ageHint}</div></div>
              <div className="field"><label>Vibe</label><div style={{fontSize: 13, color: 'var(--t2)'}}>{newInfAnalysis.vibe}</div></div>
              <div className="field"><label>Pele</label><div style={{fontSize: 13, color: 'var(--t2)'}}>{newInfAnalysis.signature.skin}</div></div>
              {newInfAnalysis.signature.accent && (<div className="field"><label>Sinal distintivo</label><div style={{fontSize: 13, color: 'var(--t2)'}}>{newInfAnalysis.signature.accent}</div></div>)}
            </div>
          )}
          <button
            className="main-btn"
            onClick={handleSaveNewInfluencer}
            disabled={!newInfName.trim() || !newInfPhoto || !newInfAnalysis || analyzing}
            style={{marginTop: 20}}
          >{editingInfluencer ? 'Salvar alterações' : 'Cadastrar influencer'}</button>
        </div>
      </div>
    );
  }

  // STAGE 3: Upload do produto
  if (stage === STAGE.PRODUCT_UPLOAD) {
    return (
      <div className="container">
        <button className="back-btn" onClick={() => setStage(STAGE.INFLUENCER_LIST)} style={{marginBottom: 14}}>← Voltar</button>
        <ProgressBar />
        <div className="header">
          <h1 className="title">Novo produto</h1>
          <p className="subtitle">Influencer: <strong style={{color: 'var(--g)'}}>{selectedInfluencer.name}</strong></p>
        </div>
        <div className="card">
          <h3 className="card-title">Dados do produto</h3>
          <div className="field"><label>Nome do produto</label><input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Ex: Conjunto azul peplum" /></div>
          <div className="grid-2">
            <div className="field"><label>Preço <span className="opt">(opcional)</span></label><input type="text" value={productPrice} onChange={e => setProductPrice(e.target.value)} placeholder="R$ 89,90" /></div>
            <div className="field"><label>Categoria <span className="opt">(opcional)</span></label><input type="text" value={productDesc} onChange={e => setProductDesc(e.target.value)} placeholder="Ex: vestido" /></div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Foto frontal (on-model)</label>
              <label className="upload-area">
                {productFront?.preview ? <img src={productFront.preview} alt="frontal" /> : <span>📸 Frontal</span>}
                <input type="file" accept="image/*" onChange={e => handleProductFile(e, 'front')} style={{display: 'none'}} />
              </label>
            </div>
            <div className="field">
              <label>Foto de costas (on-model)</label>
              <label className="upload-area">
                {productBack?.preview ? <img src={productBack.preview} alt="costas" /> : <span>📸 Costas</span>}
                <input type="file" accept="image/*" onChange={e => handleProductFile(e, 'back')} style={{display: 'none'}} />
              </label>
            </div>
          </div>
          {actionError && (<div className="error-box" style={{marginTop: 12}}><p>{actionError}</p></div>)}
          <button
            className="main-btn"
            onClick={handleAnalyzeProduct}
            disabled={!productName.trim() || !productFront || !productBack}
            style={{marginTop: 20}}
          >Analisar produto + gerar 3 roteiros</button>
        </div>
      </div>
    );
  }

  // STAGE 4: Analisando
  if (stage === STAGE.ANALYZING_PRODUCT) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <div className="loading-title">Preparando roteiros</div>
        <div className="loading-sub">{actionStatus}</div>
      </div>
    );
  }

  // STAGE 5: Roteiros (3 cards — usuário SELECIONA 1)
  if (stage === STAGE.ROTEIROS) {
    return (
      <div className="container">
        <button className="back-btn" onClick={() => setStage(STAGE.PRODUCT_UPLOAD)} style={{marginBottom: 14}}>← Voltar</button>
        <ProgressBar />
        <div className="header">
          <h1 className="title">3 roteiros sugeridos</h1>
          <p className="subtitle">Clica num roteiro pra trabalhar com ele.</p>
        </div>

        {roteiros.map(r => {
          const completed = completedRoteiroIds.includes(r.id);
          return (
            <div
              key={r.id}
              className="card"
              onClick={() => !completed && handleSelectRoteiro(r)}
              style={{
                cursor: completed ? 'default' : 'pointer',
                opacity: completed ? 0.5 : 1,
                borderColor: completed ? 'var(--gb)' : 'var(--bd)',
                background: completed ? 'var(--gd)' : 'var(--sf)',
              }}
            >
              <div className="card-header-row">
                <h3 className="card-title">{r.sceneName}</h3>
                {completed
                  ? <span className="pill">✓ Concluído</span>
                  : <span className="pill" style={{color: 'var(--g)'}}>Selecionar →</span>}
              </div>
              <p style={{fontSize: 14, color: 'var(--t)', marginBottom: 14}}>{r.description}</p>
              {r.movementPlan && (
                <div style={{
                  background: 'rgba(212,165,116,0.06)',
                  border: '1px solid rgba(212,165,116,0.2)',
                  borderRadius: 'var(--rs)',
                  padding: 12,
                  marginBottom: 12,
                }}>
                  <div style={{fontSize: 10, color: 'var(--g)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, marginBottom: 8}}>🎬 Plano de movimento</div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--t)'}}>
                    <div><span style={{color: 'var(--t2)', fontSize: 11, fontWeight: 700, marginRight: 6}}>INÍCIO ▸</span>{r.movementPlan.inicio}</div>
                    <div><span style={{color: 'var(--t2)', fontSize: 11, fontWeight: 700, marginRight: 6}}>MEIO ▸</span>{r.movementPlan.transicao}</div>
                    <div><span style={{color: 'var(--g)', fontSize: 11, fontWeight: 700, marginRight: 6}}>CTA ▸</span>{r.movementPlan.cta}</div>
                  </div>
                </div>
              )}
              <div className="pills-row">
                <span className="pill">{r.hasBack ? '🎬 Movimento c/ costas' : '📸 Frontal puro'}</span>
                <span className="pill">${(r.estimatedCost + 1.68).toFixed(2)}</span>
              </div>
            </div>
          );
        })}

        {actionError && (<div className="error-box"><p>{actionError}</p></div>)}
      </div>
    );
  }

  // STAGE 6: Prompt frontal — mostra prompt + opções (Nano Banana ou anexar)
  if (stage === STAGE.PROMPT_FRONTAL) {
    return (
      <div className="container">
        <button className="back-btn" onClick={() => setStage(STAGE.ROTEIROS)} style={{marginBottom: 14}}>← Voltar pros roteiros</button>
        <ProgressBar />
        <div className="header">
          <h1 className="title">Prompt da imagem CTA frontal</h1>
          <p className="subtitle">Roteiro: <strong style={{color: 'var(--g)'}}>{activeRoteiro?.sceneName}</strong></p>
        </div>

        <div className="card">
          <div className="card-header-row">
            <h3 className="card-title">Prompt UGC frontal (CTA)</h3>
            <button className="back-btn" onClick={() => setEditingPromptFrontal(!editingPromptFrontal)} style={{fontSize: 11, padding: '4px 10px'}}>
              {editingPromptFrontal ? 'Pronto' : '✏️ Editar'}
            </button>
          </div>
          {editingPromptFrontal ? (
            <textarea
              value={promptFrontal}
              onChange={e => setPromptFrontal(e.target.value)}
              style={{width: '100%', minHeight: 240, fontSize: 12, fontFamily: 'monospace', padding: 12, background: 'var(--sf)', color: 'var(--t)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)'}}
            />
          ) : (
            <div style={{fontSize: 12, fontFamily: 'monospace', color: 'var(--t2)', whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto', padding: 12, background: 'var(--sf)', borderRadius: 'var(--rs)'}}>
              {promptFrontal || '(prompt vazio)'}
            </div>
          )}
          <p className="hint" style={{marginTop: 8}}>{promptFrontal.length} caracteres</p>
        </div>

        <div className="card">
          <h3 className="card-title">Como gerar a imagem?</h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            <button
              className="main-btn"
              onClick={handleGenerateFrontalNanoBanana}
              disabled={actionLoading || promptFrontal.length < 100}
            >🎨 Gerar via Nano Banana Pro · $0,15</button>

            <label className="upload-area" style={{minHeight: 60}}>
              <span>📎 Anexar imagem que eu gerei fora (Sora, Midjourney, etc) · grátis</span>
              <input type="file" accept="image/*" onChange={handleAttachFrontalExternal} style={{display: 'none'}} disabled={actionLoading} />
            </label>
          </div>
          {actionLoading && (<div className="loading-screen" style={{minHeight: 100, padding: 14}}><div className="spinner"></div><div className="loading-sub">{actionStatus}</div></div>)}
          {actionError && (<div className="error-box"><p>{actionError}</p></div>)}
        </div>
      </div>
    );
  }

  // STAGE 7: Revisar imagem frontal
  if (stage === STAGE.IMAGE_FRONTAL_REVIEW) {
    const lastAttempt = frontalAttempts[frontalAttempts.length - 1];
    return (
      <div className="container">
        <button className="back-btn" onClick={() => setStage(STAGE.PROMPT_FRONTAL)} style={{marginBottom: 14}}>← Voltar</button>
        <ProgressBar />
        <div className="header">
          <h1 className="title">Imagem CTA frontal</h1>
          <p className="subtitle">Tentativa {frontalAttempts.length} · {lastAttempt?.source === 'external' ? 'Imagem externa anexada' : 'Gerada via Nano Banana Pro'}</p>
        </div>

        {lastAttempt && (
          <div className="card">
            <img src={lastAttempt.imageUrl} alt="frontal" style={{width: '100%', borderRadius: 'var(--rs)', maxHeight: 600, objectFit: 'contain'}} />
          </div>
        )}

        {fidelityFront && (
          <div className="card" style={{borderColor: fidelityFront.overall === 'aprovado' ? 'var(--gb)' : '#cc7700'}}>
            <h3 className="card-title">🔍 Análise de fidelidade</h3>
            <p style={{fontSize: 13, marginBottom: 8}}><strong>Overall:</strong> {fidelityFront.overall}</p>
            <p style={{fontSize: 13, color: 'var(--t2)', marginBottom: 12}}>{fidelityFront.summary}</p>
            <div style={{fontSize: 12}}>
              {fidelityFront.checklist?.map((item, idx) => (
                <div key={idx} style={{padding: '4px 0', borderBottom: '1px solid var(--bd)'}}>
                  {item.status === 'ok' ? '✅' : item.status === 'divergente' ? '⚠️' : '➖'} <strong>{item.item}:</strong> <span style={{color: 'var(--t2)'}}>{item.detail}</span>
                </div>
              ))}
            </div>
            {fidelityFront.criticalIssues?.length > 0 && (
              <div style={{marginTop: 10, padding: 10, background: 'rgba(255,100,100,0.1)', borderRadius: 'var(--rs)'}}>
                <strong style={{color: '#ff8888'}}>Problemas críticos:</strong>
                <ul style={{fontSize: 12, marginTop: 4}}>{fidelityFront.criticalIssues.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        <div className="card">
          <h3 className="card-title">O que fazer com essa imagem?</h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
            <button className="main-btn" onClick={handleApproveFrontal} disabled={actionLoading}>✅ Aprovar e seguir pro próximo passo</button>
            {!fidelityFront && (<button className="back-btn" onClick={handleAnalyzeFidelityFrontal} disabled={actionLoading} style={{padding: 14}}>🔍 Analisar fidelidade do produto · $0,02</button>)}
            <RefazerButton onSubmit={handleRefazerFrontal} loading={actionLoading} />
          </div>
          {actionLoading && (<div className="loading-screen" style={{minHeight: 100, padding: 14}}><div className="spinner"></div><div className="loading-sub">{actionStatus}</div></div>)}
          {actionError && (<div className="error-box"><p>{actionError}</p></div>)}
        </div>

        {frontalAttempts.length > 1 && (
          <div className="card">
            <h3 className="card-title">Histórico ({frontalAttempts.length} tentativas)</h3>
            <div style={{display: 'flex', gap: 8, overflowX: 'auto'}}>
              {frontalAttempts.map((att, idx) => (
                <img key={idx} src={att.imageUrl} alt={`tentativa ${idx + 1}`} style={{width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--rs)', border: idx === frontalAttempts.length - 1 ? '2px solid var(--g)' : '1px solid var(--bd)'}} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // STAGE 8: Prompt costas (encadeado)
  if (stage === STAGE.PROMPT_BACK) {
    return (
      <div className="container">
        <button className="back-btn" onClick={() => setStage(STAGE.IMAGE_FRONTAL_REVIEW)} style={{marginBottom: 14}}>← Voltar</button>
        <ProgressBar />
        <div className="header">
          <h1 className="title">Prompt da imagem inicial (costas)</h1>
          <p className="subtitle">Gerado olhando a imagem frontal aprovada · garante consistência visual</p>
        </div>
        <div className="card">
          <div className="card-header-row">
            <h3 className="card-title">Prompt UGC costas/3-4</h3>
            <button className="back-btn" onClick={() => setEditingPromptBack(!editingPromptBack)} style={{fontSize: 11, padding: '4px 10px'}}>{editingPromptBack ? 'Pronto' : '✏️ Editar'}</button>
          </div>
          {editingPromptBack ? (
            <textarea value={promptBack} onChange={e => setPromptBack(e.target.value)} style={{width: '100%', minHeight: 240, fontSize: 12, fontFamily: 'monospace', padding: 12, background: 'var(--sf)', color: 'var(--t)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)'}} />
          ) : (
            <div style={{fontSize: 12, fontFamily: 'monospace', color: 'var(--t2)', whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto', padding: 12, background: 'var(--sf)', borderRadius: 'var(--rs)'}}>{promptBack || '(prompt vazio)'}</div>
          )}
          <p className="hint" style={{marginTop: 8}}>{promptBack.length} caracteres · referencia a imagem frontal aprovada</p>
        </div>
        <div className="card">
          <h3 className="card-title">Como gerar a imagem de costas?</h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            <button className="main-btn" onClick={handleGenerateBackNanoBanana} disabled={actionLoading || promptBack.length < 100}>🎨 Gerar via Nano Banana Pro · $0,15</button>
            <label className="upload-area" style={{minHeight: 60}}>
              <span>📎 Anexar imagem que eu gerei fora · grátis</span>
              <input type="file" accept="image/*" onChange={handleAttachBackExternal} style={{display: 'none'}} disabled={actionLoading} />
            </label>
          </div>
          {actionLoading && (<div className="loading-screen" style={{minHeight: 100, padding: 14}}><div className="spinner"></div><div className="loading-sub">{actionStatus}</div></div>)}
          {actionError && (<div className="error-box"><p>{actionError}</p></div>)}
        </div>
      </div>
    );
  }

  // STAGE 9: Revisar imagem costas
  if (stage === STAGE.IMAGE_BACK_REVIEW) {
    const lastAttempt = backAttempts[backAttempts.length - 1];
    return (
      <div className="container">
        <button className="back-btn" onClick={() => setStage(STAGE.PROMPT_BACK)} style={{marginBottom: 14}}>← Voltar</button>
        <ProgressBar />
        <div className="header">
          <h1 className="title">Imagem inicial (costas/3-4)</h1>
          <p className="subtitle">Tentativa {backAttempts.length} · {lastAttempt?.source === 'external' ? 'Imagem externa' : 'Nano Banana Pro'}</p>
        </div>
        {lastAttempt && (<div className="card"><img src={lastAttempt.imageUrl} alt="costas" style={{width: '100%', borderRadius: 'var(--rs)', maxHeight: 600, objectFit: 'contain'}} /></div>)}
        {fidelityBack && (
          <div className="card" style={{borderColor: fidelityBack.overall === 'aprovado' ? 'var(--gb)' : '#cc7700'}}>
            <h3 className="card-title">🔍 Análise de fidelidade</h3>
            <p style={{fontSize: 13, marginBottom: 8}}><strong>Overall:</strong> {fidelityBack.overall}</p>
            <p style={{fontSize: 13, color: 'var(--t2)', marginBottom: 12}}>{fidelityBack.summary}</p>
            <div style={{fontSize: 12}}>
              {fidelityBack.checklist?.map((item, idx) => (
                <div key={idx} style={{padding: '4px 0', borderBottom: '1px solid var(--bd)'}}>
                  {item.status === 'ok' ? '✅' : item.status === 'divergente' ? '⚠️' : '➖'} <strong>{item.item}:</strong> <span style={{color: 'var(--t2)'}}>{item.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="card">
          <h3 className="card-title">O que fazer com essa imagem?</h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
            <button className="main-btn" onClick={handleApproveBack} disabled={actionLoading}>✅ Aprovar e gerar vídeo</button>
            {!fidelityBack && (<button className="back-btn" onClick={handleAnalyzeFidelityBack} disabled={actionLoading} style={{padding: 14}}>🔍 Analisar fidelidade · $0,02</button>)}
            <RefazerButton onSubmit={handleRefazerBack} loading={actionLoading} />
          </div>
          {actionLoading && (<div className="loading-screen" style={{minHeight: 100, padding: 14}}><div className="spinner"></div><div className="loading-sub">{actionStatus}</div></div>)}
          {actionError && (<div className="error-box"><p>{actionError}</p></div>)}
        </div>
      </div>
    );
  }

  // STAGE 10: Gerando vídeo
  if (stage === STAGE.GENERATING_VIDEO) {
    return (
      <div className="container">
        <ProgressBar />
        <div className="loading-screen">
          <div className="spinner"></div>
          <div className="loading-title">Gerando vídeo Kling 15s</div>
          <div className="loading-sub">{actionStatus}</div>
          {actionError && (<div className="error-box"><p>{actionError}</p></div>)}
        </div>
      </div>
    );
  }

  // STAGE 11: Vídeo pronto
  if (stage === STAGE.VIDEO_DONE) {
    const remaining = roteiros.filter(r => !completedRoteiroIds.includes(r.id));
    const lastVideo = allVideos[allVideos.length - 1];
    return (
      <div className="container">
        <ProgressBar />
        <div className="header">
          <span className="badge">VTON · {completedRoteiroIds.length}/3</span>
          <h1 className="title">Vídeo {completedRoteiroIds.length} pronto!</h1>
          <p className="subtitle">{lastVideo?.roteiro?.sceneName}</p>
        </div>
        {lastVideo?.videoUrl && (
          <div className="card">
            <video src={lastVideo.videoUrl} controls autoPlay style={{width: '100%', borderRadius: 'var(--rs)'}} />
            <a href={lastVideo.videoUrl} download style={{display: 'inline-block', marginTop: 8, fontSize: 13, color: 'var(--g)'}}>⬇ Baixar vídeo</a>
          </div>
        )}
        {allVideos.length > 1 && (
          <div className="card">
            <h3 className="card-title">Todos os vídeos prontos ({allVideos.length})</h3>
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
              {allVideos.map((v, idx) => (
                <video key={idx} src={v.videoUrl} controls style={{width: 200, borderRadius: 'var(--rs)'}} />
              ))}
            </div>
          </div>
        )}
        <div className="card">
          {remaining.length > 0 ? (
            <>
              <h3 className="card-title">Próximos roteiros disponíveis</h3>
              <p className="hint">Tu já completou {completedRoteiroIds.length} de 3. Trabalhar mais?</p>
              <div style={{display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10}}>
                {remaining.map(r => (
                  <button key={r.id} className="back-btn" onClick={() => { handleNextRoteiro(); setActiveRoteiro(r); handleSelectRoteiro(r); }} style={{textAlign: 'left', padding: '12px 14px'}}>
                    🎬 {r.sceneName} · ${(r.estimatedCost + 1.68).toFixed(2)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{textAlign: 'center', padding: 20}}>
              <div style={{fontSize: 48, marginBottom: 10}}>🎉</div>
              <h3 className="card-title">Todos os 3 vídeos prontos!</h3>
              <p className="hint">Total gasto: ${cumulativeCost.toFixed(2)}</p>
            </div>
          )}
          <button className="main-btn" onClick={handleFinishSession} style={{marginTop: 16}}>Voltar pra home</button>
        </div>
      </div>
    );
  }

  return null;
}

// Componente de input pra refazer prompt com feedback
function RefazerButton({ onSubmit, loading }) {
  const [showInput, setShowInput] = useState(false);
  const [feedback, setFeedback] = useState('');
  return (
    <div>
      {showInput ? (
        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="O que está errado? Ex: 'fenda frontal não apareceu', 'tecido deveria ter brilho acetinado'"
            style={{width: '100%', minHeight: 80, fontSize: 13, padding: 10, background: 'var(--sf)', color: 'var(--t)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)'}}
            disabled={loading}
          />
          <div style={{display: 'flex', gap: 8}}>
            <button className="back-btn" onClick={() => { setShowInput(false); setFeedback(''); }} disabled={loading} style={{flex: 1, padding: 12}}>Cancelar</button>
            <button className="main-btn" onClick={() => { onSubmit(feedback); setShowInput(false); setFeedback(''); }} disabled={loading || feedback.trim().length < 5} style={{flex: 1}}>Refazer prompt com esse feedback</button>
          </div>
        </div>
      ) : (
        <button className="back-btn" onClick={() => setShowInput(true)} disabled={loading} style={{padding: 14, width: '100%'}}>✏️ Refazer prompt com feedback específico</button>
      )}
    </div>
  );
}
