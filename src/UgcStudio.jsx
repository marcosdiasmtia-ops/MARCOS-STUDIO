// src/UgcStudio.jsx (v1.2 — Sessão 4: Output polish + Galeria + Tutorial Veo + Transcrição viral)
//
// MUDANÇAS v1.2 (vs v1.1):
//   SESSÃO 4 — Polish completo:
//     FASE A — Step 7 (Output) polido + Tutorial Veo:
//       - ResultsView completamente reescrito com cards visuais
//       - Botão "📋 Copiar tudo" (junta script + descrição + hashtags formatado)
//       - Botão "↻ Gerar novamente" (re-roda pipeline com mesmas configs)
//       - Tutorial Veo Studio integrado (card destacado com 5 passos)
//       - Frame inicial com botão "📥 Baixar imagem"
//     FASE B — Galeria de variações 1-clique:
//       - 4 botões: 🎭 Outro estilo · 📍 Outro cenário · 📷 Outra câmera · 🔄 Mesmo tudo
//       - Volta pro step apropriado mantendo o resto da config
//     FASE C — Transcrição viral como base (diferencial vs Trendly):
//       - Campo collapsível no Step 2 ("📋 Tem transcrição viral pra inspirar?")
//       - Quando preenchido, passa via `viralTranscript` pro endpoint ugc-script
//       - Claude usa como estrutura emocional/narrativa, sem copiar literal
//
// MUDANÇAS v1.1 (mantidas — Sessão 3.5 Fase 3):
//   SESSÃO 3.5 FASE 3 — Integração com aba dedicada de cadastro:
//     - Recebe prop `onSwitchTab` (passada pelo App.jsx desde a Fase 1)
//     - Step 1 ganha botão "+ Nova Influencer" → vai pra aba 👤 Influencers
//     - Empty state melhorado: botão funcional pra cadastrar a primeira
//     - Cards do Step 1 mostram visual de gênero 👨/👩
//     - Recommend voice usa influencer.gender (já com retrocompat 'female')
//
// MUDANÇAS v1.0 (mantidas):
// Aba "UGC Falante" do MARCOS-STUDIO. Wizard de 6 passos pra gerar
// vídeos UGC com lip-sync via Veo 3 frame-to-video.
//
// ARQUITETURA REFERENCIADA:
//   Notion: HUB MARCOS-STUDIO → Arquitetura UGC Falante v3.0
//   Plano de codificação: 4 sessões
//     ✅ Sessão 1 (fundamentos: 7 data files + endpoint voz)
//     ✅ Sessão 2 (geração de assets: 3 endpoints + helpers)
//     🚧 Sessão 3 (UI Wizard) ← VOCÊ ESTÁ AQUI
//     ⏳ Sessão 4 (Output polido + galeria + tutorial Veo)
//
// FLUXO DE 7 PASSOS (1-6 input, 7 output):
//   1. Selecionar influencer (cards das cadastradas via getVtonProfiles)
//   2. Subir foto produto + nome + preço + categoria
//   3. Escolher estilo (com auto-recomendação por categoria)
//   4. Cenário + câmera + realismo + duração
//   5. Validar voz auto-recomendada (com opção de trocar)
//   6. Confirmar e gerar
//   7. Output básico (frame + roteiro + prompts cru)
//
// DECISÃO DE ESCOPO (Sessão 3):
//   Esta sessão entrega WIZARD FUNCIONAL end-to-end, sem polish visual.
//   Output dos resultados é cru (textos brutos com botão copiar).
//   Sessão 4 vai polir: cards lindos, galeria de variações, tutorial
//   Veo Studio integrado, botão "usar transcrição viral", etc.

import { useState, useEffect, useMemo } from 'react';

// ── Data files (Sessão 1) ─────────────────────────────────────────────
import { UGC_STYLES, getStyleById } from './data/ugc-styles';
import {
  UGC_CATEGORIES,
  UGC_CATEGORY_GROUPS,
  getDefaultStyleIdForCategory,
} from './data/ugc-categories';
import {
  UGC_DURATIONS,
  getDefaultDurationIdForStyle,
  COST_NANO_BANANA_PER_IMAGE,
  formatCost,
} from './data/ugc-durations';
import {
  UGC_CAMERAS,
  DEFAULT_CAMERA_ID,
  getCameraById,
} from './data/ugc-cameras';
import {
  UGC_REALISM_LEVELS_ORDERED,
  DEFAULT_REALISM_ID,
  getRealismById,
} from './data/ugc-realism';
import {
  UGC_SCENARIOS,
  UGC_SCENARIO_GROUPS,
  DEFAULT_SCENARIO_ID,
  getScenarioById,
} from './data/ugc-scenarios';
import { UGC_VEO_VOICES, getVoiceById } from './data/ugc-veo-voices';

// ── Helpers de api (Sessões 1 + 2) ────────────────────────────────────
import {
  getVtonProfiles,
  uploadToFal,
  fileToBase64,
  recommendVoice,
  generateUgcImageBase,
  generateUgcScript,
  generateUgcVeoPrompt,
} from './api';

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

