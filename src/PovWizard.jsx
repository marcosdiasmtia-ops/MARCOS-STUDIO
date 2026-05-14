// src/PovWizard.jsx (v2.1 — Opção C: UI exibe NAME amigável da voz em vez do id/hash)
//
// CHANGELOG v2.1 (13/05/2026 — Opção C, Sub-passo 2):
//   🆕 UI agora exibe o `name` amigável da voz (ex: "Raquel") em vez do
//      `id` cru (ex: "GDzHdQOi6jjf8zaXhCYD"). Mudança preparatória pra
//      migração das 15 vozes anglo → 13 vozes BR nativas (cujos ids são
//      voice_id hashes do ElevenLabs Voice Library).
//   🆕 Adicionado import de `getVoiceById` pra resolver name a partir de id.
//   🔁 Retrocompat 100%: usa fallback `v.name || v.id` em todos os displays.
//      Quando o data file v2.0 ainda não estiver deployado (vozes anglo
//      sem `name`), a UI exibe `id` (Sarah, Aria, etc.) idêntico ao
//      comportamento atual. Após data file v2.0 (vozes BR com `name`),
//      a UI exibe nomes humanos (Raquel, Paula, etc.).
//   🔁 Lógica interna (comparações, useEffect, mappings, payload pro backend)
//      continua usando `v.id` — só o RENDERING mudou.
//
// CHANGELOG v2.0 (12/05/2026 — Plano v4, Sub-lote C1):
//   🆕 Step 6 RENOMEADO "Estilo de câmera" → "Visual do POV". Reformulado
//      pra agrupar 3 conceitos:
//        • Câmera (4 estilos atuais — STYLES_CAMERA)
//        • Interação (4 estilos atuais — STYLES_INTERACTION)
//        • Nível de Imperfeição (6 níveis NOVO — POV_IMPERFECTIONS)
//      + checkbox "✨ Naturalidade extra" (NOVO) que se desabilita
//        automaticamente nos 3 níveis mais crus de imperfeição
//        (handheld_cru, iphone_caseiro, documentario) com tooltip.
//   🆕 Step 9 (Voz) ganha categoria "Intensidade Humana" antes da grade
//      de vozes (só se audioMode='voiced'). 9 níveis de POV_INTENSITIES.
//      Quando intensityId é escolhida, as vozes ganham filtragem
//      visual 3 níveis (recomendadas pra intensidade + claude rec + resto).
//   🆕 AUTO-SUGESTÃO DE INTENSIDADE: quando o user escolhe imperfeição
//      no Step 6, se ainda não tem intensityId, prerseleciona o default
//      de IMPERFECTION_TO_INTENSITY_DEFAULT. Pro nível 'documentario'
//      (que tem null no mapping) prerseleciona DOCUMENTARIO_INTENSITY_OPTIONS[0].
//   🆕 Step 3 (Tipo) e Step 4 (Cenário) ganham FILTRAGEM VISUAL INTELIGENTE
//      em 3 níveis (CSS-based, todos clicáveis):
//        🎯 Claude escolheu → border dourada + glow (1 card)
//        ✨ Ideal pro contexto → border colorida + badge (3-8 cards)
//        Restante → opacity 50% normal (clicável, fica claro que existe)
//      Step 3: "ideal" = tipos do grupo que combina com categoria do produto.
//      Step 4: "ideal" = TYPE_TO_SCENARIOS_IDEAL[typeId].
//   🆕 buildWizardData() retorna 3 campos novos:
//        imperfectionId, naturalExtra, intensityId
//   🆕 useEffect de initialData pré-popula os 3 novos states.
//   🆕 handleRecommendDefaults() aceita imperfectionId e intensityId
//      se Claude devolver. Salva todas as recs num único state
//      `claudeRecommendations` (consultado pelas filtragens visuais).
//   🔁 Retrocompat 100%: wizardData salvo na galeria sem os 3 campos
//      novos continua funcionando (defaults: imperfectionId=null,
//      naturalExtra=false, intensityId=null).
//
// CHANGELOG v1.3 (10/05/2026):
//   ✅ Aceita prop `initialData` (objeto wizardData salvo na galeria).
//   ✅ useEffect pré-preenche todos os states quando initialData muda.
//
// CHANGELOG v1.2 (10/05/2026):
//   - Wizard completo + botão Step 10 chama onComplete(wizardData)
//
// Wizard principal da aba POV. Coleta todas as decisões do usuário pra gerar
// um vídeo POV (Point of View) pra TikTok Shop.
//
// STEPS:
//   ✅ Step 1: Influencer
//   ✅ Step 2: Produto (7 campos)
//   ✅ Step 3: Tipo de POV (22 opções em 9 grupos + filtragem 3 níveis)
//   ✅ Step 4: Cenário (37 opções em 6 grupos + filtragem 3 níveis)
//   ✅ Step 5: Mãos (toggle Influencer ⟷ Anônima · 11 opções)
//   ✅ Step 6: Visual do POV (4 câmera + 4 interação + 6 imperfeição + naturalidade)
//   ✅ Step 7: Duração (4 opções com custo dinâmico)
//   ✅ Step 8: Áudio (Sem voz ⟷ Com voz · com warning experimental)
//   ✅ Step 9: Voz/Roteiro (9 intensidades + grade de vozes filtrada)
//   ✅ Step 10: Música (sugestão via callClaude — Comercial + Viral)

import { useState, useEffect, useMemo } from 'react';
import {
  getRealInfluencers,
  recommendPovDefaults,
  callClaude,
} from './api';
import { POV_TYPES, POV_TYPE_GROUPS } from './data/pov-types';
import { POV_SCENARIOS, POV_SCENARIO_GROUPS } from './data/pov-scenarios';
import { POV_HANDS, POV_HANDS_MODES, HANDS_FEMALE, HANDS_MALE, HANDS_SPECIAL } from './data/pov-hands';
import {
  POV_STYLES,
  POV_STYLE_CATEGORIES,
  POV_IMPERFECTIONS,                // 🆕 v2.0
  NATURALITY_EXTRA_DIRECTIVE,       // 🆕 v2.0 (pra tooltip)
  imperfectionDisablesNaturality,   // 🆕 v2.0
} from './data/pov-styles';
import { POV_DURATIONS } from './data/pov-durations';
import {
  POV_ELEVENLABS_VOICES,
  VOICES_FEMALE,
  VOICES_MALE,
  VOICE_BY_STYLE_FEMALE,
  VOICE_BY_STYLE_MALE,
  voiceMatchesIntensity,            // 🆕 v2.0
  getVoiceById,                     // 🆕 v2.1 (Opção C — resolver name a partir de id)
} from './data/pov-elevenlabs-voices';
import { POV_INTENSITIES } from './data/pov-intensities';  // 🆕 v2.0
import {
  TYPE_TO_SCENARIOS_IDEAL,             // 🆕 v2.0
  IMPERFECTION_TO_INTENSITY_DEFAULT,    // 🆕 v2.0
  DOCUMENTARIO_INTENSITY_OPTIONS,       // 🆕 v2.0
} from './data/pov-mappings';
import { UGC_CATEGORIES } from './data/ugc-categories';

const TOTAL_STEPS = 11;

const STEP_TITLES = [
  'Influencer',          // 1
  'Produto',             // 2
  'Tipo de POV',         // 3
  'Cenário',             // 4
  'Mãos',                // 5
  'Visual do POV',       // 6 🆕 v2.0 (era 'Estilo de câmera')
  'Duração',             // 7
  'Áudio',               // 8
  'Voz/Roteiro',         // 9
  'Música',              // 10
  'Resultado',           // 11
];

