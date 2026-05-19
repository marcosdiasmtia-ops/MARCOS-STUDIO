// src/PovOutput.jsx (v3.0 — migra POV pra Kling v3 Standard 15s/take)
//
// CHANGELOG v3.0 (18/05/2026):
//   🆕 MIGRAÇÃO PRA KLING V3 STANDARD 15s — peça final do pacote:
//      - submitPovKlingVideo agora passa `duration: '15'` (era '10').
//      - composePovFinal agora passa `takeDurationSeconds: 15` (era 10).
//      - StatusMessage atualizada de "Kling 2.6 Pro" pra "Kling v3 Standard".
//
//      MOTIVO: fix definitivo do "freeze frame no final do vídeo POV".
//      Vozes BR migradas em 13/05/2026 falam ~50% mais devagar que vozes
//      anglo, gerando áudios de 12-15s pras 25-30 palavras do voiceText.
//      Esses áudios estouravam o slot de 10s do Kling 2.6 Pro e o FFmpeg
//      compose estendia o último frame congelado em vez de truncar.
//      Slot de 15s comporta 35-45 palavras PT-BR confortavelmente.
//
//   📌 PIPELINE INTEIRO ATUALIZADO NESTA SESSÃO (18/05/2026):
//      1. api/pov-kling-generate.js v3.0 (endpoint Kling v3 Standard)
//      2. api/pov-compose-final.js v1.2 (default takeDurationSeconds=15)
//      3. api/pov-script.js v3.0 (voiceText recalibrado pra 35-45 palavras)
//      4. api/pov-kling-prompts.js v2.1 (refs "15 seconds" no system prompt)
//      5. src/data/pov-durations.js v2.0 (4 novas durações: 15/30/45/60)
//      6. src/PovOutput.jsx v3.0 (ESTE — orchestrator final liga tudo)
//
//   📌 Retrocompat:
//      - Pipeline ainda funciona se algum backend não estiver atualizado
//        (Kling v3 aceita duration='10' tb, compose aceita takeDur=10).
//      - Galeria com POVs antigos (durationId='20s' ou '40s') exibe '—'
//        no label da duração mas não quebra.
//
// CHANGELOG v2.0 (12/05/2026 — Plano v4, Sub-lote C2 — ÚLTIMO arquivo do plano!):
//   🆕 Solução A — `buildImagePrompt` REESCRITO:
//      Antes: reusava o klingPrompt (descrição de MOVIMENTO) e só adicionava
//      sufixo "static composition". Isso confundia o Nano Banana Pro a gerar
//      imagens com hint de movimento implícito.
//      Agora: compõe um prompt PRÓPRIO pra imagem-base, montado dos elementos
//      visuais do wizard (hands + type + scenario + style + imperfection +
//      secondary objects), com PREFIXO DE FIDELIDADE TOTAL DO PRODUTO no
//      início e "Static frame, cinematic product photography" no final. NÃO
//      reusa o klingPrompt.
//   🆕 Solução C — `sharedSeed` único entre takes (Plano v4):
//      Math.floor(Math.random() * 1e9) gerado UMA vez por pipeline e passado
//      pra todas as N chamadas paralelas de generatePovImageBase. Isso faz
//      o Nano Banana Pro gerar imagens com a MESMA paleta de cor, iluminação
//      e estética entre os N takes — consistência visual real.
//   🆕 Passa campos novos pros backends:
//      • generatePovScript: + intensityId (do wizardData)
//      • generatePovKlingPrompts: + imperfectionId, naturalExtra,
//        motionIntensity (derivado do typeId), secondaryObjects (computado
//        via mixSecondaryObjects)
//      • generatePovImageBase: + seed (sharedSeed)
//   🆕 UI do `renderComplete` EXPANDIDA pro schema v4 (com retrocompat):
//      • 3 descrições (vibes: descoberta/solucao/estetica) — Marcos escolhe
//      • 3 CTAs (strategies: direto/engajamento/fomo) — Marcos escolhe
//      • Tagline (5-8 palavras de posicionamento) — copyable
//      • Pacote CapCut: hookCapa, headline, 5 popCaptions, 3 suggestedComments
//      Detecção de POVs antigos da galeria (que tem só `description` singular):
//      se descriptions[] ou ctaVariants[] vier vazio, mostra apenas o legacy.
//   🆕 `packageData` salvo na galeria agora inclui TODOS os campos do v4
//      (descriptions, ctaVariants, tagline, capcut, intensityId, etc.).
//   🔁 Retrocompat 100% com POVs antigos da galeria: schema legacy
//      (description, ctaWritten singulares) ainda renderiza, só não mostra
//      as seções novas pra esses entries.
//
// CHANGELOG v1.0.3 (10/05/2026):
//   ✅ Salva productPhotoUrl e handsReferenceUrl no entry da galeria.
//   ✅ Aceita wizardData.productPhotoUrl pra pular re-upload (variação direta).
//
// CHANGELOG v1.0.2 (10/05/2026):
//   ✅ Modo voiced reescrito: 3 chamadas → 1 chamada via compose com timestamps.
//
// Componente que recebe wizardData consolidado (do PovWizard) e:
//   1. Dispara a pipeline POV completa (7 helpers em sequência/paralelo)
//   2. Mostra UI de progresso visual em tempo real
//   3. Quando termina, mostra tela final com vídeo + pacote postagem (v4 expandido)
//   4. Persiste resultado em localStorage (galeria do 3c)
//
// PIPELINE MODO SILENT (default) — 6 etapas:
//   1. generatePovScript        (audioMode: 'silent')
//   2. generatePovKlingPrompts
//   3. uploadToFal × 1-2        (produto + (se influencer) face)
//   4. generatePovImageBase × N (Promise.all com sharedSeed v4)
//   5. submitPovKlingVideo × N + polling × N (Promise.all)
//   6. composePovFinal stage='start' + polling
//
// PIPELINE MODO VOICED — adiciona:
//   - Passo 4.5 (paralelo): generatePovTTS × N (Promise.all)
//   - Passo 6 vira 1 chamada com tracks+timestamps
//
// PROPS:
//   wizardData: objeto consolidado do wizard (todos campos)
//   onStartNew: callback pra voltar pro wizard limpo
//   onSwitchTab: callback (não usado aqui, repassado pra placeholders)