export default function UgcStudio({ onSwitchTab }) {
  // ── State do wizard ──────────────────────────────────────────────────
  const [step, setStep] = useState(1); // 1-6 input, 7 output
  const [error, setError] = useState(null);

  // Step 1 — influencer selecionada (perfil VTON)
  const [influencers, setInfluencers] = useState(() => getVtonProfiles());
  const [influencer, setInfluencer] = useState(null);

  // Step 2 — produto
  const [productData, setProductData] = useState({
    name: '',
    description: '',
    price: '',
    originalPrice: '',
    categoryId: '',
    photoFile: null,
    photoPreviewUrl: null, // URL local pra preview (URL.createObjectURL)
  });

  // Step 2 — transcrição viral opcional (Fase C — diferencial vs Trendly)
  const [viralTranscript, setViralTranscript] = useState('');

  // Steps 3-5 — config de geração
  const [styleId, setStyleId] = useState(null);
  const [durationId, setDurationId] = useState(null);
  const [cameraId, setCameraId] = useState(DEFAULT_CAMERA_ID);
  const [realismId, setRealismId] = useState(DEFAULT_REALISM_ID);
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO_ID);
  const [voiceId, setVoiceId] = useState(null);
  const [voiceSource, setVoiceSource] = useState(null); // 'auto' | 'manual'

  // Step 7 — geração e resultados
  const [generating, setGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [results, setResults] = useState(null);

  // ── Auto-recomendações ────────────────────────────────────────────────

  // Quando categoria muda, sugere estilo (se ainda não foi setado)
  useEffect(() => {
    if (productData.categoryId && !styleId) {
      const recommended = getDefaultStyleIdForCategory(productData.categoryId);
      if (recommended) setStyleId(recommended);
    }
  }, [productData.categoryId]);

  // Quando estilo muda, sugere duração (se ainda não foi setada)
  useEffect(() => {
    if (styleId && !durationId) {
      const recommended = getDefaultDurationIdForStyle(styleId);
      if (recommended) setDurationId(recommended);
    }
  }, [styleId]);

  // Quando estilo + influencer estiverem prontos, chama endpoint de voz
  useEffect(() => {
    let cancelled = false;
    if (styleId && influencer && voiceSource !== 'manual') {
      const gender = influencer.gender || 'female'; // sistema preparado pra masculino futuro
      recommendVoice(styleId, gender)
        .then((d) => {
          if (!cancelled && voiceSource !== 'manual') {
            setVoiceId(d.voiceId);
            setVoiceSource('auto');
          }
        })
        .catch((e) => console.error('[UgcStudio] recommendVoice error:', e));
    }
    return () => {
      cancelled = true;
    };
  }, [styleId, influencer, voiceSource]);

  // ── Cleanup do objectURL do preview ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (productData.photoPreviewUrl) {
        URL.revokeObjectURL(productData.photoPreviewUrl);
      }
    };
  }, [productData.photoPreviewUrl]);

  // ── Validações por step (gating do botão "Próximo") ─────────────────
  const canAdvance = useMemo(() => {
    if (step === 1) return !!influencer;
    if (step === 2) {
      return (
        productData.name.trim() &&
        productData.description.trim() &&
        productData.price &&
        productData.categoryId &&
        productData.photoFile
      );
    }
    if (step === 3) return !!styleId;
    if (step === 4) return !!durationId; // outros têm default
    if (step === 5) return !!voiceId;
    if (step === 6) return !generating;
    return false;
  }, [step, influencer, productData, styleId, durationId, voiceId, generating]);

  // ── Pipeline de geração ───────────────────────────────────────────────
  function buildImagePrompt() {
    const scenario = getScenarioById(scenarioId);
    const camera = getCameraById(cameraId);
    const realism = getRealismById(realismId);

    const influencerDesc =
      influencer.bodyHint ||
      [
        influencer.hair?.color && `${influencer.hair.color} hair`,
        influencer.hair?.texture && `${influencer.hair.texture} texture`,
        influencer.signature?.skin,
      ]
        .filter(Boolean)
        .join(', ') ||
      'Brazilian woman';

    return [
      `A ${influencerDesc}, wearing the outfit from reference image, holding the product naturally in her hand.`,
      camera?.cameraPrompt || '',
      scenario?.scenarioPrompt || '',
      realism?.realismPrompt || '',
      'Neutral standing pose, mouth slightly open as if about to speak, ready for animation.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setResults(null);
    try {
      // 1. Upload foto do produto
      setProgressMsg('📤 Subindo foto do produto...');
      const { base64, mimeType } = await fileToBase64(productData.photoFile);
      const fileName = productData.photoFile.name || 'product.jpg';
      const productPhotoUrl = await uploadToFal(base64, mimeType, fileName);
      if (!productPhotoUrl || typeof productPhotoUrl !== 'string') {
        throw new Error('uploadToFal não retornou URL pública pro produto');
      }

      // 2. Upload foto da influencer (perfil VTON guarda como objeto
      //    {base64, mimeType, preview} — Nano Banana Pro precisa de URL pública)
      setProgressMsg('📤 Subindo foto da influencer...');
      let facePhotoUrl;
      if (typeof influencer.facePhoto === 'string') {
        // Edge case: já é URL pública (perfis legacy talvez)
        facePhotoUrl = influencer.facePhoto;
      } else if (
        influencer.facePhoto?.base64 &&
        influencer.facePhoto?.mimeType
      ) {
        // Caso normal (perfil VTON): {base64, mimeType, preview}
        facePhotoUrl = await uploadToFal(
          influencer.facePhoto.base64,
          influencer.facePhoto.mimeType,
          'face.jpg'
        );
      } else {
        throw new Error(
          'Influencer cadastrada sem foto válida (esperado base64 ou URL)'
        );
      }
      if (!facePhotoUrl || typeof facePhotoUrl !== 'string') {
        throw new Error('uploadToFal não retornou URL pública pra face');
      }

      // 3. Gera frame inicial via Nano Banana Pro
      setProgressMsg('🎨 Gerando frame inicial (Nano Banana Pro)... ~30-60s');
      const imagePrompt = buildImagePrompt();
      const imageResult = await generateUgcImageBase({
        facePhotoUrl,
        productPhotoUrl,
        prompt: imagePrompt,
      });

      // 4. Gera roteiro + pacote pós-produção via Claude Sonnet 4
      setProgressMsg('📝 Gerando roteiro e pacote completo...');
      const scriptResult = await generateUgcScript({
        influencer: {
          name: influencer.name,
          bodyDescription: influencerDescriptionForApi(influencer),
          vibe: influencer.vibe,
        },
        product: {
          name: productData.name,
          description: productData.description,
          price: parseFloat(productData.price) || 0,
          originalPrice: productData.originalPrice
            ? parseFloat(productData.originalPrice)
            : undefined,
        },
        styleId,
        durationId,
        categoryId: productData.categoryId,
        viralTranscript: viralTranscript?.trim() || undefined, // Fase C
      });

      // 5. Gera prompts EN com 8 blocos via Claude Sonnet 4
      setProgressMsg('🎬 Gerando prompts Veo 3 (8 blocos × N takes)...');
      const style = getStyleById(styleId);
      const scenario = getScenarioById(scenarioId);
      const camera = getCameraById(cameraId);
      const realism = getRealismById(realismId);
      const voice = getVoiceById(voiceId);

      const promptsResult = await generateUgcVeoPrompt({
        influencer: {
          name: influencer.name,
          bodyDescription: influencerDescriptionForApi(influencer),
          vibe: influencer.vibe,
        },
        product: {
          name: productData.name,
          description: productData.description,
        },
        styleId,
        durationId,
        cameraId,
        realismId,
        scenarioId,
        voiceId,
        script: scriptResult.script,
        dataContext: {
          styleName: style?.name || styleId,
          behaviorVibe: style?.behaviorVibe || 'natural and authentic',
          scenarioPrompt: scenario?.scenarioPrompt || '',
          cameraPrompt: camera?.cameraPrompt || '',
          realismPrompt: realism?.realismPrompt || '',
          voiceTone: voice?.tone || 'natural conversational tone',
        },
        hasStarterFrame: true,
      });

      // 6. Apresenta resultados
      setResults({
        image: imageResult,
        package: scriptResult,
        prompts: promptsResult,
        config: {
          influencer: influencer.name,
          product: productData.name,
          style: style?.name || styleId,
          duration: durationId,
          scenario: scenario?.name || scenarioId,
          camera: camera?.name || cameraId,
          realism: realism?.name || realismId,
          voice: voice?.id || voiceId,
        },
      });
      setStep(7);
    } catch (e) {
      console.error('[UgcStudio] generation error:', e);
      setError(e.message || String(e));
    } finally {
      setGenerating(false);
      setProgressMsg('');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      {/* Header com breadcrumb */}
      {step <= 6 && <Header step={step} setStep={setStep} />}

      {/* Erro global */}
      {error && (
        <div style={S.error}>
          ⚠️ <strong>Erro:</strong> {error}
        </div>
      )}

      {/* Conteúdo do step */}
      {step === 1 && (
        <Step1Influencer
          influencers={influencers}
          selected={influencer}
          onSelect={setInfluencer}
          onRefresh={() => setInfluencers(getVtonProfiles())}
          onSwitchTab={onSwitchTab}
        />
      )}
      {step === 2 && (
        <Step2Product
          data={productData}
          setData={setProductData}
          viralTranscript={viralTranscript}
          setViralTranscript={setViralTranscript}
        />
      )}
      {step === 3 && (
        <Step3Style
          selected={styleId}
          onSelect={setStyleId}
          recommendedFor={productData.categoryId}
        />
      )}
      {step === 4 && (
        <Step4Scene
          durationId={durationId}
          setDurationId={setDurationId}
          scenarioId={scenarioId}
          setScenarioId={setScenarioId}
          cameraId={cameraId}
          setCameraId={setCameraId}
          realismId={realismId}
          setRealismId={setRealismId}
        />
      )}
      {step === 5 && (
        <Step5Voice
          voiceId={voiceId}
          voiceSource={voiceSource}
          onSelect={(id) => {
            setVoiceId(id);
            setVoiceSource('manual');
          }}
        />
      )}
      {step === 6 && (
        <Step6Confirm
          influencer={influencer}
          productData={productData}
          styleId={styleId}
          durationId={durationId}
          cameraId={cameraId}
          realismId={realismId}
          scenarioId={scenarioId}
          voiceId={voiceId}
          generating={generating}
          progressMsg={progressMsg}
        />
      )}
      {step === 7 && (
        <ResultsView
          results={results}
          generating={generating}
          progressMsg={progressMsg}
          onBack={() => {
            setStep(6);
            setResults(null);
          }}
          // Fase B — Galeria de variações 1-clique
          onVariationStyle={() => {
            setResults(null);
            setStyleId(null); // força re-escolha
            setStep(3);
          }}
          onVariationScenario={() => {
            setResults(null);
            setScenarioId(DEFAULT_SCENARIO_ID); // reset pro default, força re-escolha
            setStep(4);
          }}
          onVariationCamera={() => {
            setResults(null);
            setCameraId(DEFAULT_CAMERA_ID); // reset pro default
            setStep(4);
          }}
          onRegenerateAll={() => {
            setResults(null);
            handleGenerate();
          }}
        />
      )}

      {/* Navegação (não aparece no step 7) */}
      {step <= 6 && (
        <NavBar
          step={step}
          setStep={setStep}
          canAdvance={canAdvance}
          onGenerate={handleGenerate}
          generating={generating}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER: descrição da influencer pra mandar pra API
// ═══════════════════════════════════════════════════════════════════════

function influencerDescriptionForApi(inf) {
  const parts = [];
  if (inf.ageHint) parts.push(inf.ageHint);
  if (inf.hair?.color || inf.hair?.texture || inf.hair?.length) {
    const h = [
      inf.hair.color,
      inf.hair.texture,
      inf.hair.length && `${inf.hair.length} length`,
    ]
      .filter(Boolean)
      .join(', ');
    parts.push(`hair: ${h}`);
  }
  if (inf.signature?.skin) parts.push(`skin: ${inf.signature.skin}`);
  if (inf.bodyHint) parts.push(inf.bodyHint);
  return parts.join(' · ') || inf.name;
}

// ═══════════════════════════════════════════════════════════════════════
// HEADER + BREADCRUMB
// ═══════════════════════════════════════════════════════════════════════

const STEP_LABELS = [
  { n: 1, label: 'Influencer', icon: '👤' },
  { n: 2, label: 'Produto', icon: '📦' },
  { n: 3, label: 'Estilo', icon: '🎭' },
  { n: 4, label: 'Cena', icon: '🎬' },
  { n: 5, label: 'Voz', icon: '🎤' },
  { n: 6, label: 'Gerar', icon: '✨' },
];

function Header({ step, setStep }) {
  return (
    <div style={S.header}>
      <h1 style={S.title}>🎤 UGC Falante</h1>
      <p style={S.subtitle}>
        Vídeos com lip-sync • Pipeline manual Nano Banana Pro → Veo 3 → CapCut
      </p>
      <div style={S.breadcrumb}>
        {STEP_LABELS.map((s) => (
          <button
            key={s.n}
            onClick={() => s.n < step && setStep(s.n)}
            disabled={s.n > step}
            style={{
              ...S.crumb,
              ...(s.n === step ? S.crumbActive : {}),
              ...(s.n < step ? S.crumbDone : {}),
              cursor: s.n < step ? 'pointer' : 'default',
            }}
          >
            {s.icon} {s.n}. {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 1 — Selecionar Influencer
// ═══════════════════════════════════════════════════════════════════════

function Step1Influencer({ influencers, selected, onSelect, onRefresh, onSwitchTab }) {
  // Empty state com CTA funcional pra aba Influencers
  if (!influencers.length) {
    return (
      <div style={S.stepBody}>
        <h2 style={S.stepTitle}>1. Selecionar influencer</h2>
        <div style={S.emptyState}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>📭 Nenhuma influencer cadastrada.</p>
          <p style={{ marginBottom: 20 }}>
            Cadastra a primeira na aba dedicada — depois ela aparece automaticamente
            aqui e na aba VTON.
          </p>
          {onSwitchTab && (
            <button
              style={{
                ...S.btnPrimary,
                background: 'var(--g)',
                color: 'var(--bg)',
                marginRight: 8,
              }}
              onClick={() => onSwitchTab('influencers')}
            >
              👤 Cadastrar primeira →
            </button>
          )}
          <button style={S.btnSecondary} onClick={onRefresh}>
            🔄 Já cadastrei, atualizar
          </button>
        </div>
      </div>
    );
  }

  // Lista normal com botão "+ Nova" no topo + visual gender nos cards
  return (
    <div style={S.stepBody}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={S.stepTitle}>1. Selecionar influencer</h2>
          <p style={S.stepSubtitle}>
            {influencers.length} cadastrada{influencers.length > 1 ? 's' : ''} · fonte
            única (aba 👤 Influencers)
          </p>
        </div>
        {onSwitchTab && (
          <button
            style={S.btnSecondary}
            onClick={() => onSwitchTab('influencers')}
            title="Ir pra aba Influencers pra cadastrar/editar/deletar"
          >
            + Nova Influencer
          </button>
        )}
      </div>
      <div style={S.cardsGrid}>
        {influencers.map((inf) => (
          <div
            key={inf.id}
            onClick={() => onSelect(inf)}
            style={{
              ...S.card,
              ...(selected?.id === inf.id ? S.cardActive : {}),
            }}
          >
            {inf.facePhoto?.preview && (
              <img src={inf.facePhoto.preview} alt={inf.name} style={S.cardImg} />
            )}
            <div style={S.cardName}>
              {inf.gender === 'male' ? '👨' : '👩'} {inf.name}
            </div>
            {inf.bodyHint && <div style={S.cardSub}>{inf.bodyHint}</div>}
            {inf.vibe && (
              <div style={S.cardMeta}>
                vibe: {inf.vibe}
                {inf.gender && (
                  <span style={{ opacity: 0.7 }}>
                    {' · '}
                    {inf.gender === 'male' ? 'masc.' : 'fem.'}
                  </span>
                )}
              </div>
            )}
            {!inf.gender && (
              <div
                style={{
                  fontSize: 10,
                  color: '#ffaa44',
                  marginTop: 4,
                }}
                title="Perfil sem gênero — atualiza na aba Influencers pra recomendação de voz mais precisa"
              >
                ⚠️ sem gênero (default: feminino)
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 2 — Dados do Produto
// ═══════════════════════════════════════════════════════════════════════

function Step2Product({ data, setData, viralTranscript, setViralTranscript }) {
  const [showViral, setShowViral] = useState(!!viralTranscript);

  function update(field, value) {
    setData({ ...data, [field]: value });
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (data.photoPreviewUrl) URL.revokeObjectURL(data.photoPreviewUrl);
    setData({
      ...data,
      photoFile: file,
      photoPreviewUrl: URL.createObjectURL(file),
    });
  }

  return (
    <div style={S.stepBody}>
      <h2 style={S.stepTitle}>2. Produto</h2>
      <p style={S.stepSubtitle}>
        Quanto mais específico, melhor o roteiro (Claude usa esses detalhes pra
        evitar texto genérico)
      </p>

      <div style={S.formRow}>
        <label style={S.label}>Nome do produto *</label>
        <input
          style={S.input}
          value={data.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Ex: Sérum Vitamina C 30ml"
        />
      </div>

      <div style={S.formRow}>
        <label style={S.label}>Descrição (técnica + diferenciais) *</label>
        <textarea
          style={{ ...S.input, minHeight: 80, resize: 'vertical' }}
          value={data.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Ex: sérum facial com 15% de vitamina C pura, ácido hialurônico e niacinamida. Reduz manchas e ilumina."
        />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ ...S.formRow, flex: 1 }}>
          <label style={S.label}>Preço (R$) *</label>
          <input
            style={S.input}
            type="number"
            step="0.01"
            value={data.price}
            onChange={(e) => update('price', e.target.value)}
            placeholder="89.90"
          />
        </div>
        <div style={{ ...S.formRow, flex: 1 }}>
          <label style={S.label}>Preço original (opcional)</label>
          <input
            style={S.input}
            type="number"
            step="0.01"
            value={data.originalPrice}
            onChange={(e) => update('originalPrice', e.target.value)}
            placeholder="149.90 (se em promoção)"
          />
        </div>
      </div>

      <div style={S.formRow}>
        <label style={S.label}>Categoria *</label>
        <select
          style={S.input}
          value={data.categoryId}
          onChange={(e) => update('categoryId', e.target.value)}
        >
          <option value="">— escolha uma —</option>
          {UGC_CATEGORY_GROUPS.map((g) => (
            <optgroup key={g.id} label={`${g.icon || ''} ${g.name}`}>
              {UGC_CATEGORIES.filter((c) => c.group === g.id).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div style={S.formRow}>
        <label style={S.label}>Foto do produto *</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={S.input}
        />
        {data.photoPreviewUrl && (
          <img
            src={data.photoPreviewUrl}
            alt="preview"
            style={{
              maxWidth: 200,
              maxHeight: 200,
              marginTop: 12,
              borderRadius: 8,
              border: '1px solid var(--bd)',
            }}
          />
        )}
      </div>

      {/* Fase C — Transcrição viral como base (diferencial vs Trendly) */}
      <div
        style={{
          marginTop: 16,
          padding: 14,
          background: showViral ? 'var(--bg)' : 'transparent',
          border: '1px dashed var(--bd)',
          borderRadius: 10,
        }}
      >
        <button
          onClick={() => setShowViral(!showViral)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--g)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            textAlign: 'left',
          }}
        >
          <span>{showViral ? '➖' : '➕'}</span>
          <span>Tem transcrição viral pra inspirar? (opcional)</span>
          {viralTranscript && !showViral && (
            <span
              style={{
                fontSize: 10,
                background: 'var(--gd)',
                color: 'var(--g)',
                padding: '2px 8px',
                borderRadius: 10,
                marginLeft: 'auto',
              }}
            >
              ✓ preenchido
            </span>
          )}
        </button>
        {showViral && (
          <div style={{ marginTop: 12 }}>
            <p
              style={{
                fontSize: 11,
                color: 'var(--t2)',
                marginTop: 0,
                marginBottom: 8,
                lineHeight: 1.4,
              }}
            >
              💡 Cole transcrição de um vídeo TikTok que viralizou. Claude vai usar como{' '}
              <strong>estrutura emocional/narrativa</strong> (sem copiar literal). Diferencial vs Trendly.
            </p>
            <textarea
              style={{ ...S.input, minHeight: 90, resize: 'vertical' }}
              value={viralTranscript}
              onChange={(e) => setViralTranscript(e.target.value)}
              placeholder='Ex: "Gente, eu não acredito que demorei tanto pra conhecer esse produto. Mudou minha rotina completamente..."'
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 3 — Estilo
// ═══════════════════════════════════════════════════════════════════════

function Step3Style({ selected, onSelect, recommendedFor }) {
  const recommendedId = recommendedFor
    ? getDefaultStyleIdForCategory(recommendedFor)
    : null;

  return (
    <div style={S.stepBody}>
      <h2 style={S.stepTitle}>3. Estilo de apresentação</h2>
      {recommendedId && (
        <p style={S.stepSubtitle}>
          ✨ Recomendado pra essa categoria:{' '}
          <strong>{getStyleById(recommendedId)?.name}</strong>
        </p>
      )}
      <div style={S.cardsGrid}>
        {UGC_STYLES.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            title={s.tooltip || s.description}
            style={{
              ...S.card,
              ...(selected === s.id ? S.cardActive : {}),
              ...(recommendedId === s.id && selected !== s.id
                ? S.cardRecommended
                : {}),
            }}
          >
            <div style={S.cardName}>{s.name}</div>
            <div style={S.cardSub}>{s.description}</div>
            <div style={S.cardMeta}>
              {s.origin === 'trendly' ? '🌀 Trendly' : '🇧🇷 TikTok BR'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 4 — Cena (Duração + Cenário + Câmera + Realismo)
// ═══════════════════════════════════════════════════════════════════════

function Step4Scene({
  durationId,
  setDurationId,
  scenarioId,
  setScenarioId,
  cameraId,
  setCameraId,
  realismId,
  setRealismId,
}) {
  return (
    <div style={S.stepBody}>
      <h2 style={S.stepTitle}>4. Cena, câmera, duração</h2>
      <p style={S.stepSubtitle}>
        Cada parâmetro tem default sensato — mexe só se quiser variar
      </p>

      <div style={S.formRow}>
        <label style={S.label}>⏱️ Duração</label>
        <select
          style={S.input}
          value={durationId || ''}
          onChange={(e) => setDurationId(e.target.value)}
        >
          <option value="">— escolha —</option>
          {UGC_DURATIONS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · {d.takes} take(s) · {formatCost(
                COST_NANO_BANANA_PER_IMAGE
              )}
            </option>
          ))}
        </select>
      </div>

      <div style={S.formRow}>
        <label style={S.label}>📍 Cenário</label>
        <select
          style={S.input}
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value)}
        >
          {UGC_SCENARIO_GROUPS.map((g) => (
            <optgroup key={g.id} label={`${g.icon || ''} ${g.name}`}>
              {UGC_SCENARIOS.filter((s) => s.group === g.id).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div style={S.formRow}>
        <label style={S.label}>📷 Câmera / posicionamento</label>
        <select
          style={S.input}
          value={cameraId}
          onChange={(e) => setCameraId(e.target.value)}
        >
          {UGC_CAMERAS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.id === DEFAULT_CAMERA_ID ? '(padrão)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div style={S.formRow}>
        <label style={S.label}>🎨 Nível de realismo</label>
        <select
          style={S.input}
          value={realismId}
          onChange={(e) => setRealismId(e.target.value)}
        >
          {UGC_REALISM_LEVELS_ORDERED.map((r) => (
            <option key={r.id} value={r.id}>
              {r.intensity}. {r.name}{' '}
              {r.id === DEFAULT_REALISM_ID ? '(padrão)' : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 5 — Voz
// ═══════════════════════════════════════════════════════════════════════

function Step5Voice({ voiceId, voiceSource, onSelect }) {
  const [showAll, setShowAll] = useState(false);
  const currentVoice = voiceId ? getVoiceById(voiceId) : null;

  if (!voiceId) {
    return (
      <div style={S.stepBody}>
        <h2 style={S.stepTitle}>5. Voz</h2>
        <p style={S.stepSubtitle}>🔄 Carregando voz recomendada...</p>
      </div>
    );
  }

  return (
    <div style={S.stepBody}>
      <h2 style={S.stepTitle}>5. Voz</h2>
      <p style={S.stepSubtitle}>
        {voiceSource === 'auto'
          ? '✨ Voz auto-recomendada baseada em (estilo × gênero)'
          : '👆 Voz escolhida manualmente'}
      </p>

      {currentVoice && (
        <div style={{ ...S.card, ...S.cardActive, marginBottom: 16 }}>
          <div style={S.cardName}>🎤 {currentVoice.id}</div>
          <div style={S.cardSub}>{currentVoice.description || currentVoice.tone || 'sem descrição'}</div>
          <div style={S.cardMeta}>
            {currentVoice.gender || '?'} ·{' '}
            {currentVoice.confirmed ? '✅ confirmada' : '⚠️ estimada'}
          </div>
        </div>
      )}

      <button style={S.btnSecondary} onClick={() => setShowAll(!showAll)}>
        {showAll ? '➖ Esconder lista' : '🔄 Trocar voz (ver todas)'}
      </button>

      {showAll && (
        <div style={{ ...S.cardsGrid, marginTop: 16 }}>
          {UGC_VEO_VOICES.map((v) => (
            <div
              key={v.id}
              onClick={() => onSelect(v.id)}
              style={{
                ...S.card,
                ...(voiceId === v.id ? S.cardActive : {}),
                padding: 8,
              }}
            >
              <div style={{ ...S.cardName, fontSize: 13 }}>{v.id}</div>
              <div style={{ ...S.cardSub, fontSize: 11 }}>
                {v.gender} · {v.description || v.tone || '?'}
              </div>
              {!v.confirmed && (
                <div style={{ ...S.cardMeta, fontSize: 10 }}>⚠️ estimada</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 6 — Confirmar e Gerar
// ═══════════════════════════════════════════════════════════════════════

function Step6Confirm({
  influencer,
  productData,
  styleId,
  durationId,
  cameraId,
  realismId,
  scenarioId,
  voiceId,
  generating,
  progressMsg,
}) {
  const style = getStyleById(styleId);
  const duration = UGC_DURATIONS.find((d) => d.id === durationId);
  const scenario = getScenarioById(scenarioId);
  const camera = getCameraById(cameraId);
  const realism = getRealismById(realismId);
  const voice = getVoiceById(voiceId);

  const totalCost = COST_NANO_BANANA_PER_IMAGE; // 1 frame por geração

  return (
    <div style={S.stepBody}>
      <h2 style={S.stepTitle}>6. Confirmar e gerar</h2>
      <p style={S.stepSubtitle}>
        Revisa tudo antes de gastar tokens. Custo estimado: {formatCost(totalCost)} (Nano Banana) +{' '}
        ~$0,04 (Claude × 2). Veo 3 = $0 (cota Gemini Ultra).
      </p>

      <div style={S.summaryGrid}>
        <SummaryItem icon="👤" label="Influencer" value={influencer?.name} />
        <SummaryItem icon="📦" label="Produto" value={productData?.name} />
        <SummaryItem
          icon="💰"
          label="Preço"
          value={
            productData?.originalPrice
              ? `R$ ${productData.price} (era R$ ${productData.originalPrice})`
              : `R$ ${productData?.price}`
          }
        />
        <SummaryItem icon="🎭" label="Estilo" value={style?.name} />
        <SummaryItem
          icon="⏱️"
          label="Duração"
          value={`${duration?.name || durationId} (${duration?.takes || '?'} take(s))`}
        />
        <SummaryItem icon="📍" label="Cenário" value={scenario?.name} />
        <SummaryItem icon="📷" label="Câmera" value={camera?.name} />
        <SummaryItem icon="🎨" label="Realismo" value={realism?.name} />
        <SummaryItem icon="🎤" label="Voz" value={voice?.id || voiceId} />
      </div>

      {generating && (
        <div style={S.progress}>
          <div style={S.spinner}>⏳</div>
          <p>{progressMsg}</p>
          <p style={S.progressNote}>
            Não feche essa aba. O pipeline tem 3 chamadas (Nano Banana → Claude
            × 2). Total: ~1-2min.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryItem({ icon, label, value }) {
  return (
    <div style={S.summaryItem}>
      <span style={S.summaryIcon}>{icon}</span>
      <div>
        <div style={S.summaryLabel}>{label}</div>
        <div style={S.summaryValue}>{value || '—'}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 7 — Resultados (output polido — Sessão 4 Fase A + B)
// ═══════════════════════════════════════════════════════════════════════

function ResultsView({
  results,
  generating,
  progressMsg,
  onBack,
  onVariationStyle,
  onVariationScenario,
  onVariationCamera,
  onRegenerateAll,
}) {
  // Estado intermediário: gerando após click em variação 🔄 mesmo tudo
  if (!results && generating) {
    return (
      <div style={S.stepBody}>
        <h2 style={S.stepTitle}>♻️ Regenerando...</h2>
        <div style={S.progress}>
          <div style={S.spinner}>⏳</div>
          <p>{progressMsg}</p>
        </div>
      </div>
    );
  }

  if (!results) return null;
  const { image, package: pkg, prompts, config } = results;

  // Monta texto formatado pra "copiar tudo"
  const fullPackText = formatFullPackage({ pkg, prompts, config });

  return (
    <div style={S.stepBody}>
      {/* Header de resultados com ações principais */}
      <div style={S.resultsHeader}>
        <div>
          <h2 style={{ ...S.stepTitle, marginBottom: 4 }}>
            ✨ Pacote UGC Falante pronto
          </h2>
          <p style={{ ...S.stepSubtitle, marginBottom: 0 }}>
            {config?.influencer} · {config?.style} · {config?.duration} · {pkg?.script?.length || 0} take(s)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <CopyButton
            text={fullPackText}
            label="📋 Copiar tudo"
            primary
          />
          <button style={S.btnSecondary} onClick={onBack}>
            ← Editar
          </button>
        </div>
      </div>

      {/* Galeria de variações 1-clique (Fase B) */}
      <div style={S.variationsBar}>
        <span style={S.variationsLabel}>♻️ Gerar variação:</span>
        <button style={S.variationChip} onClick={onVariationStyle}>
          🎭 Outro estilo
        </button>
        <button style={S.variationChip} onClick={onVariationScenario}>
          📍 Outro cenário
        </button>
        <button style={S.variationChip} onClick={onVariationCamera}>
          📷 Outra câmera
        </button>
        <button
          style={{ ...S.variationChip, ...S.variationChipPrimary }}
          onClick={onRegenerateAll}
        >
          🔄 Mesmo tudo
        </button>
      </div>

      {/* TUTORIAL VEO STUDIO (destacado) — Fase A */}
      <div style={S.tutorialCard}>
        <div style={S.tutorialHeader}>
          <span style={{ fontSize: 20 }}>🎬</span>
          <strong>Próximos passos no Veo Studio Ultra (manual)</strong>
        </div>
        <ol style={S.tutorialSteps}>
          <li>
            Abre o{' '}
            <a
              href="https://labs.google/fx/tools/flow"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--g)' }}
            >
              Veo Studio Ultra (Flow)
            </a>
          </li>
          <li>
            Faz upload do <strong>frame inicial</strong> abaixo (ou copia URL)
          </li>
          <li>
            Cola o <strong>prompt do Take 1</strong> (lá embaixo) e gera o vídeo
          </li>
          <li>
            <strong>"Save frame as asset"</strong> no último frame → use como starter do Take 2
          </li>
          <li>
            Repete pros próximos takes ({pkg?.script?.length || 1} no total) →{' '}
            <strong>concatena no CapCut</strong>
          </li>
        </ol>
      </div>

      {/* FRAME INICIAL */}
      <div style={S.resultCard}>
        <div style={S.resultCardHeader}>
          <h3 style={S.resultTitle}>🎨 Frame inicial</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {image?.imageUrl && (
              <a
                href={image.imageUrl}
                download="frame_take1.png"
                target="_blank"
                rel="noopener noreferrer"
                style={S.copyBtn}
              >
                📥 Baixar
              </a>
            )}
            <CopyButton text={image?.imageUrl || ''} label="📋 URL" />
          </div>
        </div>
        {image?.imageUrl && (
          <img src={image.imageUrl} alt="frame" style={S.resultImgLarge} />
        )}
      </div>

      {/* PROMPTS VEO (DESTAQUE PRINCIPAL — vai pro Veo Studio) — Fase A */}
      <div style={{ ...S.resultCard, ...S.resultCardHighlight }}>
        <div style={S.resultCardHeader}>
          <h3 style={S.resultTitle}>
            🎬 Prompts Veo 3 ({prompts?.prompts?.length || 0} take{prompts?.prompts?.length !== 1 ? 's' : ''})
          </h3>
          <span
            style={{
              fontSize: 11,
              color: 'var(--g)',
              fontWeight: 600,
              background: 'var(--gd)',
              padding: '4px 10px',
              borderRadius: 10,
            }}
          >
            ⭐ Cole no Veo Studio
          </span>
        </div>
        {prompts?.prompts?.map((p) => (
          <div key={p.takeNumber} style={S.veoTakeBlock}>
            <div style={S.veoTakeHeader}>
              <strong style={{ fontSize: 14, color: 'var(--g)' }}>
                Take {p.takeNumber}
              </strong>
              <CopyButton
                text={p.prompt}
                label={`📋 Copiar Take ${p.takeNumber}`}
                primary
              />
            </div>
            <pre style={S.pre}>{p.prompt}</pre>
          </div>
        ))}
      </div>

      {/* ROTEIRO (PT-BR) */}
      <div style={S.resultCard}>
        <h3 style={S.resultTitle}>
          📜 Roteiro PT-BR ({pkg?.script?.length || 0} take{pkg?.script?.length !== 1 ? 's' : ''})
        </h3>
        {pkg?.script?.map((t) => (
          <div key={t.takeNumber} style={S.takeBlockNew}>
            <div style={S.takeHeader}>
              <strong>Take {t.takeNumber}</strong>
              <span style={S.takeMeta}>
                {t.wordCount} palavras · {t.durationSeconds}s
              </span>
              <div style={{ flex: 1 }} />
              <CopyButton text={t.fala} label="📋 Copiar fala" />
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: 14, lineHeight: 1.5 }}>
              {t.fala}
            </p>
          </div>
        ))}
      </div>

      {/* ON-SCREEN */}
      {pkg?.onScreenPhrases?.length > 0 && (
        <div style={S.resultCard}>
          <h3 style={S.resultTitle}>
            💬 Frases on-screen ({pkg.onScreenPhrases.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pkg.onScreenPhrases.map((p) => (
              <div key={p.takeNumber} style={S.onScreenChip}>
                <span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600 }}>
                  TAKE {p.takeNumber}
                </span>
                <span style={{ flex: 1, fontWeight: 600 }}>{p.phrase}</span>
                <CopyButton text={p.phrase} label="📋" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DESCRIÇÃO TIKTOK */}
      <div style={S.resultCard}>
        <div style={S.resultCardHeader}>
          <h3 style={S.resultTitle}>📝 Descrição TikTok</h3>
          <CopyButton text={pkg?.description || ''} label="📋 Copiar" />
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          {pkg?.description}
        </p>
      </div>

      {/* HASHTAGS */}
      <div style={S.resultCard}>
        <div style={S.resultCardHeader}>
          <h3 style={S.resultTitle}>🏷️ Hashtags ({pkg?.hashtags?.length || 0})</h3>
          <CopyButton
            text={pkg?.hashtags?.join(' ') || ''}
            label="📋 Copiar todas"
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {pkg?.hashtags?.map((h, i) => (
            <span key={i} style={S.hashtagChip}>
              {h}
            </span>
          ))}
        </div>
      </div>

      {/* MÚSICA SUGERIDA */}
      {pkg?.musicSuggestion && (
        <div style={S.resultCard}>
          <h3 style={S.resultTitle}>🎵 Música sugerida</h3>
          <div style={S.musicGrid}>
            <MusicItem label="Gênero" value={pkg.musicSuggestion.genre} />
            <MusicItem label="Mood" value={pkg.musicSuggestion.mood} />
            <MusicItem label="BPM" value={pkg.musicSuggestion.bpm} />
          </div>
          {pkg.musicSuggestion.searchTerms?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--t2)',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Buscar no TikTok Sounds:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {pkg.musicSuggestion.searchTerms.map((t, i) => (
                  <span key={i} style={S.searchTermChip}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CTAs */}
      {pkg?.ctas && (
        <div style={S.resultCard}>
          <h3 style={S.resultTitle}>📢 CTAs (3 versões)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <CtaItem label="🗣️ Falado" text={pkg.ctas.spoken} />
            <CtaItem label="💬 On-screen" text={pkg.ctas.onScreen} />
            <CtaItem label="📝 Escrito (post)" text={pkg.ctas.written} />
          </div>
        </div>
      )}

      {/* CONFIG usada (collapsed por default — só pra debug) */}
      <details style={{ ...S.resultCard, padding: 12 }}>
        <summary
          style={{
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--t2)',
            fontWeight: 600,
          }}
        >
          ⚙️ Config técnica usada (clica pra expandir)
        </summary>
        <pre style={{ ...S.pre, marginTop: 10 }}>
          {JSON.stringify(config, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function MusicItem({ label, value }) {
  return (
    <div style={S.musicItem}>
      <div style={{ fontSize: 11, color: 'var(--t2)', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value || '—'}</div>
    </div>
  );
}

function CtaItem({ label, text }) {
  return (
    <div style={S.ctaItem}>
      <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 14, flex: 1 }}>{text}</p>
        <CopyButton text={text} label="📋" />
      </div>
    </div>
  );
}

// Helper: monta texto formatado pra "Copiar tudo"
function formatFullPackage({ pkg, prompts, config }) {
  const lines = [];
  lines.push(`# UGC Falante — ${config?.product || 'produto'}`);
  lines.push(`Influencer: ${config?.influencer} · Estilo: ${config?.style} · ${config?.duration}`);
  lines.push('');
  lines.push('## ROTEIRO');
  pkg?.script?.forEach((t) => {
    lines.push(`Take ${t.takeNumber} (${t.wordCount}p, ${t.durationSeconds}s):`);
    lines.push(t.fala);
    lines.push('');
  });
  if (pkg?.onScreenPhrases?.length) {
    lines.push('## ON-SCREEN');
    pkg.onScreenPhrases.forEach((p) =>
      lines.push(`Take ${p.takeNumber}: ${p.phrase}`)
    );
    lines.push('');
  }
  lines.push('## DESCRIÇÃO TIKTOK');
  lines.push(pkg?.description || '');
  lines.push('');
  lines.push('## HASHTAGS');
  lines.push(pkg?.hashtags?.join(' ') || '');
  lines.push('');
  if (pkg?.musicSuggestion) {
    lines.push('## MÚSICA');
    lines.push(`${pkg.musicSuggestion.genre} · ${pkg.musicSuggestion.mood} · BPM ${pkg.musicSuggestion.bpm}`);
    if (pkg.musicSuggestion.searchTerms?.length) {
      lines.push(`Buscar: ${pkg.musicSuggestion.searchTerms.join(', ')}`);
    }
    lines.push('');
  }
  if (pkg?.ctas) {
    lines.push('## CTAs');
    lines.push(`Falado: ${pkg.ctas.spoken}`);
    lines.push(`On-screen: ${pkg.ctas.onScreen}`);
    lines.push(`Escrito: ${pkg.ctas.written}`);
    lines.push('');
  }
  lines.push('---');
  lines.push('## PROMPTS VEO 3 (cole 1 por vez no Veo Studio)');
  prompts?.prompts?.forEach((p) => {
    lines.push('');
    lines.push(`### TAKE ${p.takeNumber}`);
    lines.push(p.prompt);
  });
  return lines.join('\n');
}

function CopyButton({ text, label, primary }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      style={primary ? S.copyBtnPrimary : S.copyBtn}
    >
      {ok ? '✓ Copiado' : label || '📋 Copiar'}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// NAVBAR (botões voltar / próximo / gerar)
// ═══════════════════════════════════════════════════════════════════════

function NavBar({ step, setStep, canAdvance, onGenerate, generating }) {
  return (
    <div style={S.navbar}>
      {step > 1 && !generating && (
        <button style={S.btnSecondary} onClick={() => setStep(step - 1)}>
          ← Voltar
        </button>
      )}
      <div style={{ flex: 1 }} />
      {step < 6 && (
        <button
          style={{ ...S.btnPrimary, opacity: canAdvance ? 1 : 0.5 }}
          disabled={!canAdvance}
          onClick={() => setStep(step + 1)}
        >
          Próximo →
        </button>
      )}
      {step === 6 && (
        <button
          style={{
            ...S.btnPrimary,
            opacity: canAdvance ? 1 : 0.5,
            background: 'var(--g)',
          }}
          disabled={!canAdvance || generating}
          onClick={onGenerate}
        >
          {generating ? '⏳ Gerando...' : '✨ Gerar UGC Falante'}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ESTILOS — inline styles usando CSS vars existentes do projeto
// (Sessão 4 vai migrar pra classes em styles.css com polish)
// ═══════════════════════════════════════════════════════════════════════

const S = {
  root: {
    maxWidth: 920,
    margin: '0 auto',
    padding: '24px 20px',
    color: 'var(--t1)',
    fontFamily: 'inherit',
  },
  header: { textAlign: 'center', marginBottom: 24 },
  title: { fontSize: 28, margin: '0 0 4px 0' },
  subtitle: { color: 'var(--t2)', fontSize: 13, margin: '0 0 16px 0' },
  breadcrumb: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  crumb: {
    background: 'transparent',
    border: '1px solid var(--bd)',
    color: 'var(--t2)',
    padding: '6px 12px',
    borderRadius: 16,
    fontSize: 12,
    fontFamily: 'inherit',
  },
  crumbActive: {
    background: 'var(--gd)',
    border: '1px solid var(--gb)',
    color: 'var(--g)',
    fontWeight: 600,
  },
  crumbDone: {
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    color: 'var(--t1)',
  },
  stepBody: {
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
  },
  stepTitle: { fontSize: 22, margin: '0 0 4px 0' },
  stepSubtitle: { color: 'var(--t2)', fontSize: 13, marginBottom: 20 },
  emptyState: {
    textAlign: 'center',
    padding: 40,
    color: 'var(--t2)',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 12,
  },
  card: {
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 10,
    padding: 12,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  cardActive: {
    border: '2px solid var(--gb)',
    background: 'var(--gd)',
  },
  cardRecommended: {
    border: '1px dashed var(--gb)',
  },
  cardImg: {
    width: '100%',
    height: 100,
    objectFit: 'cover',
    borderRadius: 6,
    marginBottom: 8,
  },
  cardName: { fontWeight: 600, fontSize: 14, marginBottom: 4 },
  cardSub: { fontSize: 12, color: 'var(--t2)', lineHeight: 1.3 },
  cardMeta: { fontSize: 11, color: 'var(--t2)', marginTop: 6, opacity: 0.7 },
  formRow: { marginBottom: 16 },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--t1)',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 6,
    color: 'var(--t1)',
    fontFamily: 'inherit',
    fontSize: 14,
    boxSizing: 'border-box',
  },
  navbar: {
    display: 'flex',
    gap: 12,
    padding: '16px 0',
    alignItems: 'center',
  },
  btnPrimary: {
    background: 'var(--gd)',
    border: '1px solid var(--gb)',
    color: 'var(--g)',
    padding: '10px 24px',
    borderRadius: 20,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
  },
  btnSecondary: {
    background: 'transparent',
    border: '1px solid var(--bd)',
    color: 'var(--t1)',
    padding: '8px 18px',
    borderRadius: 20,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
  },
  error: {
    background: '#3a1a1a',
    border: '1px solid #ff6b6b',
    color: '#ff9999',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  summaryItem: {
    display: 'flex',
    gap: 8,
    padding: 10,
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 8,
  },
  summaryIcon: { fontSize: 20 },
  summaryLabel: { fontSize: 11, color: 'var(--t2)', textTransform: 'uppercase' },
  summaryValue: { fontSize: 14, fontWeight: 500 },
  progress: {
    background: 'var(--bg)',
    border: '1px solid var(--gb)',
    padding: 20,
    borderRadius: 10,
    textAlign: 'center',
    marginTop: 16,
  },
  spinner: { fontSize: 32 },
  progressNote: { fontSize: 12, color: 'var(--t2)', marginTop: 8 },
  resultBlock: {
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 10,
    padding: 16,
    marginTop: 12,
  },
  resultTitle: { fontSize: 16, margin: '0 0 12px 0' },
  resultImg: {
    maxWidth: '100%',
    borderRadius: 8,
    marginBottom: 8,
  },
  takeBlock: {
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  pre: {
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    padding: 12,
    borderRadius: 6,
    fontSize: 12,
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    fontFamily: 'monospace',
  },
  copyBtn: {
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    color: 'var(--t1)',
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 6,
  },

  // ── Sessão 4: estilos novos pro Step 7 polido ─────────────────────
  copyBtnPrimary: {
    background: 'var(--g)',
    border: '1px solid var(--gb)',
    color: 'var(--bg)',
    padding: '6px 14px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: '1px solid var(--bd)',
  },
  variationsBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 10,
    marginBottom: 16,
  },
  variationsLabel: {
    fontSize: 12,
    color: 'var(--t2)',
    fontWeight: 600,
    marginRight: 4,
  },
  variationChip: {
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    color: 'var(--t1)',
    padding: '6px 12px',
    borderRadius: 16,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  variationChipPrimary: {
    background: 'var(--gd)',
    border: '1px solid var(--gb)',
    color: 'var(--g)',
    fontWeight: 600,
  },
  tutorialCard: {
    background: 'var(--gd)',
    border: '1px solid var(--gb)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  tutorialHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--g)',
    fontSize: 14,
    marginBottom: 8,
  },
  tutorialSteps: {
    margin: 0,
    paddingLeft: 24,
    fontSize: 13,
    lineHeight: 1.7,
    color: 'var(--t1)',
  },
  resultCard: {
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 10,
    padding: 16,
    marginTop: 12,
  },
  resultCardHighlight: {
    border: '2px solid var(--gb)',
    background: 'var(--bg)',
  },
  resultCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  resultImgLarge: {
    maxWidth: '100%',
    maxHeight: 480,
    borderRadius: 8,
    marginTop: 8,
    display: 'block',
  },
  veoTakeBlock: {
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  veoTakeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  takeBlockNew: {
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  takeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  takeMeta: {
    fontSize: 11,
    color: 'var(--t2)',
    background: 'var(--bg)',
    padding: '2px 8px',
    borderRadius: 8,
  },
  onScreenChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 12px',
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    borderRadius: 8,
    fontSize: 13,
  },
  hashtagChip: {
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    color: 'var(--g)',
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 12,
  },
  musicGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 8,
    marginTop: 8,
  },
  musicItem: {
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    padding: 10,
    borderRadius: 8,
  },
  searchTermChip: {
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    color: 'var(--t1)',
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  ctaItem: {
    padding: 10,
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    borderRadius: 8,
  },
};