// Sub-lote 3b.1: steps 1-10 implementados, 11 fica placeholder
const IMPLEMENTED_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function PovWizard({ onComplete, onSwitchTab, initialData = null }) {
  // ── Estado principal ──────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // ── Step 1: Influencer ────────────────────────────────────────────────
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(null);

  // ── Step 2: Produto ───────────────────────────────────────────────────
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productOriginalPrice, setProductOriginalPrice] = useState('');
  const [productCategoryId, setProductCategoryId] = useState('');
  const [productPhoto, setProductPhoto] = useState(null);
  const [productViralTranscript, setProductViralTranscript] = useState('');

  // ── Step 3: Tipo de POV ───────────────────────────────────────────────
  const [typeId, setTypeId] = useState(null);
  const [recommendingDefaults, setRecommendingDefaults] = useState(false);
  const [recommendError, setRecommendError] = useState(null);

  // ── Step 4: Cenário ───────────────────────────────────────────────────
  const [scenarioId, setScenarioId] = useState(null);

  // ── Step 5: Mãos ──────────────────────────────────────────────────────
  // mode: 'influencer' (usa foto cadastrada) | 'anonymous' (escolhe da lista)
  const [handsMode, setHandsMode] = useState('influencer');
  const [handsId, setHandsId] = useState(null); // só usado se handsMode='anonymous'

  // ── Step 6: Estilo de câmera ─────────────────────────────────────────
  const [styleId, setStyleId] = useState(null);

  // 🆕 v2.0 — Step 6: Imperfeição visual (opcional) + Naturalidade extra (opcional)
  const [imperfectionId, setImperfectionId] = useState(null);
  const [naturalExtra, setNaturalExtra] = useState(false);

  // ── Step 7: Duração ──────────────────────────────────────────────────
  const [durationId, setDurationId] = useState(null);

  // ── Step 8: Áudio ────────────────────────────────────────────────────
  const [audioMode, setAudioMode] = useState('silent'); // 'silent' | 'voiced'
  const [voicedAcknowledged, setVoicedAcknowledged] = useState(false);

  // ── Step 9: Voz (só se voiced) ───────────────────────────────────────
  const [voiceId, setVoiceId] = useState(null);

  // 🆕 v2.0 — Step 9: Intensidade humana (só se voiced, opcional)
  const [intensityId, setIntensityId] = useState(null);

  // ── Step 10: Música ──────────────────────────────────────────────────
  const [musicSuggestion, setMusicSuggestion] = useState(null);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState(null);

  // 🆕 v2.0 — Recomendações do Claude (alimenta filtragem visual 3 níveis)
  // Salvado após handleRecommendDefaults — { typeId, scenarioId, styleId,
  // handsId, imperfectionId?, intensityId? }
  const [claudeRecommendations, setClaudeRecommendations] = useState(null);

  // ── Carrega influencers do localStorage ───────────────────────────────
  useEffect(() => {
    setProfiles(getRealInfluencers());
  }, []);

  // ── Pré-preenchimento via initialData (3c — "Editar config" da galeria) ──
  // Quando vier wizardData salvo, popula todos os states com os valores antigos.
  // NOTA: productPhoto NÃO é restaurado (base64 não fica salvo na galeria),
  // o usuário precisa re-fazer upload na edição.
  useEffect(() => {
    if (!initialData) return;
    if (initialData.influencerId) setSelectedProfileId(initialData.influencerId);
    if (initialData.productName) setProductName(initialData.productName);
    if (initialData.productDescription) setProductDescription(initialData.productDescription);
    if (initialData.productPrice) setProductPrice(initialData.productPrice);
    if (initialData.productOriginalPrice) setProductOriginalPrice(initialData.productOriginalPrice);
    if (initialData.productCategoryId) setProductCategoryId(initialData.productCategoryId);
    if (initialData.productViralTranscript) setProductViralTranscript(initialData.productViralTranscript);
    if (initialData.typeId) setTypeId(initialData.typeId);
    if (initialData.scenarioId) setScenarioId(initialData.scenarioId);
    if (initialData.handsMode) setHandsMode(initialData.handsMode);
    if (initialData.handsId) setHandsId(initialData.handsId);
    if (initialData.styleId) setStyleId(initialData.styleId);
    if (initialData.durationId) setDurationId(initialData.durationId);
    if (initialData.audioMode) {
      setAudioMode(initialData.audioMode);
      // Se vier voiced, já marca acknowledged (usuário já passou por isso antes)
      if (initialData.audioMode === 'voiced') setVoicedAcknowledged(true);
    }
    if (initialData.voiceId) setVoiceId(initialData.voiceId);
    if (initialData.musicSuggestion) setMusicSuggestion(initialData.musicSuggestion);
    // 🆕 v2.0 — restaura campos do Plano v4 (todos opcionais — retrocompat 100%)
    if (initialData.imperfectionId) setImperfectionId(initialData.imperfectionId);
    if (typeof initialData.naturalExtra === 'boolean') setNaturalExtra(initialData.naturalExtra);
    if (initialData.intensityId) setIntensityId(initialData.intensityId);
    console.log('[PovWizard] pré-preenchido com initialData');
  }, [initialData]);

  // ── Aviso ao fechar com progresso ─────────────────────────────────────
  useEffect(() => {
    function beforeUnload(e) {
      if (step > 1) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [step]);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) || null,
    [profiles, selectedProfileId]
  );

  // Gênero da influencer (pra filtrar mãos e vozes)
  const influencerGender = selectedProfile?.gender === 'male' ? 'male' : 'female';

  // ── Auto-sugere voz quando entra no Step 9 (se ainda não escolhido) ──
  useEffect(() => {
    if (step === 9 && audioMode === 'voiced' && !voiceId && styleId) {
      const map = influencerGender === 'male' ? VOICE_BY_STYLE_MALE : VOICE_BY_STYLE_FEMALE;
      const suggested = map?.[styleId];
      if (suggested) {
        setVoiceId(suggested);
      } else {
        const firstVoice = influencerGender === 'male' ? VOICES_MALE[0] : VOICES_FEMALE[0];
        if (firstVoice) setVoiceId(firstVoice.id);
      }
    }
  }, [step, audioMode, voiceId, styleId, influencerGender]);

  // 🆕 v2.0 — Auto-sugere intensidade quando user escolhe imperfeição (Plano v4)
  // Só prerseleciona se intensityId ainda não tem valor (preserva escolha manual).
  // Pro nível 'documentario' (mapping retorna null), usa o primeiro dos 3 options.
  useEffect(() => {
    if (!imperfectionId || intensityId) return;
    const defaultIntensity = IMPERFECTION_TO_INTENSITY_DEFAULT[imperfectionId];
    if (defaultIntensity) {
      setIntensityId(defaultIntensity);
    } else if (imperfectionId === 'documentario' && DOCUMENTARIO_INTENSITY_OPTIONS?.length > 0) {
      // documentario abre 3 opções — prerseleciona a 1ª (luxo_contemplativo segundo plano)
      setIntensityId(DOCUMENTARIO_INTENSITY_OPTIONS[0]);
    }
  }, [imperfectionId, intensityId]);

  // ── Validação por step ────────────────────────────────────────────────
  function isStepValid(s) {
    switch (s) {
      case 1: return !!selectedProfileId;
      case 2: return productName.trim().length >= 2 && productCategoryId && !!productPhoto;
      case 3: return !!typeId;
      case 4: return !!scenarioId;
      case 5: {
        if (handsMode === 'influencer') return true;
        if (handsMode === 'anonymous') return !!handsId;
        return false;
      }
      case 6: return !!styleId;
      case 7: return !!durationId;
      case 8: {
        if (audioMode === 'silent') return true;
        if (audioMode === 'voiced') return voicedAcknowledged;
        return false;
      }
      case 9: {
        if (audioMode === 'silent') return true;
        if (audioMode === 'voiced') return !!voiceId;
        return false;
      }
      case 10: return true; // música é opcional
      case 11: return false; // bloqueado até 3b.2
      default: return false;
    }
  }

  function canAdvance() {
    if (!IMPLEMENTED_STEPS.includes(step)) return false;
    return isStepValid(step);
  }

  // ── Navegação ─────────────────────────────────────────────────────────
  function handleBack() {
    if (step === 1) return;
    setStep((s) => s - 1);
  }

  function handleAdvance() {
    if (!canAdvance()) return;

    // Step 10 → último step navegável. Consolida wizardData e chama
    // onComplete(wizardData) — PovStudio troca pra modo 'output' (PovOutput).
    if (step === 10) {
      const wizardData = buildWizardData();
      if (onComplete) {
        onComplete(wizardData);
      } else {
        console.warn('[PovWizard] step 10 OK mas onComplete não fornecido (modo standalone)');
        setStep(11); // só vai pra placeholder se não tem callback
      }
      return;
    }

    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  }

  // ── Consolida todos os dados do wizard num objeto pro PovOutput ──────
  function buildWizardData() {
    // Tenta extrair base64 da face do influencer (modo 'influencer')
    let influencerFaceBase64 = null;
    let influencerFaceMimeType = null;
    if (handsMode === 'influencer' && selectedProfile) {
      const faceUrl = selectedProfile.facePhotoUrl || selectedProfile.previewUrl;
      const parsed = dataUrlToBase64(faceUrl);
      if (parsed) {
        influencerFaceBase64 = parsed.base64;
        influencerFaceMimeType = parsed.mimeType;
      }
    }

    return {
      // produto
      productName,
      productDescription,
      productPrice,
      productOriginalPrice,
      productCategoryId,
      productPhotoBase64: productPhoto?.base64 || null,
      productPhotoMimeType: productPhoto?.mimeType || null,
      productViralTranscript,

      // influencer
      influencerId: selectedProfileId,
      influencerName: selectedProfile?.name || null,
      influencerGender: influencerGender,
      influencerFaceBase64,
      influencerFaceMimeType,

      // POV config
      typeId,
      scenarioId,
      styleId,
      durationId,
      handsMode,
      handsId,
      audioMode,
      voiceId: audioMode === 'voiced' ? voiceId : null,

      // 🆕 v2.0 — Plano v4 (todos opcionais)
      imperfectionId: imperfectionId || null,
      naturalExtra: naturalExtra === true,
      intensityId: audioMode === 'voiced' ? (intensityId || null) : null,

      // música (do step 10) — opcional
      musicSuggestion: musicSuggestion || null,
    };
  }

  // ── Helper: dataURL → { base64, mimeType } ───────────────────────────
  function dataUrlToBase64(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    if (!dataUrl.startsWith('data:')) return null;
    const [header, base64] = dataUrl.split(',');
    if (!base64) return null;
    const mimeMatch = header.match(/data:([^;]+)/);
    return {
      base64,
      mimeType: mimeMatch?.[1] || 'image/jpeg',
    };
  }

  // ── Step 2: handler de upload de foto do produto ─────────────────────
  async function handleProductPhoto(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem');
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(',')[1];
        setProductPhoto({
          base64,
          mimeType: file.type,
          name: file.name,
          preview: dataUrl,
        });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('[PovWizard] erro upload produto:', err);
      alert('Erro ao ler arquivo');
    }
  }

  // ── Step 3: ✨ Claude sugere ──────────────────────────────────────────
  async function handleRecommendDefaults() {
    if (!productCategoryId || !productName) return;

    setRecommendingDefaults(true);
    setRecommendError(null);
    try {
      const result = await recommendPovDefaults({
        categoryId: productCategoryId,
        productName: productName,
        productDescription: productDescription || undefined,
        productPhotoBase64: productPhoto?.base64,
        productPhotoMimeType: productPhoto?.mimeType,
        influencerGender: influencerGender,
        handsMode: handsMode,
      });

      const rec = result.recommendations;
      // 🆕 v2.0 — Salva todas as recommendations num único objeto pra
      // alimentar a filtragem visual 3 níveis dos Steps 3, 4, 6, 9.
      // Inclui imperfectionId/intensityId se Claude devolver (opcional).
      const validRecs = {};

      // Aplica apenas IDs válidos (defesa contra hallucination)
      if (rec.typeId && POV_TYPES.find((t) => t.id === rec.typeId)) {
        setTypeId(rec.typeId);
        validRecs.typeId = rec.typeId;
      }
      if (rec.scenarioId && POV_SCENARIOS.find((s) => s.id === rec.scenarioId)) {
        setScenarioId(rec.scenarioId);
        validRecs.scenarioId = rec.scenarioId;
      }
      if (rec.styleId && POV_STYLES.find((s) => s.id === rec.styleId)) {
        setStyleId(rec.styleId);
        validRecs.styleId = rec.styleId;
      }
      if (rec.handsId && POV_HANDS.find((h) => h.id === rec.handsId)) {
        setHandsId(rec.handsId);
        validRecs.handsId = rec.handsId;
      }
      // 🆕 v2.0 — campos novos do Plano v4 (Claude pode passar a devolver no futuro)
      if (rec.imperfectionId && POV_IMPERFECTIONS.find((i) => i.id === rec.imperfectionId)) {
        setImperfectionId(rec.imperfectionId);
        validRecs.imperfectionId = rec.imperfectionId;
      }
      if (rec.intensityId && POV_INTENSITIES.find((i) => i.id === rec.intensityId)) {
        setIntensityId(rec.intensityId);
        validRecs.intensityId = rec.intensityId;
      }

      setClaudeRecommendations(validRecs);

      console.log('[PovWizard] Claude sugeriu:', rec, '· source:', result.source);
    } catch (err) {
      console.error('[PovWizard] recommendPovDefaults falhou:', err);
      setRecommendError(err.message || 'Erro ao chamar Claude');
    } finally {
      setRecommendingDefaults(false);
    }
  }

  // ── Step 10: ✨ Sugerir música via callClaude ─────────────────────────
  async function handleSuggestMusic() {
    if (!productCategoryId || !typeId || !styleId) return;

    setMusicLoading(true);
    setMusicError(null);
    try {
      const productInfo = `Produto: ${productName}${productDescription ? ` — ${productDescription.substring(0, 200)}` : ''}`;
      const styleName = POV_STYLES.find((s) => s.id === styleId)?.name || styleId;
      const typeName = POV_TYPES.find((t) => t.id === typeId)?.name || typeId;
      const categoryName = UGC_CATEGORIES.find((c) => c.id === productCategoryId)?.name || productCategoryId;

      const systemPrompt = `Você é especialista em música pra vídeos UGC TikTok Shop em PT-BR.

Sua missão: sugerir 2 músicas pra um vídeo POV (Point of View) baseado no contexto do produto e estilo. Uma sugestão Comercial (música livre/Pixabay/Epidemic Sound) e uma Viral (música real do TikTok atual).

Contexto:
- ${productInfo}
- Categoria: ${categoryName}
- Tipo de POV: ${typeName}
- Estilo de câmera: ${styleName}

Critérios:
1. Comercial: descreva mood + gênero + BPM aproximado + termos de busca pra Marcos achar em bibliotecas livres (Pixabay, Epidemic Sound)
2. Viral: sugira 1 música real que esteja em alta no TikTok BR em 2026 (artista + nome + breve justificativa de por que combina). Se não souber sobre tendências atuais, sugira algo evergreen do TikTok BR.

RESPONDA APENAS JSON VÁLIDO (sem markdown, sem backticks):
{
  "comercial": {
    "mood": "string (ex: 'energético upbeat', 'dreamy chill')",
    "genre": "string (ex: 'pop', 'lofi', 'electronic')",
    "bpm": number,
    "searchTerms": ["string", "string", "string"],
    "rationale": "string em PT-BR, 1 frase"
  },
  "viral": {
    "title": "string",
    "artist": "string",
    "rationale": "string em PT-BR, 1 frase"
  }
}`;

      const userMessage = `Sugira 1 música Comercial e 1 Viral pra esse vídeo POV. Retorne APENAS o JSON.`;

      const result = await callClaude(systemPrompt, userMessage);
      setMusicSuggestion(result);
      console.log('[PovWizard] Música sugerida:', result);
    } catch (err) {
      console.error('[PovWizard] sugerir música falhou:', err);
      setMusicError(err.message || 'Erro ao chamar Claude');
    } finally {
      setMusicLoading(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER STEPS
  // ═══════════════════════════════════════════════════════════════════════

  function renderStep1Influencer() {
    if (profiles.length === 0) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>👤</div>
          <h3 style={{ color: 'var(--g)', marginBottom: 12, fontSize: 17 }}>
            Nenhum influencer cadastrado
          </h3>
          <p style={{ color: 'var(--t2)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            A aba POV usa influencers cadastrados na aba <strong>VTON</strong> ou <strong>Avatar IA</strong>.
            Cadastre pelo menos 1 antes de continuar.
          </p>
          <button
            className="main-btn"
            style={{ maxWidth: 240, margin: '0 auto', display: 'block' }}
            onClick={() => onSwitchTab?.('influencers')}
          >
            👤 Ir pra aba Influencers
          </button>
        </div>
      );
    }

    return (
      <div className="card">
        <div className="card-title">Selecione o influencer</div>
        <div className="profile-list">
          {profiles.map((p) => {
            const isSelected = p.id === selectedProfileId;
            const photoUrl = p.facePhotoUrl || p.previewUrl || null;
            return (
              <div
                key={p.id}
                className="profile-card"
                onClick={() => setSelectedProfileId(p.id)}
                style={{
                  borderColor: isSelected ? 'var(--g)' : 'var(--bd)',
                  background: isSelected ? 'rgba(212,165,116,0.06)' : 'var(--sf)',
                }}
              >
                <div className="profile-avatar">
                  {photoUrl ? (
                    <img src={photoUrl} alt={p.name} />
                  ) : (
                    <span>{p.gender === 'male' ? '👨' : '👩'}</span>
                  )}
                </div>
                <div className="profile-info">
                  <div className="profile-name">
                    {isSelected && <span style={{ color: 'var(--g)' }}>✓ </span>}
                    {p.name}
                    {p.type === 'avatar' && (
                      <span className="badge-sm" style={{ marginLeft: 8 }}>AVATAR IA</span>
                    )}
                  </div>
                  <div className="profile-body">
                    {p.gender === 'male' ? '👨 Masculino' : '👩 Feminino'}
                    {p.age && ` · ${p.age} anos`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="hint" style={{ marginTop: 12, textAlign: 'center' }}>
          A foto do influencer será usada como referência das mãos no modo "Da influencer".
        </p>
      </div>
    );
  }

  function renderStep2Product() {
    return (
      <div className="card">
        <div className="card-title">Dados do produto</div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <label className="upload-area-9-16" style={{ flexShrink: 0 }}>
            {productPhoto ? (
              <img src={productPhoto.preview} alt="Produto" />
            ) : (
              <span>📷<br />Foto do<br />produto<br />(9:16)</span>
            )}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleProductPhoto(e.target.files?.[0])}
            />
          </label>
          <div style={{ flex: 1 }}>
            <div className="field">
              <label>Nome do produto *</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Body Splash Floral 250ml"
                maxLength={120}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Categoria *</label>
              <select
                value={productCategoryId}
                onChange={(e) => setProductCategoryId(e.target.value)}
              >
                <option value="">— Escolha —</option>
                {renderCategoryOptions()}
              </select>
            </div>
          </div>
        </div>

        <div className="field">
          <label>Descrição técnica + diferenciais <span className="opt">(opcional)</span></label>
          <textarea
            rows={3}
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            placeholder="Fragrância floral suave com toque de baunilha. 8h de fixação. Vegano."
            maxLength={500}
          />
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Preço (R$) <span className="opt">(opcional)</span></label>
            <input
              type="text"
              value={productPrice}
              onChange={(e) => setProductPrice(e.target.value)}
              placeholder="49,90"
              maxLength={20}
            />
          </div>
          <div className="field">
            <label>Preço original <span className="opt">(promoção)</span></label>
            <input
              type="text"
              value={productOriginalPrice}
              onChange={(e) => setProductOriginalPrice(e.target.value)}
              placeholder="89,90"
              maxLength={20}
            />
          </div>
        </div>

        <div className="field">
          <label>
            Transcrição viral <span className="opt">(opcional — vídeo viral pra inspirar)</span>
          </label>
          <textarea
            rows={2}
            value={productViralTranscript}
            onChange={(e) => setProductViralTranscript(e.target.value)}
            placeholder="Cole aqui a transcrição de um vídeo viral pra Claude se inspirar..."
            maxLength={1000}
          />
        </div>
      </div>
    );
  }

  function renderStep3Type() {
    // 🆕 v2.0 — Heurística "ideal pra categoria do produto" (Plano v4)
    // Mapeia category group → POV_TYPE_GROUPS que tipicamente funcionam bem.
    // Pra produtos beauty/perfume, tipos handheld/oral/worn fazem sentido.
    // Pra fashion, tipos worn/social/shopping. Etc.
    const CATEGORY_GROUP_TO_TYPE_GROUPS = {
      beauty:      ['handheld', 'oral', 'worn'],
      fashion:     ['worn', 'shopping', 'social'],
      home:        ['handheld', 'special', 'storytelling'],
      electronics: ['handheld', 'special'],
      health:      ['handheld', 'oral'],
      other:       ['handheld', 'special'],
    };
    const productCategory = UGC_CATEGORIES.find((c) => c.id === productCategoryId);
    const idealTypeGroups = productCategory
      ? (CATEGORY_GROUP_TO_TYPE_GROUPS[productCategory.group] || [])
      : [];
    const idealTypeIds = POV_TYPES
      .filter((t) => idealTypeGroups.includes(t.group))
      .map((t) => t.id);

    return (
      <div className="card">
        <div className="card-header-row">
          <div className="card-title">Tipo de POV</div>
          <button
            className="copy-btn"
            onClick={handleRecommendDefaults}
            disabled={recommendingDefaults || !productCategoryId}
            title={!productCategoryId ? 'Selecione categoria primeiro' : 'Claude sugere com base no produto'}
            style={{
              background: recommendingDefaults ? 'var(--gd)' : 'rgba(139,184,232,0.1)',
              borderColor: 'rgba(139,184,232,0.25)',
              color: 'var(--bl)',
              fontWeight: 600,
              padding: '5px 14px',
            }}
          >
            {recommendingDefaults ? '⏳ Pensando...' : '✨ Claude sugere'}
          </button>
        </div>

        {recommendError && (
          <div className="error-box" style={{ marginBottom: 12 }}>
            <p>⚠️ {recommendError}</p>
          </div>
        )}

        <p className="hint" style={{ marginBottom: 16 }}>
          Como a mão interage com o produto. Escolha o que combina com a forma física.
          {productCategoryId && idealTypeIds.length > 0 && (
            <span style={{ color: 'var(--gr)', display: 'block', marginTop: 4 }}>
              💡 Destacamos os tipos que combinam mais com <strong>{productCategory.name}</strong>.
            </span>
          )}
        </p>

        {POV_TYPE_GROUPS.map((group) => {
          const typesOfGroup = POV_TYPES.filter((t) => t.group === group.id);
          if (typesOfGroup.length === 0) return null;
          return (
            <FilteredGroupedGrid
              key={group.id}
              groupLabel={`${group.emoji} ${group.name}`}
              items={typesOfGroup}
              selectedId={typeId}
              onSelect={setTypeId}
              claudeRecommendedId={claudeRecommendations?.typeId}
              idealIds={idealTypeIds}
            />
          );
        })}

        {typeId && (
          <InfoBox label="💡 Bom pra:" text={POV_TYPES.find((t) => t.id === typeId)?.bestFor} />
        )}
      </div>
    );
  }

  function renderStep4Scenario() {
    // 🆕 v2.0 — Cenários ideais pelo typeId escolhido (Plano v4)
    // TYPE_TO_SCENARIOS_IDEAL[typeId] retorna lista de IDs em ordem de
    // preferência. reflexo_espelho tem 'closet_espelhado' como obrigatório
    // na 1ª posição (M3 do plano).
    const idealScenarioIds = typeId && TYPE_TO_SCENARIOS_IDEAL[typeId]
      ? TYPE_TO_SCENARIOS_IDEAL[typeId]
      : [];

    return (
      <div className="card">
        <div className="card-title">Cenário do POV</div>
        <p className="hint" style={{ marginBottom: 16 }}>
          Onde o produto vai aparecer. Escolha o ambiente que combina com o vibe do produto.
          {typeId && idealScenarioIds.length > 0 && (
            <span style={{ color: 'var(--gr)', display: 'block', marginTop: 4 }}>
              💡 Destacamos os cenários ideais pro tipo <strong>{POV_TYPES.find((t) => t.id === typeId)?.name}</strong>.
            </span>
          )}
        </p>

        {POV_SCENARIO_GROUPS.map((group) => {
          const scenariosOfGroup = POV_SCENARIOS.filter((s) => s.group === group.id);
          if (scenariosOfGroup.length === 0) return null;
          return (
            <FilteredGroupedGrid
              key={group.id}
              groupLabel={`${group.emoji} ${group.name}`}
              items={scenariosOfGroup}
              selectedId={scenarioId}
              onSelect={setScenarioId}
              claudeRecommendedId={claudeRecommendations?.scenarioId}
              idealIds={idealScenarioIds}
            />
          );
        })}

        {scenarioId && (
          <InfoBox
            label="🎯 Cenário escolhido:"
            text={POV_SCENARIOS.find((s) => s.id === scenarioId)?.description}
          />
        )}
      </div>
    );
  }

  function renderStep5Hands() {
    // Filtra mãos disponíveis pelo gênero da influencer (modo anonymous)
    const handsForGender = influencerGender === 'male'
      ? [...HANDS_MALE, ...HANDS_SPECIAL]
      : [...HANDS_FEMALE, ...HANDS_SPECIAL];

    return (
      <div className="card">
        <div className="card-title">Mãos do POV</div>

        <p className="hint" style={{ marginBottom: 12 }}>
          De quem são as mãos que aparecem no vídeo?
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {POV_HANDS_MODES.map((m) => {
            const isActive = handsMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  setHandsMode(m.id);
                  if (m.id === 'influencer') setHandsId(null);
                }}
                style={{
                  flex: 1,
                  background: isActive ? 'var(--gd)' : 'var(--sf)',
                  border: isActive ? '1px solid var(--g)' : '1px solid var(--bd)',
                  color: isActive ? 'var(--g)' : 'var(--t)',
                  padding: '12px 16px',
                  borderRadius: 'var(--rs)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  {isActive && '✓ '}{m.emoji} {m.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 400 }}>
                  {m.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* Modo Influencer: mostra preview */}
        {handsMode === 'influencer' && selectedProfile && (
          <div style={{
            background: 'rgba(107,189,138,0.08)',
            border: '1px solid rgba(107,189,138,0.25)',
            borderRadius: 'var(--rs)',
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <div className="profile-avatar" style={{ width: 50, height: 50 }}>
              {selectedProfile.facePhotoUrl ? (
                <img src={selectedProfile.facePhotoUrl} alt={selectedProfile.name} />
              ) : (
                <span>{influencerGender === 'male' ? '👨' : '👩'}</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--gr)', fontWeight: 600 }}>
                ✓ Mãos da {selectedProfile.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                Vai usar a foto cadastrada como referência. Consistência absoluta entre vídeos.
              </div>
            </div>
          </div>
        )}

        {/* Modo Anonymous: lista filtrada por gênero */}
        {handsMode === 'anonymous' && (
          <>
            <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
              Mãos disponíveis ({influencerGender === 'male' ? 'masculinas' : 'femininas'} + especiais)
            </div>
            <GroupedGrid
              groupLabel=""
              items={handsForGender}
              selectedId={handsId}
              onSelect={setHandsId}
            />
            {handsId && (
              <InfoBox label="💡 Bom pra:" text={POV_HANDS.find((h) => h.id === handsId)?.bestFor} />
            )}
          </>
        )}
      </div>
    );
  }

  function renderStep6Style() {
    // 🆕 v2.0 — Visual do POV (Plano v4): Câmera + Interação + Imperfeição + Naturalidade
    const naturalDisabled = imperfectionDisablesNaturality(imperfectionId);
    const selectedImperfection = imperfectionId
      ? POV_IMPERFECTIONS.find((i) => i.id === imperfectionId)
      : null;

    return (
      <div className="card">
        <div className="card-title">Visual do POV</div>
        <p className="hint" style={{ marginBottom: 16 }}>
          Como a câmera vai mostrar o produto. Combine câmera + interação + nível de imperfeição visual.
        </p>

        {/* ── 1. Câmera + Interação (8 estilos atuais, 2 grupos) ───── */}
        {POV_STYLE_CATEGORIES.map((cat) => {
          const stylesOfCat = POV_STYLES.filter((s) => s.category === cat.id);
          if (stylesOfCat.length === 0) return null;
          return (
            <FilteredGroupedGrid
              key={cat.id}
              groupLabel={`${cat.emoji || '🎬'} ${cat.name}`}
              items={stylesOfCat}
              selectedId={styleId}
              onSelect={setStyleId}
              claudeRecommendedId={claudeRecommendations?.styleId}
            />
          );
        })}

        {styleId && (
          <InfoBox label="💡 Bom pra:" text={POV_STYLES.find((s) => s.id === styleId)?.bestFor} />
        )}

        {/* ── 2. Separador L2 ──────────────────────────────────────── */}
        <div style={{
          height: 1,
          background: 'var(--bd)',
          margin: '20px 0 18px',
        }} />

        {/* ── 3. Nível de Imperfeição (6 opções NOVO) ──────────────── */}
        <div style={{
          fontSize: 11,
          color: 'var(--t2)',
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontWeight: 700,
          marginBottom: 8,
        }}>
          🎬 Nível de Imperfeição <span style={{ color: 'var(--t3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional — controla o quão "produzido" ou "cru" o vídeo parece)</span>
        </div>
        <FilteredGroupedGrid
          groupLabel=""
          items={POV_IMPERFECTIONS}
          selectedId={imperfectionId}
          onSelect={(id) => {
            // Toggle: clicar de novo na mesma desseleciona (volta pra null)
            setImperfectionId((curr) => (curr === id ? null : id));
          }}
          claudeRecommendedId={claudeRecommendations?.imperfectionId}
        />

        {selectedImperfection && (
          <InfoBox
            label={`🎬 Imperfeição: ${selectedImperfection.name}`}
            text={selectedImperfection.bestFor || selectedImperfection.description}
          />
        )}

        {/* ── 4. Checkbox Naturalidade Extra (NOVO) ───────────────── */}
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            cursor: naturalDisabled ? 'not-allowed' : 'pointer',
            background: naturalDisabled ? 'rgba(255,255,255,0.02)' : 'var(--sf)',
            border: `1px solid ${naturalExtra && !naturalDisabled ? 'var(--g)' : 'var(--bd)'}`,
            borderRadius: 'var(--rs)',
            padding: 12,
            marginTop: 14,
            opacity: naturalDisabled ? 0.55 : 1,
            transition: 'all 0.2s',
          }}
          title={naturalDisabled
            ? 'Esta imperfeição já tem naturalidade nativa — não precisa do extra'
            : 'Adiciona micro-shake e focus breathing pra parecer ainda mais autêntico'}
        >
          <input
            type="checkbox"
            checked={naturalExtra && !naturalDisabled}
            disabled={naturalDisabled}
            onChange={(e) => setNaturalExtra(e.target.checked)}
            style={{
              cursor: naturalDisabled ? 'not-allowed' : 'pointer',
              marginTop: 2,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--t)', fontWeight: 600, marginBottom: 3 }}>
              ✨ Naturalidade extra
              {naturalDisabled && (
                <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 400, marginLeft: 8 }}>
                  (já incluído neste nível)
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.4 }}>
              {naturalDisabled
                ? `O nível "${selectedImperfection?.name}" já tem naturalidade nativa.`
                : 'Adiciona handheld sutil + focus breathing + micro-ajustes na câmera (NATURALITY_EXTRA_DIRECTIVE).'}
            </div>
          </div>
        </label>
      </div>
    );
  }

  function renderStep7Duration() {
    return (
      <div className="card">
        <div className="card-title">Duração do vídeo</div>
        <p className="hint" style={{ marginBottom: 16 }}>
          Quanto tempo o vídeo deve durar. Cada take = 10s. Custo aumenta proporcionalmente
          {audioMode === 'voiced' ? ' (modo com voz adiciona ~$0,06).' : '.'}
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
        }}>
          {POV_DURATIONS.map((d) => {
            const isSelected = d.id === durationId;
            const cost = audioMode === 'voiced' ? d.estimatedCostVoiced : d.estimatedCostSilent;
            return (
              <div
                key={d.id}
                onClick={() => setDurationId(d.id)}
                style={{
                  background: isSelected ? 'rgba(212,165,116,0.1)' : 'var(--cd)',
                  border: isSelected ? '2px solid var(--g)' : '2px solid var(--bd)',
                  borderRadius: 'var(--rs)',
                  padding: 14,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: isSelected ? 'var(--g)' : 'var(--t)',
                  marginBottom: 4,
                }}>
                  {isSelected && '✓ '}{d.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 8 }}>
                  {d.composition}
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'var(--bl)',
                  background: 'var(--blb)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  display: 'inline-block',
                  fontWeight: 600,
                }}>
                  ~${cost?.toFixed(2) || '?'}
                </div>
              </div>
            );
          })}
        </div>

        {durationId && (
          <InfoBox
            label="📊 Detalhes:"
            text={POV_DURATIONS.find((d) => d.id === durationId)?.description}
          />
        )}
      </div>
    );
  }

  function renderStep8Audio() {
    return (
      <div className="card">
        <div className="card-title">Modo de áudio</div>
        <p className="hint" style={{ marginBottom: 16 }}>
          Vídeo silencioso (vibe POV TikTok puro) ou com narração off?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { id: 'silent', emoji: '🔇', name: 'Sem voz', description: 'Vídeo mudo. Você adiciona música no CapCut depois. Vibe TikTok puro.' },
            { id: 'voiced', emoji: '🎙️', name: 'Com voz', description: 'Narração em PT-BR via ElevenLabs v3. Roteiro gerado pelo Claude.' },
          ].map((m) => {
            const isActive = audioMode === m.id;
            return (
              <div
                key={m.id}
                onClick={() => {
                  setAudioMode(m.id);
                  if (m.id === 'silent') setVoicedAcknowledged(false);
                }}
                style={{
                  background: isActive ? 'rgba(212,165,116,0.1)' : 'var(--cd)',
                  border: isActive ? '2px solid var(--g)' : '2px solid var(--bd)',
                  borderRadius: 'var(--rs)',
                  padding: 18,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>{m.emoji}</div>
                <div style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: isActive ? 'var(--g)' : 'var(--t)',
                  marginBottom: 6,
                }}>
                  {isActive && '✓ '}{m.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.4 }}>
                  {m.description}
                </div>
              </div>
            );
          })}
        </div>

        {/* Aviso de voiced experimental */}
        {audioMode === 'voiced' && (
          <div style={{
            background: 'rgba(255,150,80,0.08)',
            border: '1px solid rgba(255,150,80,0.3)',
            borderRadius: 'var(--rs)',
            padding: 14,
          }}>
            <div style={{ fontSize: 13, color: '#ffa75e', fontWeight: 700, marginBottom: 6 }}>
              ⚠️ Modo Com voz — experimental v1.0
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, marginBottom: 10 }}>
              O áudio é gerado por take e depois concatenado. Como cada áudio dura ~5-8s mas
              cada take dura 10s, pode haver pequena <strong>dessincronia entre fala e movimento</strong>.
              Se incomodar, troca pra modo "Sem voz" e adiciona narração no CapCut depois.
            </div>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--t)',
            }}>
              <input
                type="checkbox"
                checked={voicedAcknowledged}
                onChange={(e) => setVoicedAcknowledged(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Entendi a limitação e quero usar modo Com voz mesmo assim
            </label>
          </div>
        )}
      </div>
    );
  }

  function renderStep9Voice() {
    if (audioMode === 'silent') {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔇</div>
          <h3 style={{ color: 'var(--g)', fontSize: 16, marginBottom: 8 }}>
            Modo silencioso ativo
          </h3>
          <p style={{ color: 'var(--t2)', fontSize: 13, lineHeight: 1.6 }}>
            Como você escolheu modo "Sem voz", esta etapa não se aplica.
            Avance pra próxima.
          </p>
        </div>
      );
    }

    const voicesAvailable = influencerGender === 'male' ? VOICES_MALE : VOICES_FEMALE;

    // 🆕 v2.0 — Vozes recomendadas pra intensidade selecionada (Plano v4)
    const selectedIntensity = intensityId
      ? POV_INTENSITIES.find((i) => i.id === intensityId)
      : null;
    const recommendedVoiceIdForIntensity = selectedIntensity
      ? (selectedIntensity.recommendedVoices?.[influencerGender] || null)
      : null;
    const allMatchingVoiceIds = intensityId
      ? voicesAvailable
          .filter((v) => voiceMatchesIntensity(v.id, intensityId))
          .map((v) => v.id)
      : [];

    return (
      <div className="card">
        <div className="card-title">Voz pra narração (ElevenLabs v3)</div>

        {/* ── 🆕 v2.0 — Intensidade Humana (Plano v4) ──────────────── */}
        <div style={{
          fontSize: 11,
          color: 'var(--t2)',
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontWeight: 700,
          marginTop: 4,
          marginBottom: 8,
        }}>
          🎚️ Intensidade Humana <span style={{ color: 'var(--t3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional — controla o tom/ritmo da fala)</span>
        </div>
        <p className="hint" style={{ marginBottom: 12 }}>
          Define o estilo de fala do roteiro: do comercial limpo ao hype urgente.
          {imperfectionId && intensityId === IMPERFECTION_TO_INTENSITY_DEFAULT[imperfectionId] && (
            <span style={{ color: 'var(--gr)', display: 'block', marginTop: 4 }}>
              💡 Pré-selecionada com base na imperfeição visual escolhida no Step 6.
            </span>
          )}
        </p>

        <FilteredGroupedGrid
          groupLabel=""
          items={POV_INTENSITIES}
          selectedId={intensityId}
          onSelect={(id) => {
            // Toggle: clicar de novo desseleciona (volta pra null)
            setIntensityId((curr) => (curr === id ? null : id));
          }}
        />

        {selectedIntensity && (
          <InfoBox
            label={`🎚️ Intensidade: ${selectedIntensity.name}`}
            text={selectedIntensity.bestFor || selectedIntensity.description}
          />
        )}

        {/* ── Separador L2 ────────────────────────────────────────── */}
        <div style={{
          height: 1,
          background: 'var(--bd)',
          margin: '20px 0 14px',
        }} />

        {/* ── Vozes (com filtragem 3 níveis se tem intensidade) ───── */}
        <div style={{
          fontSize: 11,
          color: 'var(--t2)',
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontWeight: 700,
          marginBottom: 8,
        }}>
          🎙️ Vozes disponíveis <span style={{ color: 'var(--t3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({influencerGender === 'male' ? 'masculinas' : 'femininas'})</span>
        </div>
        <p className="hint" style={{ marginBottom: 12 }}>
          {voiceId && (
            <span>
              💡 Voz selecionada: <strong>{getVoiceById(voiceId)?.name || voiceId}</strong>.
            </span>
          )}
          {intensityId && allMatchingVoiceIds.length > 0 && (
            <span style={{ color: 'var(--gr)', display: 'block', marginTop: 4 }}>
              ✨ Destacamos as vozes recomendadas pra <strong>{selectedIntensity?.name}</strong>.
            </span>
          )}
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 8,
        }}>
          {voicesAvailable.map((v) => {
            const isSelected = v.id === voiceId;
            const isRecommendedForIntensity = recommendedVoiceIdForIntensity === v.id;
            const isMatchingIntensity = intensityId && allMatchingVoiceIds.includes(v.id);
            // 3 níveis: recommended (🎯 dourado) > matching (✨ verde) > dimmed (50%)
            const hasFiltering = !!intensityId;
            const isDimmed = hasFiltering && !isRecommendedForIntensity && !isMatchingIntensity && !isSelected;

            let border, background, glow;
            if (isSelected) {
              border = '2px solid var(--g)';
              background = 'rgba(212,165,116,0.1)';
              glow = isRecommendedForIntensity ? '0 0 12px rgba(212,165,116,0.35)' : 'none';
            } else if (isRecommendedForIntensity) {
              border = '2px solid var(--g)';
              background = 'rgba(212,165,116,0.05)';
              glow = '0 0 10px rgba(212,165,116,0.25)';
            } else if (isMatchingIntensity) {
              border = '2px solid rgba(107,189,138,0.5)';
              background = 'rgba(107,189,138,0.04)';
              glow = 'none';
            } else {
              border = '2px solid var(--bd)';
              background = 'var(--cd)';
              glow = 'none';
            }

            return (
              <div
                key={v.id}
                onClick={() => setVoiceId(v.id)}
                style={{
                  background,
                  border,
                  boxShadow: glow,
                  borderRadius: 'var(--rs)',
                  padding: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  opacity: isDimmed ? 0.5 : 1,
                  position: 'relative',
                }}
              >
                {(isRecommendedForIntensity || isMatchingIntensity) && !isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: -8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 8,
                    background: isRecommendedForIntensity ? 'var(--g)' : 'rgba(107,189,138,0.85)',
                    color: '#0a0a0a',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}>
                    {isRecommendedForIntensity ? '🎯 Recomendada' : '✨ Combina'}
                  </div>
                )}
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: isSelected ? 'var(--g)' : (isRecommendedForIntensity ? 'var(--g)' : 'var(--t)'),
                  marginBottom: 4,
                }}>
                  {isSelected && '✓ '}{v.name || v.id}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.4 }}>
                  {v.description}
                </div>
              </div>
            );
          })}
        </div>

        <p className="hint" style={{ marginTop: 16, fontSize: 11 }}>
          🎙️ A voz aceita audio tags inline tipo <code style={{ color: 'var(--bl)' }}>[excited]</code>,{' '}
          <code style={{ color: 'var(--bl)' }}>[whispers]</code> que serão geradas pelo Claude no roteiro.
        </p>
      </div>
    );
  }

  function renderStep10Music() {
    return (
      <div className="card">
        <div className="card-header-row">
          <div className="card-title">Sugestão de música</div>
          <button
            className="copy-btn"
            onClick={handleSuggestMusic}
            disabled={musicLoading || !typeId || !styleId}
            title={!typeId || !styleId ? 'Defina tipo e estilo primeiro' : 'Claude sugere música baseado no contexto'}
            style={{
              background: musicLoading ? 'var(--gd)' : 'rgba(139,184,232,0.1)',
              borderColor: 'rgba(139,184,232,0.25)',
              color: 'var(--bl)',
              fontWeight: 600,
              padding: '5px 14px',
            }}
          >
            {musicLoading ? '⏳ Pensando...' : '✨ Sugerir música'}
          </button>
        </div>

        {musicError && (
          <div className="error-box" style={{ marginBottom: 12 }}>
            <p>⚠️ {musicError}</p>
          </div>
        )}

        <p className="hint" style={{ marginBottom: 16 }}>
          Música é <strong>opcional</strong> e adicionada no CapCut depois.
          Aqui o Claude sugere 2 opções: uma <strong>Comercial</strong> (livre de direitos) e uma <strong>Viral</strong> (música real do TikTok).
        </p>

        {!musicSuggestion && !musicLoading && (
          <div style={{
            background: 'var(--sf)',
            border: '1px dashed var(--bd)',
            borderRadius: 'var(--rs)',
            padding: 24,
            textAlign: 'center',
            color: 'var(--t3)',
            fontSize: 13,
          }}>
            🎵 Clique em "✨ Sugerir música" pra Claude analisar produto + estilo e gerar 2 sugestões.
            <br />
            Ou pule essa etapa — você pode escolher música no CapCut depois.
          </div>
        )}

        {musicSuggestion && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* Comercial */}
            <div style={{
              background: 'var(--blb)',
              border: '1px solid rgba(139,184,232,0.25)',
              borderRadius: 'var(--rs)',
              padding: 14,
            }}>
              <div style={{ fontSize: 11, color: 'var(--bl)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                🎵 Comercial (livre de direitos)
              </div>
              <div style={{ fontSize: 13, color: 'var(--t)', marginBottom: 4 }}>
                <strong>{musicSuggestion.comercial?.mood}</strong> · {musicSuggestion.comercial?.genre}
                {' · '}{musicSuggestion.comercial?.bpm} BPM
              </div>
              <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 8 }}>
                Buscar: {(musicSuggestion.comercial?.searchTerms || []).join(', ')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)', fontStyle: 'italic', lineHeight: 1.4 }}>
                {musicSuggestion.comercial?.rationale}
              </div>
            </div>

            {/* Viral */}
            <div style={{
              background: 'rgba(255,80,150,0.08)',
              border: '1px solid rgba(255,80,150,0.25)',
              borderRadius: 'var(--rs)',
              padding: 14,
            }}>
              <div style={{ fontSize: 11, color: '#ff6b9d', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                🔥 Viral (TikTok atual)
              </div>
              <div style={{ fontSize: 13, color: 'var(--t)', marginBottom: 4 }}>
                <strong>{musicSuggestion.viral?.title}</strong>
              </div>
              <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 8 }}>
                {musicSuggestion.viral?.artist}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)', fontStyle: 'italic', lineHeight: 1.4 }}>
                {musicSuggestion.viral?.rationale}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderStep11Placeholder() {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎬</div>
        <h3 style={{ color: 'var(--g)', fontSize: 17, marginBottom: 12 }}>
          Geração + Resultado
        </h3>
        <p style={{ color: 'var(--t2)', fontSize: 14, lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
          Em construção — vem no <strong>Sub-lote 3b.2</strong>.<br /><br />
          Aqui ficará o botão <strong>"🎬 Gerar POV"</strong> que dispara a pipeline completa
          (7 chamadas a fal.ai), polling visual com progresso por take, e a tela final
          com vídeo + pacote de postagem (descrição, hashtags, CTAs).
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div>
      <Stepper currentStep={step} totalSteps={TOTAL_STEPS} titles={STEP_TITLES} />

      <div style={{ marginBottom: 16 }}>
        {step === 1 && renderStep1Influencer()}
        {step === 2 && renderStep2Product()}
        {step === 3 && renderStep3Type()}
        {step === 4 && renderStep4Scenario()}
        {step === 5 && renderStep5Hands()}
        {step === 6 && renderStep6Style()}
        {step === 7 && renderStep7Duration()}
        {step === 8 && renderStep8Audio()}
        {step === 9 && renderStep9Voice()}
        {step === 10 && renderStep10Music()}
        {step === 11 && renderStep11Placeholder()}
      </div>

      <div className="actions-row">
        <button
          className="secondary-btn"
          onClick={handleBack}
          disabled={step === 1}
          style={{ opacity: step === 1 ? 0.4 : 1 }}
        >
          ← Voltar
        </button>
        <button
          className="main-btn"
          onClick={handleAdvance}
          disabled={!canAdvance()}
        >
          {step === 10 ? '🎬 Gerar POV' : (step === TOTAL_STEPS ? '🎬 Gerar POV' : 'Avançar →')}
        </button>
      </div>

      {!canAdvance() && IMPLEMENTED_STEPS.includes(step) && (
        <p className="hint" style={{ textAlign: 'center', marginTop: 12, fontSize: 12 }}>
          Preencha os campos obrigatórios pra avançar.
        </p>
      )}
      {step === 10 && canAdvance() && (
        <p className="hint" style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--gr)' }}>
          ✓ Tudo pronto! Custo estimado: ~${getEstimatedCost(durationId, audioMode)}.
        </p>
      )}
      {step === 11 && (
        <p className="hint" style={{ textAlign: 'center', marginTop: 12, fontSize: 12 }}>
          Esta etapa não deveria ser visível. Se viu, é fallback porque onComplete não foi fornecido.
        </p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Helper de custo estimado (pra mostrar no Step 10 antes de gerar)
// ════════════════════════════════════════════════════════════════════════

function getEstimatedCost(durationId, audioMode) {
  const dur = POV_DURATIONS.find((d) => d.id === durationId);
  if (!dur) return '?';
  const cost = audioMode === 'voiced' ? dur.estimatedCostVoiced : dur.estimatedCostSilent;
  return cost?.toFixed(2) || '?';
}

// ════════════════════════════════════════════════════════════════════════
// Componentes auxiliares
// ════════════════════════════════════════════════════════════════════════

function Stepper({ currentStep, totalSteps, titles }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        height: 4,
        background: 'var(--bd)',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 8,
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, var(--g), #c08f5c)',
          width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
          transition: 'width 0.3s',
        }} />
      </div>
      <div style={{
        textAlign: 'center',
        color: 'var(--t2)',
        fontSize: 12,
      }}>
        Etapa <strong style={{ color: 'var(--g)' }}>{currentStep}</strong> de {totalSteps}
        {' · '}
        {titles[currentStep - 1]}
      </div>
    </div>
  );
}

// Grid agrupado reutilizável
function GroupedGrid({ groupLabel, items, selectedId, onSelect }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {groupLabel && (
        <div style={{
          fontSize: 11,
          color: 'var(--t2)',
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontWeight: 700,
          marginBottom: 8,
        }}>
          {groupLabel}
        </div>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 8,
      }}>
        {items.map((item) => {
          const isSelected = item.id === selectedId;
          return (
            <div
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{
                background: isSelected ? 'rgba(212,165,116,0.1)' : 'var(--cd)',
                border: isSelected ? '2px solid var(--g)' : '2px solid var(--bd)',
                borderRadius: 'var(--rs)',
                padding: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>{item.emoji}</div>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: isSelected ? 'var(--g)' : 'var(--t)',
                marginBottom: 4,
              }}>
                {isSelected && '✓ '}{item.name}
              </div>
              <div style={{
                fontSize: 10,
                color: 'var(--t3)',
                lineHeight: 1.3,
              }}>
                {item.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Box de info reutilizável (mostrado depois de seleção)
function InfoBox({ label, text }) {
  if (!text) return null;
  return (
    <div style={{
      background: 'var(--blb)',
      border: '1px solid rgba(139,184,232,0.2)',
      borderRadius: 'var(--rs)',
      padding: 12,
      marginTop: 8,
    }}>
      <div style={{ fontSize: 11, color: 'var(--bl)', fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--t)', lineHeight: 1.5 }}>
        {text}
      </div>
    </div>
  );
}

// 🆕 v2.0 — Grid agrupado COM filtragem visual 3 níveis (Plano v4)
//   🎯 claudeRecommendedId → border dourada + glow + badge "🎯 Claude"
//   ✨ idealIds (Set ou Array) → border colorida + badge "✨ Ideal"
//   Resto → opacity 0.5 (clicável, fica visível mas suave)
//
// Se claudeRecommendedId e idealIds são null/empty, comporta-se igual ao
// GroupedGrid normal (todos cards normais). Não-quebra retrocompat.
function FilteredGroupedGrid({
  groupLabel,
  items,
  selectedId,
  onSelect,
  claudeRecommendedId = null,
  idealIds = null,
}) {
  // Normaliza idealIds pra Set pra lookup O(1)
  const idealSet = useMemo(() => {
    if (!idealIds) return null;
    return new Set(Array.isArray(idealIds) ? idealIds : []);
  }, [idealIds]);

  const hasFiltering = !!claudeRecommendedId || (idealSet && idealSet.size > 0);

  return (
    <div style={{ marginBottom: 18 }}>
      {groupLabel && (
        <div style={{
          fontSize: 11,
          color: 'var(--t2)',
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontWeight: 700,
          marginBottom: 8,
        }}>
          {groupLabel}
        </div>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 8,
      }}>
        {items.map((item) => {
          const isSelected = item.id === selectedId;
          const isClaude = claudeRecommendedId && item.id === claudeRecommendedId;
          const isIdeal = idealSet && idealSet.has(item.id);
          const isDimmed = hasFiltering && !isClaude && !isIdeal && !isSelected;

          // Cores e estilos por nível
          let border, background, glow;
          if (isSelected) {
            border = '2px solid var(--g)';
            background = 'rgba(212,165,116,0.1)';
            glow = isClaude ? '0 0 16px rgba(212,165,116,0.4)' : 'none';
          } else if (isClaude) {
            border = '2px solid var(--g)';
            background = 'rgba(212,165,116,0.06)';
            glow = '0 0 12px rgba(212,165,116,0.3)';
          } else if (isIdeal) {
            border = '2px solid rgba(107,189,138,0.5)';
            background = 'rgba(107,189,138,0.04)';
            glow = 'none';
          } else {
            border = '2px solid var(--bd)';
            background = 'var(--cd)';
            glow = 'none';
          }

          return (
            <div
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{
                background,
                border,
                boxShadow: glow,
                borderRadius: 'var(--rs)',
                padding: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center',
                opacity: isDimmed ? 0.5 : 1,
                position: 'relative',
              }}
            >
              {/* Badge superior — Claude rec ou Ideal */}
              {(isClaude || isIdeal) && !isSelected && (
                <div style={{
                  position: 'absolute',
                  top: -8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 8,
                  background: isClaude ? 'var(--g)' : 'rgba(107,189,138,0.85)',
                  color: '#0a0a0a',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}>
                  {isClaude ? '🎯 Claude' : '✨ Ideal'}
                </div>
              )}
              <div style={{ fontSize: 28, marginBottom: 6 }}>{item.emoji}</div>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: isSelected ? 'var(--g)' : (isClaude ? 'var(--g)' : 'var(--t)'),
                marginBottom: 4,
              }}>
                {isSelected && '✓ '}{item.name}
              </div>
              <div style={{
                fontSize: 10,
                color: 'var(--t3)',
                lineHeight: 1.3,
              }}>
                {item.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper de renderização das categorias agrupadas (Step 2)
function renderCategoryOptions() {
  const groups = {
    beauty: 'Beleza & Cuidados',
    fashion: 'Moda Feminina',
    home: 'Casa & Decoração',
    electronics: 'Eletrônicos & Tech',
    health: 'Saúde & Bem-estar',
    other: 'Outros',
  };

  return Object.entries(groups).map(([groupId, groupName]) => {
    const categories = UGC_CATEGORIES.filter((c) => c.group === groupId);
    if (categories.length === 0) return null;
    return (
      <optgroup key={groupId} label={groupName}>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.emoji} {c.name}
          </option>
        ))}
      </optgroup>
    );
  });
}