import { useState, useEffect, useRef } from 'react';
import {
  generatePovScript,
  generatePovKlingPrompts,
  uploadToFal,
  generatePovImageBase,
  submitPovKlingVideo,
  generatePovTTS,
  composePovFinal,
  checkVideoStatus,
} from './api';
import { POV_TYPES } from './data/pov-types';
import { POV_SCENARIOS } from './data/pov-scenarios';
import { POV_HANDS } from './data/pov-hands';
import { POV_STYLES, POV_IMPERFECTIONS } from './data/pov-styles'; // 🆕 v2.0
import { POV_INTENSITIES } from './data/pov-intensities';          // 🆕 v2.0
import { POV_DURATIONS } from './data/pov-durations';
import { mixSecondaryObjects } from './data/pov-secondary-objects'; // 🆕 v2.0

const POV_GALLERY_KEY = 'marcos-studio-pov-gallery';
const KLING_POLL_INTERVAL_MS = 12000; // 12s
const KLING_POLL_MAX_ATTEMPTS = 35;   // ~7min max
const COMPOSE_POLL_INTERVAL_MS = 4000; // 4s
const COMPOSE_POLL_MAX_ATTEMPTS = 30;  // ~2min max

export default function PovOutput({ wizardData, onStartNew }) {
  // ── Phase machine ─────────────────────────────────────────────────────
  // 'starting' | 'generating' | 'complete' | 'failed'
  const [phase, setPhase] = useState('starting');

  // ── Estágio atual + mensagem visível ──────────────────────────────────
  const [stages, setStages] = useState([
    { id: 'script',     label: '📝 Roteiro',                status: 'pending' },
    { id: 'prompts',    label: '✍️  Prompts visuais',        status: 'pending' },
    { id: 'upload',     label: '📤 Upload do produto',      status: 'pending' },
    { id: 'images',     label: '🖼  Imagens-base',           status: 'pending' },
    { id: 'videos',     label: '🎬 Vídeos Kling',           status: 'pending' },
    { id: 'audios',     label: '🎙️  Narrações (Eleven v3)',   status: 'pending', skipIfSilent: true },
    { id: 'compose',    label: '🔧 Composição final',       status: 'pending' },
  ]);

  // ── Status individual por take (durante imagens + vídeos + áudios) ───
  // [{ takeNumber, imageStatus, videoStatus, audioStatus, imageUrl, videoUrl, audioUrl, error }]
  const [takes, setTakes] = useState([]);

  // ── Mensagem flash do que tá acontecendo ──────────────────────────────
  const [statusMessage, setStatusMessage] = useState('Iniciando geração...');

  // ── Resultado final (quando complete) ─────────────────────────────────
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);
  const [packageData, setPackageData] = useState(null);

  // ── Erro (se failed) ──────────────────────────────────────────────────
  const [error, setError] = useState(null);

  // ── Tempo decorrido ───────────────────────────────────────────────────
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef(Date.now());

  // ── Flag pra evitar dupla execução em StrictMode ──────────────────────
  const startedRef = useRef(false);

  // ── Helpers de update de stages e takes ───────────────────────────────
  function setStageStatus(stageId, status) {
    setStages((prev) => prev.map((s) => s.id === stageId ? { ...s, status } : s));
  }

  function updateTake(takeNumber, updates) {
    setTakes((prev) => prev.map((t) => t.takeNumber === takeNumber ? { ...t, ...updates } : t));
  }

  // ── Timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'generating') return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Dispara pipeline na montagem ──────────────────────────────────────
  useEffect(() => {
    if (startedRef.current) return; // proteção contra StrictMode
    startedRef.current = true;
    runPipeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // PIPELINE PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════
  async function runPipeline() {
    try {
      setPhase('generating');
      startTimeRef.current = Date.now();
      const isVoiced = wizardData.audioMode === 'voiced';
      const duration = POV_DURATIONS.find((d) => d.id === wizardData.durationId);
      if (!duration) throw new Error('Duração inválida');
      const N = duration.takes;

      // 🆕 v2.0 — Solução C do Plano v4: seed compartilhado entre todas as N
      // chamadas paralelas de generatePovImageBase pra garantir consistência
      // visual (mesma paleta, iluminação, estética) entre os takes.
      const sharedSeed = Math.floor(Math.random() * 1e9);
      console.log(`[PovOutput v2.0] sharedSeed=${sharedSeed} (Plano v4 Solução C)`);

      // 🆕 v2.0 — Pré-computa secondary objects (frontend computa, backend só consome).
      // mixSecondaryObjects mistura 1-2 da categoria + 1-2 do cenário com seed
      // derivado pra resultado reprodutível dentro do mesmo POV.
      const secondaryObjects = mixSecondaryObjects(
        wizardData.productCategoryId,
        wizardData.scenarioId,
        { count: 4, seed: sharedSeed }
      ) || [];

      // 🆕 v2.0 — motionIntensity derivada do typeId (cada tipo tem 1-5).
      const selectedType = POV_TYPES.find((t) => t.id === wizardData.typeId);
      const motionIntensity = selectedType?.motionIntensity || null;

      console.log(
        `[PovOutput v2.0] v4 features: imperfection=${wizardData.imperfectionId || '-'}, naturalExtra=${wizardData.naturalExtra}, intensity=${wizardData.intensityId || '-'}, motionIntensity=${motionIntensity}, secObjs=${secondaryObjects.length}`
      );

      // Cria slots dos takes
      const initialTakes = Array.from({ length: N }, (_, i) => ({
        takeNumber: i + 1,
        imageStatus: 'pending',
        videoStatus: 'pending',
        audioStatus: isVoiced ? 'pending' : null,
        imageUrl: null,
        videoUrl: null,
        audioUrl: null,
        error: null,
      }));
      setTakes(initialTakes);

      // ── ETAPA 1: Roteiro ─────────────────────────────────────────────
      setStatusMessage('📝 Gerando roteiro de N takes...');
      setStageStatus('script', 'in-progress');
      const scriptResult = await generatePovScript({
        productName: wizardData.productName,
        productDescription: wizardData.productDescription || undefined,
        productPrice: wizardData.productPrice || undefined,
        productOriginalPrice: wizardData.productOriginalPrice || undefined,
        categoryId: wizardData.productCategoryId,
        typeId: wizardData.typeId,
        scenarioId: wizardData.scenarioId,
        styleId: wizardData.styleId,
        durationId: wizardData.durationId,
        audioMode: wizardData.audioMode,
        voiceId: isVoiced ? wizardData.voiceId : undefined,
        // 🆕 v2.0 — Plano v4 (só envia se voiced + se tem intensidade)
        intensityId: isVoiced ? (wizardData.intensityId || undefined) : undefined,
        influencer: { name: wizardData.influencerName, gender: wizardData.influencerGender },
        trendData: wizardData.productViralTranscript || undefined,
      });
      if (!scriptResult.script || scriptResult.script.length !== N) {
        throw new Error(`Roteiro retornou ${scriptResult.script?.length} takes, esperado ${N}`);
      }
      setStageStatus('script', 'done');

      // ── ETAPA 2: Prompts Kling ───────────────────────────────────────
      setStatusMessage('✍️ Gerando prompts visuais pro Kling...');
      setStageStatus('prompts', 'in-progress');
      const handsConfig = {
        mode: wizardData.handsMode,
        handsId: wizardData.handsMode === 'anonymous' ? wizardData.handsId : undefined,
        gender: wizardData.influencerGender,
      };
      const promptsResult = await generatePovKlingPrompts({
        script: scriptResult.script,
        typeId: wizardData.typeId,
        scenarioId: wizardData.scenarioId,
        styleId: wizardData.styleId,
        handsConfig,
        productName: wizardData.productName,
        productDescription: wizardData.productDescription || undefined,
        productPhotoBase64: wizardData.productPhotoBase64,
        productPhotoMimeType: wizardData.productPhotoMimeType,
        // 🆕 v2.0 — Plano v4 (todos opcionais)
        imperfectionId: wizardData.imperfectionId || undefined,
        naturalExtra: wizardData.naturalExtra === true,
        motionIntensity: motionIntensity || undefined,
        secondaryObjects: secondaryObjects.length > 0 ? secondaryObjects : undefined,
      });
      if (!promptsResult.prompts || promptsResult.prompts.length !== N) {
        throw new Error(`Prompts Kling retornou ${promptsResult.prompts?.length}, esperado ${N}`);
      }
      setStageStatus('prompts', 'done');

      // ── ETAPA 3: Upload pra fal.ai ───────────────────────────────────
      // 3c: se já vier URL no wizardData (variação da galeria), reusa.
      // Senão faz upload do base64 normalmente.
      setStageStatus('upload', 'in-progress');
      let productPhotoUrl = wizardData.productPhotoUrl || null;
      let handsReferenceUrl = wizardData.handsReferenceUrl || null;

      if (!productPhotoUrl) {
        setStatusMessage('📤 Enviando produto pra fal.ai...');
        if (!wizardData.productPhotoBase64) {
          throw new Error('Sem foto do produto: nem URL nem base64 fornecidos. Volte ao wizard e faça upload.');
        }
        productPhotoUrl = await uploadToFal(
          wizardData.productPhotoBase64,
          wizardData.productPhotoMimeType,
          'pov-product.png'
        );
      } else {
        setStatusMessage('♻️ Reusando produto da galeria...');
      }

      if (!handsReferenceUrl && wizardData.handsMode === 'influencer' && wizardData.influencerFaceBase64) {
        handsReferenceUrl = await uploadToFal(
          wizardData.influencerFaceBase64,
          wizardData.influencerFaceMimeType || 'image/jpeg',
          'pov-face-ref.jpg'
        );
      }
      setStageStatus('upload', 'done');

      // ── ETAPA 4: Imagens-base (paralelo) ─────────────────────────────
      setStatusMessage(`🖼 Gerando ${N} imagens-base em paralelo (seed=${sharedSeed})...`);
      setStageStatus('images', 'in-progress');
      // 🆕 v2.0 — Pré-computa o secondaryObjects como string pra reusar no
      // buildImagePrompt (não precisa recalcular pra cada take).
      const secondaryObjectsStr = secondaryObjects.length > 0
        ? secondaryObjects.join(', ')
        : '';

      const imagePromises = promptsResult.prompts.map(async (p, idx) => {
        const takeNumber = idx + 1;
        updateTake(takeNumber, { imageStatus: 'in-progress' });
        try {
          // 🆕 v2.0 — Solução A: prompt PRÓPRIO pra imagem-base (não reusa
          // o klingPrompt que é descrição de movimento). Compõe a partir
          // dos elementos visuais do wizard com prefixo de fidelidade.
          const imgPrompt = buildImagePrompt(wizardData, secondaryObjectsStr);
          const result = await generatePovImageBase({
            productPhotoUrl,
            handsReferenceUrl: handsReferenceUrl || undefined,
            prompt: imgPrompt,
            takeNumber,
            // 🆕 v2.0 — Solução C: mesmo seed pra todas as N chamadas
            seed: sharedSeed,
          });
          updateTake(takeNumber, { imageStatus: 'done', imageUrl: result.imageUrl });
          return { takeNumber, imageUrl: result.imageUrl };
        } catch (err) {
          updateTake(takeNumber, { imageStatus: 'failed', error: err.message });
          throw err;
        }
      });
      const imageResults = await Promise.all(imagePromises);
      setStageStatus('images', 'done');

      // ── ETAPA 5a: Submeter vídeos Kling (paralelo) + polling ─────────
      setStatusMessage(`🎬 Submetendo ${N} vídeos ao Kling v3 Standard...`);
      setStageStatus('videos', 'in-progress');
      const videoSubmissions = await Promise.all(
        promptsResult.prompts.map(async (p, idx) => {
          const takeNumber = idx + 1;
          const startImageUrl = imageResults[idx].imageUrl;
          updateTake(takeNumber, { videoStatus: 'submitted' });
          const sub = await submitPovKlingVideo({
            prompt: p.klingPrompt,
            startImageUrl,
            duration: '15',
            generateAudio: false,
            takeNumber,
          });
          updateTake(takeNumber, { videoStatus: 'in-progress' });
          return { takeNumber, ...sub };
        })
      );

      setStatusMessage(`⏳ Kling renderizando ${N} vídeos (2-7min cada). Pode pegar um café ☕`);
      const videoPromises = videoSubmissions.map(async (sub) => {
        try {
          const result = await pollUntilComplete(
            sub,
            { intervalMs: KLING_POLL_INTERVAL_MS, maxAttempts: KLING_POLL_MAX_ATTEMPTS }
          );
          const url = result?.video?.url;
          if (!url) throw new Error('Kling retornou sem URL de vídeo');
          updateTake(sub.takeNumber, { videoStatus: 'done', videoUrl: url });
          return { takeNumber: sub.takeNumber, videoUrl: url };
        } catch (err) {
          updateTake(sub.takeNumber, { videoStatus: 'failed', error: err.message });
          throw new Error(`Take ${sub.takeNumber}: ${err.message}`);
        }
      });

      // ── ETAPA 5b (PARALELO se voiced): Gerar áudios ──────────────────
      let audioPromise = Promise.resolve([]);
      if (isVoiced) {
        setStageStatus('audios', 'in-progress');
        audioPromise = Promise.all(
          scriptResult.script.map(async (take) => {
            const tn = take.takeNumber;
            updateTake(tn, { audioStatus: 'in-progress' });
            try {
              if (!take.voiceText) {
                throw new Error('Roteiro sem voiceText');
              }
              const result = await generatePovTTS({
                text: take.voiceText,
                voiceId: wizardData.voiceId,
                takeNumber: tn,
              });
              updateTake(tn, { audioStatus: 'done', audioUrl: result.audioUrl });
              return { takeNumber: tn, audioUrl: result.audioUrl };
            } catch (err) {
              updateTake(tn, { audioStatus: 'failed', error: err.message });
              throw err;
            }
          })
        );
      }

      const [videoResults, audioResults] = await Promise.all([
        Promise.all(videoPromises),
        audioPromise,
      ]);

      setStageStatus('videos', 'done');
      if (isVoiced) setStageStatus('audios', 'done');

      // ── ETAPA 6: Compose final stateful ─────────────────────────────
      setStageStatus('compose', 'in-progress');
      const sortedVideos = [...videoResults].sort((a, b) => a.takeNumber - b.takeNumber);
      const videoUrls = sortedVideos.map((v) => v.videoUrl);

      let finalUrl;
      if (!isVoiced) {
        // Modo silent: 1 chamada
        setStatusMessage('🔧 Concatenando vídeos via FFmpeg...');
        const sub = await composePovFinal({ stage: 'start', videoUrls });
        const result = await pollUntilComplete(sub, {
          intervalMs: COMPOSE_POLL_INTERVAL_MS,
          maxAttempts: COMPOSE_POLL_MAX_ATTEMPTS,
        });
        finalUrl = result?.video?.url;
      } else {
        // Modo voiced (v1.1): 1 chamada só via fal-ai/ffmpeg-api/compose
        // com tracks + timestamps explícitos por take. Sync perfeito.
        // (Antes era 3 chamadas: merge-videos → merge-audios → merge-audio-video,
        //  que dessincronizava porque -shortest cortava vídeo pelo áudio.)
        const sortedAudios = [...audioResults].sort((a, b) => a.takeNumber - b.takeNumber);
        const audioUrls = sortedAudios.map((a) => a.audioUrl);

        setStatusMessage('🔧 Mesclando vídeo + áudio com timestamps sincronizados...');
        const sub = await composePovFinal({
          stage: 'start',
          videoUrls,
          audioUrls,
          takeDurationSeconds: 15, // Kling v3 Standard: cada take = 15s
        });
        const result = await pollUntilComplete(sub, {
          intervalMs: COMPOSE_POLL_INTERVAL_MS,
          maxAttempts: COMPOSE_POLL_MAX_ATTEMPTS,
        });
        finalUrl = result?.video_url || result?.video?.url;
      }

      if (!finalUrl) throw new Error('Composição não retornou URL final');
      setStageStatus('compose', 'done');

      // ── SUCESSO ──────────────────────────────────────────────────────
      const pkg = {
        // Legacy (retrocompat com galeria antiga + PovOutput pré-v2.0)
        description: scriptResult.description,
        hashtags: scriptResult.hashtags,
        ctaWritten: scriptResult.ctaWritten,
        script: scriptResult.script,
        musicSuggestion: wizardData.musicSuggestion || null,
        // 🆕 v2.0 — Plano v4: schema expandido
        descriptions: scriptResult.descriptions || null,    // [{vibe, text}, ...]
        ctaVariants:  scriptResult.ctaVariants  || null,    // [{strategy, text}, ...]
        tagline:      scriptResult.tagline      || null,    // string
        capcut:       scriptResult.capcut       || null,    // {hookCapa, headline, popCaptions, suggestedComments}
        intensityId:  scriptResult.intensityId  || null,    // se voiced + intensidade
      };
      setFinalVideoUrl(finalUrl);
      setPackageData(pkg);
      setPhase('complete');
      setStatusMessage('✨ Vídeo POV pronto!');

      // Persiste em localStorage pra galeria do 3c
      // IMPORTANTE: inclui productPhotoUrl e handsReferenceUrl pra permitir
      // "🔁 Gerar variação" sem precisar de re-upload da foto.
      const wizardDataForGallery = {
        ...pickSerializable(wizardData),
        productPhotoUrl,
        handsReferenceUrl: handsReferenceUrl || null,
      };
      savePovToGallery({
        id: `pov_${Date.now()}`,
        createdAt: new Date().toISOString(),
        finalVideoUrl: finalUrl,
        wizardData: wizardDataForGallery,
        packageData: pkg,
        takesData: sortedVideos,
      });
    } catch (err) {
      console.error('[PovOutput] pipeline falhou:', err);
      setError(err.message || String(err));
      setPhase('failed');
      setStatusMessage(`❌ Erro: ${err.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POLLING HELPER
  // ═══════════════════════════════════════════════════════════════════════
  async function pollUntilComplete(submission, { intervalMs, maxAttempts }) {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await checkVideoStatus(
        submission.requestId,
        submission.endpoint,
        submission.statusUrl,
        submission.responseUrl
      );
      if (status.status === 'COMPLETED') return status.result;
      if (status.status === 'FAILED' || status.status === 'ERROR') {
        throw new Error(`fal.ai retornou ${status.status}: ${JSON.stringify(status).substring(0, 200)}`);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Polling timeout após ${maxAttempts} tentativas (~${Math.round(maxAttempts * intervalMs / 60000)}min)`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  if (phase === 'generating' || phase === 'starting') {
    return renderGenerating();
  }
  if (phase === 'failed') {
    return renderFailed();
  }
  if (phase === 'complete') {
    return renderComplete();
  }
  return null;

  // ── RENDER: GERANDO ──────────────────────────────────────────────────
  function renderGenerating() {
    const isVoiced = wizardData.audioMode === 'voiced';
    const visibleStages = stages.filter((s) => !s.skipIfSilent || isVoiced);
    const completedCount = visibleStages.filter((s) => s.status === 'done').length;
    const totalCount = visibleStages.length;
    const overallPercent = Math.round((completedCount / totalCount) * 100);

    return (
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>
            <span className="spinner" style={{
              display: 'inline-block',
              width: 48,
              height: 48,
              border: '3px solid rgba(212,165,116,0.2)',
              borderTopColor: 'var(--g)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
          </div>
          <h2 style={{ fontSize: 18, color: 'var(--g)', marginBottom: 8, fontWeight: 700 }}>
            Gerando seu POV...
          </h2>
          <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 4 }}>
            {statusMessage}
          </p>
          <p style={{ fontSize: 11, color: 'var(--t3)' }}>
            ⏱ {formatTime(elapsedSeconds)} decorridos · estimativa total: 5-10 min
          </p>
        </div>

        {/* Barra de progresso geral */}
        <div style={{
          height: 6,
          background: 'var(--bd)',
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 20,
        }}>
          <div style={{
            height: '100%',
            background: 'linear-gradient(90deg, var(--g), #c08f5c)',
            width: `${overallPercent}%`,
            transition: 'width 0.5s',
          }} />
        </div>

        {/* Lista de etapas */}
        <div style={{
          background: 'var(--cd)',
          border: '1px solid var(--bd)',
          borderRadius: 'var(--rs)',
          padding: 14,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Etapas
          </div>
          {visibleStages.map((s) => (
            <div key={s.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 0',
              fontSize: 13,
              color: s.status === 'done' ? 'var(--gr)'
                : s.status === 'in-progress' ? 'var(--g)'
                : s.status === 'failed' ? '#ff6b6b'
                : 'var(--t3)',
            }}>
              <span style={{ width: 16, textAlign: 'center' }}>
                {s.status === 'done' ? '✓'
                  : s.status === 'in-progress' ? '⏳'
                  : s.status === 'failed' ? '✗'
                  : '○'}
              </span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Lista de takes (durante imagens/vídeos/áudios) */}
        {takes.length > 0 && (
          <div style={{
            background: 'var(--sf)',
            border: '1px solid var(--bd)',
            borderRadius: 'var(--rs)',
            padding: 14,
          }}>
            <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Takes ({takes.length})
            </div>
            {takes.map((t) => (
              <div key={t.takeNumber} style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 1fr ' + (isVoiced ? '1fr' : ''),
                gap: 8,
                fontSize: 11,
                padding: '6px 0',
                borderBottom: '1px solid var(--bd)',
                color: 'var(--t)',
              }}>
                <span style={{ color: 'var(--t2)', fontWeight: 600 }}>Take {t.takeNumber}:</span>
                <TakeStatusPill label="🖼" status={t.imageStatus} />
                <TakeStatusPill label="🎬" status={t.videoStatus} />
                {isVoiced && <TakeStatusPill label="🎙️" status={t.audioStatus} />}
              </div>
            ))}
          </div>
        )}

        <p className="hint" style={{ textAlign: 'center', marginTop: 16, fontSize: 11 }}>
          ⚠️ Não feche esta aba enquanto o vídeo é gerado.
          O Kling v3 Standard leva 2-7min por take pra renderizar.
        </p>
      </div>
    );
  }

  // ── RENDER: FALHOU ───────────────────────────────────────────────────
  function renderFailed() {
    const completedTakes = takes.filter((t) => t.videoUrl);
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>❌</div>
          <h2 style={{ fontSize: 18, color: '#ff6b6b', marginBottom: 12, fontWeight: 700 }}>
            Geração falhou
          </h2>
          <div className="error-box" style={{ maxWidth: 460, margin: '0 auto 20px' }}>
            <p>{error}</p>
          </div>
        </div>

        {completedTakes.length > 0 && (
          <div style={{
            background: 'var(--blb)',
            border: '1px solid rgba(139,184,232,0.25)',
            borderRadius: 'var(--rs)',
            padding: 14,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, color: 'var(--bl)', fontWeight: 700, marginBottom: 8 }}>
              ℹ️ {completedTakes.length} take(s) foram gerados antes do erro
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>
              Você pode baixar manualmente e juntar no CapCut. URLs dos vídeos:
            </div>
            <ul style={{ marginTop: 8, paddingLeft: 20, fontSize: 11, color: 'var(--bl)' }}>
              {completedTakes.map((t) => (
                <li key={t.takeNumber} style={{ marginBottom: 4 }}>
                  Take {t.takeNumber}:{' '}
                  <a href={t.videoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--bl)' }}>
                    Abrir vídeo
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          className="main-btn"
          onClick={onStartNew}
          style={{ marginTop: 8 }}
        >
          ← Voltar pro wizard
        </button>
      </div>
    );
  }

  // ── RENDER: COMPLETO ─────────────────────────────────────────────────
  function renderComplete() {
    return (
      <div>
        {/* Header de sucesso */}
        <div className="card" style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <h2 style={{ fontSize: 18, color: 'var(--g)', marginBottom: 6, fontWeight: 700 }}>
            Vídeo POV pronto!
          </h2>
          <p style={{ fontSize: 12, color: 'var(--t2)' }}>
            ⏱ Levou {formatTime(elapsedSeconds)} ·{' '}
            {takes.length} take(s) ·{' '}
            modo {wizardData.audioMode === 'voiced' ? 'com voz' : 'silencioso'}
          </p>
        </div>

        {/* Player de vídeo */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <video
            controls
            autoPlay
            muted
            loop
            playsInline
            src={finalVideoUrl}
            style={{ width: '100%', display: 'block', background: '#000', maxHeight: 600 }}
          />
        </div>

        {/* Ações primárias */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a
              href={finalVideoUrl}
              download={`pov-${wizardData.influencerName?.toLowerCase() || 'video'}-${Date.now()}.mp4`}
              target="_blank"
              rel="noopener noreferrer"
              className="main-btn"
              style={{
                flex: 1,
                minWidth: 140,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              📥 Baixar MP4
            </a>
            <button
              className="secondary-btn"
              onClick={onStartNew}
              style={{ flex: 1, minWidth: 140 }}
            >
              ✨ Novo POV
            </button>
          </div>
          <p className="hint" style={{ textAlign: 'center', marginTop: 12, fontSize: 11 }}>
            🖼 Galeria persistente + variação 1-clique vêm no Sub-lote 3c.
          </p>
        </div>

        {/* Pacote de postagem (v2.0 expandido com retrocompat) */}
        {packageData && (
          <>
            {/* 🆕 v2.0 — Tagline (frase de posicionamento) */}
            {packageData.tagline && (
              <CopyableSection
                title="✨ Tagline (posicionamento)"
                text={packageData.tagline}
              />
            )}

            {/* 🆕 v2.0 — 3 Descrições com vibes (Plano v4) */}
            {Array.isArray(packageData.descriptions) && packageData.descriptions.length > 0 ? (
              <div className="card">
                <div className="card-title">📝 Descrições (escolha a vibe)</div>
                <p className="hint" style={{ marginBottom: 12, fontSize: 12 }}>
                  3 versões com vibes diferentes pro caption do TikTok. Cada uma testada pra um momento.
                </p>
                {packageData.descriptions.map((d, idx) => (
                  <DescriptionCard
                    key={idx}
                    vibe={d.vibe}
                    text={d.text}
                  />
                ))}
              </div>
            ) : (
              // Retrocompat: POVs antigos só têm description singular
              <CopyableSection
                title="📝 Descrição (TikTok)"
                text={packageData.description}
              />
            )}

            {/* Hashtags */}
            <CopyableSection
              title="#️⃣ Hashtags"
              text={(packageData.hashtags || []).map((h) => h.startsWith('#') ? h : `#${h}`).join(' ')}
            />

            {/* 🆕 v2.0 — 3 CTAs com strategies (Plano v4) */}
            {Array.isArray(packageData.ctaVariants) && packageData.ctaVariants.length > 0 ? (
              <div className="card">
                <div className="card-title">📣 CTAs (escolha a estratégia)</div>
                <p className="hint" style={{ marginBottom: 12, fontSize: 12 }}>
                  3 versões com estratégias diferentes. Direto pra venda, conversacional pra engajamento, ou FOMO pra urgência.
                </p>
                {packageData.ctaVariants.map((c, idx) => (
                  <CtaCard
                    key={idx}
                    strategy={c.strategy}
                    text={c.text}
                  />
                ))}
              </div>
            ) : (
              // Retrocompat: POVs antigos só têm ctaWritten singular
              <CopyableSection
                title="📣 CTA escrito"
                text={packageData.ctaWritten || ''}
              />
            )}

            {/* 🆕 v2.0 — Pacote CapCut (Plano v4) */}
            {packageData.capcut && (
              <div className="card">
                <div className="card-title">🎬 Pacote CapCut</div>
                <p className="hint" style={{ marginBottom: 14, fontSize: 12 }}>
                  Pacote pronto pra colar no CapCut: hook da capa, headline, captions pop e comentários pra seeding.
                </p>

                {packageData.capcut.hookCapa && (
                  <CapcutItem
                    label="🎯 Hook da capa (3-5 palavras)"
                    text={packageData.capcut.hookCapa}
                  />
                )}

                {packageData.capcut.headline && (
                  <CapcutItem
                    label="📰 Headline do vídeo"
                    text={packageData.capcut.headline}
                  />
                )}

                {Array.isArray(packageData.capcut.popCaptions) && packageData.capcut.popCaptions.length > 0 && (
                  <CapcutListSection
                    label="💬 Captions pop (5 stickers pra colar no vídeo)"
                    items={packageData.capcut.popCaptions}
                  />
                )}

                {Array.isArray(packageData.capcut.suggestedComments) && packageData.capcut.suggestedComments.length > 0 && (
                  <CapcutListSection
                    label="👥 Comentários sugeridos (seeding inicial)"
                    items={packageData.capcut.suggestedComments}
                    hint="Posta esses como primeira interação na publicação."
                  />
                )}
              </div>
            )}

            {/* Música sugerida */}
            {packageData.musicSuggestion && (
              <div className="card">
                <div className="card-title">🎵 Música sugerida</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {packageData.musicSuggestion.comercial && (
                    <div style={{
                      background: 'var(--blb)',
                      border: '1px solid rgba(139,184,232,0.25)',
                      borderRadius: 'var(--rs)',
                      padding: 12,
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--bl)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>
                        🎵 Comercial
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--t)' }}>
                        {packageData.musicSuggestion.comercial.mood} ·{' '}
                        {packageData.musicSuggestion.comercial.genre} ·{' '}
                        {packageData.musicSuggestion.comercial.bpm} BPM
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
                        Buscar: {(packageData.musicSuggestion.comercial.searchTerms || []).join(', ')}
                      </div>
                    </div>
                  )}
                  {packageData.musicSuggestion.viral && (
                    <div style={{
                      background: 'rgba(255,80,150,0.08)',
                      border: '1px solid rgba(255,80,150,0.25)',
                      borderRadius: 'var(--rs)',
                      padding: 12,
                    }}>
                      <div style={{ fontSize: 10, color: '#ff6b9d', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>
                        🔥 Viral
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--t)' }}>
                        <strong>{packageData.musicSuggestion.viral.title}</strong>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>
                        {packageData.musicSuggestion.viral.artist}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Roteiro completo (frases on-screen + voiceText) */}
            {packageData.script && packageData.script.length > 0 && (
              <div className="card">
                <div className="card-title">🎬 Roteiro por take</div>
                {packageData.script.map((take) => (
                  <div key={take.takeNumber} style={{
                    background: 'var(--sf)',
                    border: '1px solid var(--bd)',
                    borderRadius: 'var(--rs)',
                    padding: 12,
                    marginBottom: 8,
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--g)', fontWeight: 700, marginBottom: 6 }}>
                      Take {take.takeNumber} {take.purpose && <span style={{ color: 'var(--t3)', fontWeight: 400 }}>· {take.purpose}</span>}
                    </div>
                    {take.voiceText && (
                      <div style={{ fontSize: 12, color: 'var(--t)', marginBottom: 4 }}>
                        🎙️ <em>{take.voiceText}</em>
                      </div>
                    )}
                    {take.onScreenPhrase && (
                      <div style={{ fontSize: 12, color: 'var(--bl)', fontWeight: 600 }}>
                        📺 "{take.onScreenPhrase}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }
}

// ════════════════════════════════════════════════════════════════════════
// Componentes auxiliares
// ════════════════════════════════════════════════════════════════════════

function TakeStatusPill({ label, status }) {
  const colors = {
    'pending': { bg: 'var(--bd)', fg: 'var(--t3)', icon: '○' },
    'in-progress': { bg: 'rgba(212,165,116,0.15)', fg: 'var(--g)', icon: '⏳' },
    'submitted': { bg: 'rgba(139,184,232,0.15)', fg: 'var(--bl)', icon: '↑' },
    'done': { bg: 'rgba(107,189,138,0.15)', fg: 'var(--gr)', icon: '✓' },
    'failed': { bg: 'rgba(255,107,107,0.15)', fg: '#ff6b6b', icon: '✗' },
  };
  if (!status) return <span />;
  const c = colors[status] || colors.pending;
  return (
    <span style={{
      background: c.bg,
      color: c.fg,
      padding: '2px 8px',
      borderRadius: 10,
      fontSize: 10,
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
    }}>
      {label} {c.icon}
    </span>
  );
}

function CopyableSection({ title, text }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  function handleCopy() {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="card">
      <div className="card-header-row">
        <div className="card-title">{title}</div>
        <button
          className="copy-btn"
          onClick={handleCopy}
          data-copied={copied ? 'true' : 'false'}
        >
          {copied ? '✓ Copiado' : '📋 Copiar'}
        </button>
      </div>
      <pre className="code-content" style={{ maxHeight: 200 }}>{text}</pre>
    </div>
  );
}

// 🆕 v2.0 — Componentes auxiliares pro pacote expandido (Plano v4)

// Card de descrição com vibe (descoberta/solucao/estetica)
function DescriptionCard({ vibe, text }) {
  const [copied, setCopied] = useState(false);
  const VIBE_META = {
    descoberta: { emoji: '🌟', label: 'Descoberta', color: 'rgba(212,165,116,0.15)', border: 'rgba(212,165,116,0.4)', fg: 'var(--g)' },
    solucao:    { emoji: '💡', label: 'Solução',    color: 'rgba(139,184,232,0.15)', border: 'rgba(139,184,232,0.4)', fg: 'var(--bl)' },
    estetica:   { emoji: '✨', label: 'Estética',   color: 'rgba(255,80,150,0.10)',  border: 'rgba(255,80,150,0.4)',  fg: '#ff6b9d' },
  };
  const meta = VIBE_META[vibe] || VIBE_META.descoberta;
  function handleCopy() {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div style={{
      background: meta.color,
      border: `1px solid ${meta.border}`,
      borderRadius: 'var(--rs)',
      padding: 12,
      marginBottom: 8,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: meta.fg, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {meta.emoji} Vibe: {meta.label}
        </div>
        <button
          className="copy-btn"
          onClick={handleCopy}
          style={{ padding: '3px 10px', fontSize: 11 }}
          data-copied={copied ? 'true' : 'false'}
        >
          {copied ? '✓ Copiado' : '📋 Copiar'}
        </button>
      </div>
      <div style={{ fontSize: 13, color: 'var(--t)', lineHeight: 1.5 }}>
        {text}
      </div>
    </div>
  );
}

// Card de CTA com strategy (direto/engajamento/fomo)
function CtaCard({ strategy, text }) {
  const [copied, setCopied] = useState(false);
  const STRATEGY_META = {
    direto:      { emoji: '🎯', label: 'Direto',      color: 'rgba(107,189,138,0.12)', border: 'rgba(107,189,138,0.4)', fg: 'var(--gr)' },
    engajamento: { emoji: '💬', label: 'Engajamento', color: 'rgba(139,184,232,0.12)', border: 'rgba(139,184,232,0.4)', fg: 'var(--bl)' },
    fomo:        { emoji: '🔥', label: 'FOMO',        color: 'rgba(255,107,107,0.10)', border: 'rgba(255,107,107,0.4)', fg: '#ff6b6b' },
  };
  const meta = STRATEGY_META[strategy] || STRATEGY_META.direto;
  function handleCopy() {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div style={{
      background: meta.color,
      border: `1px solid ${meta.border}`,
      borderRadius: 'var(--rs)',
      padding: 12,
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: meta.fg, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {meta.emoji} Estratégia: {meta.label}
        </div>
        <button
          className="copy-btn"
          onClick={handleCopy}
          style={{ padding: '3px 10px', fontSize: 11 }}
          data-copied={copied ? 'true' : 'false'}
        >
          {copied ? '✓ Copiado' : '📋 Copiar'}
        </button>
      </div>
      <div style={{ fontSize: 13, color: 'var(--t)', lineHeight: 1.5 }}>
        {text}
      </div>
    </div>
  );
}

// Item simples do pacote CapCut (hookCapa, headline)
function CapcutItem({ label, text }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div style={{
      background: 'var(--sf)',
      border: '1px solid var(--bd)',
      borderRadius: 'var(--rs)',
      padding: 10,
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--t)', fontWeight: 600 }}>
          {text}
        </div>
      </div>
      <button
        className="copy-btn"
        onClick={handleCopy}
        style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}
        data-copied={copied ? 'true' : 'false'}
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  );
}

// Lista de itens copyable (popCaptions, suggestedComments)
function CapcutListSection({ label, items, hint }) {
  const [copiedIdx, setCopiedIdx] = useState(-1);
  function handleCopy(idx, text) {
    navigator.clipboard?.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(-1), 1500);
  }
  function handleCopyAll() {
    const allText = items.join('\n');
    navigator.clipboard?.writeText(allText);
    setCopiedIdx(-2); // -2 = "all"
    setTimeout(() => setCopiedIdx(-1), 1500);
  }
  return (
    <div style={{
      background: 'var(--sf)',
      border: '1px solid var(--bd)',
      borderRadius: 'var(--rs)',
      padding: 10,
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </div>
        <button
          className="copy-btn"
          onClick={handleCopyAll}
          style={{ padding: '3px 10px', fontSize: 10 }}
          data-copied={copiedIdx === -2 ? 'true' : 'false'}
        >
          {copiedIdx === -2 ? '✓ Tudo' : '📋 Tudo'}
        </button>
      </div>
      {hint && (
        <p style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 8, fontStyle: 'italic' }}>
          {hint}
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleCopy(idx, item)}
            title="Clique pra copiar"
            style={{
              background: copiedIdx === idx ? 'rgba(107,189,138,0.2)' : 'var(--cd)',
              border: `1px solid ${copiedIdx === idx ? 'rgba(107,189,138,0.5)' : 'var(--bd)'}`,
              borderRadius: 6,
              padding: '5px 10px',
              cursor: 'pointer',
              fontSize: 12,
              color: copiedIdx === idx ? 'var(--gr)' : 'var(--t)',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            {copiedIdx === idx ? '✓ ' : ''}{item}
          </button>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Helpers puros
// ════════════════════════════════════════════════════════════════════════

// 🆕 v2.0 — Solução A do Plano v4: prompt PRÓPRIO pra imagem-base.
//
// Versão antiga (v1.x) reusava o klingPrompt (descrição de MOVIMENTO) e só
// anexava "static composition" no final. Isso confundia o Nano Banana Pro
// a gerar imagens com hint de movimento implícito (motion blur, depth-of-field
// artificial, etc.), prejudicando a qualidade do frame-base usado pelo Kling.
//
// Esta versão compõe um prompt do ZERO a partir dos elementos visuais do
// wizard, em ordem semântica clara, com PREFIXO DE FIDELIDADE TOTAL DO
// PRODUTO no início (alinhado com Solução B já injetada no pov-kling-prompts).
//
// O backend pov-image-base.js valida structuralmente que o prompt tem markers
// de HANDS e PRODUCT, então o prompt aqui sempre os inclui de forma explícita.
function buildImagePrompt(wizardData, secondaryObjectsStr) {
  const FIDELITY_PREFIX =
    'Preserve the product exactly as shown in the reference image: same exact design, label, color, shape, materials, and branding. No alterations, no reinterpretation. Static frame for use as the first frame of a 10-second video.';

  // Resolve elementos visuais pelos data files do frontend
  const type = POV_TYPES.find((t) => t.id === wizardData.typeId);
  const scenario = POV_SCENARIOS.find((s) => s.id === wizardData.scenarioId);
  const style = POV_STYLES.find((s) => s.id === wizardData.styleId);
  const imperfection = wizardData.imperfectionId
    ? POV_IMPERFECTIONS.find((i) => i.id === wizardData.imperfectionId)
    : null;
  const hand = wizardData.handsMode === 'anonymous'
    ? POV_HANDS.find((h) => h.id === wizardData.handsId)
    : null;

  // Resolve textos visuais (inglês). Cada chave tem fallback.
  const typeHint = type?.promptHint || 'A hand interacting naturally with the product, product clearly visible.';
  const scenarioHint = scenario?.scenarioPrompt || 'Clean neutral background, professional lighting.';
  const styleHint = style?.cameraDirective || 'Balanced composition with the product centered.';
  const imperfectionHint = imperfection?.cameraDirective || '';

  // Mãos: anonymous usa promptHint do POV_HANDS; influencer descreve genericamente
  // (a foto do influencer já vai como 2ª imagem no payload).
  let handsHint;
  if (wizardData.handsMode === 'anonymous' && hand) {
    handsHint = hand.promptHint || 'Hands matching the selected style.';
  } else if (wizardData.handsMode === 'influencer') {
    const gender = wizardData.influencerGender === 'male' ? 'masculine' : 'feminine';
    handsHint = `Natural ${gender} hands consistent with the reference influencer face image provided, well-groomed nails, smooth skin texture.`;
  } else {
    handsHint = 'Hands holding or interacting with the product naturally.';
  }

  // Produto: nome + descrição curta (max 200 chars)
  const productInfo = `Product: ${wizardData.productName}${
    wizardData.productDescription
      ? ` — ${wizardData.productDescription.substring(0, 200)}`
      : ''
  }.`;

  // Objetos secundários (background contextual)
  const secondaryHint = secondaryObjectsStr
    ? `Background context (softly out of focus, not competing with the product): ${secondaryObjectsStr}.`
    : '';

  // Naturalidade extra (só se ON e imperfeição não a desabilita)
  // Reflete a lógica do PovWizard: se for níveis 4-6 de imperfeição,
  // o checkbox fica desabilitado e o estado deve estar false. Mas duplo-check aqui.
  const naturalNeedsExtra =
    wizardData.naturalExtra === true &&
    !['handheld_cru', 'iphone_caseiro', 'documentario'].includes(wizardData.imperfectionId);
  const naturalHint = naturalNeedsExtra
    ? 'Subtle natural handheld feel with slight imperfection in framing.'
    : '';

  // Composição final: prefixo de fidelidade primeiro, depois elementos
  // em ordem de importância visual, depois sufixo de "static frame".
  const parts = [
    FIDELITY_PREFIX,
    productInfo,
    `Hands: ${handsHint}`,
    `Interaction: ${typeHint}`,
    `Camera composition: ${styleHint}`,
    imperfectionHint ? `Visual style: ${imperfectionHint}` : '',
    `Environment: ${scenarioHint}`,
    secondaryHint,
    naturalHint,
    'Static frame, cinematic product photography style, sharp focus on the product, high detail, 9:16 aspect ratio.',
  ].filter(Boolean);

  return parts.join(' ');
}

function pickSerializable(wizardData) {
  // Retira campos pesados (base64) antes de salvar no localStorage
  const {
    productPhotoBase64, productPhotoMimeType,
    influencerFaceBase64, influencerFaceMimeType,
    ...rest
  } = wizardData;
  return rest;
}

function savePovToGallery(entry) {
  try {
    const raw = localStorage.getItem(POV_GALLERY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    // Limita a 50 entradas
    while (list.length > 50) list.pop();
    localStorage.setItem(POV_GALLERY_KEY, JSON.stringify(list));
    console.log('[PovOutput] salvo na galeria:', entry.id);
  } catch (err) {
    console.warn('[PovOutput] erro salvando na galeria:', err);
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
