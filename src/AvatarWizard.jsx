// src/AvatarWizard.jsx (v1.0 — Avatar IA Sessão 3 — Wizard de 7 etapas)
//
// O componente mais complexo do projeto até hoje. Implementa o wizard inteiro
// de criação de Avatar IA: 7 etapas + tela de resultado + cache de previews.
//
// REFERÊNCIAS arquiteturais:
//   - Decisão #2: usa generateAvatarPrompt (Claude Sonnet 4 → JSON MIRR0R)
//   - Decisão #3: usa generateAvatar (Nano Banana Pro 2 variações)
//   - Decisão #5 revisada + #10: previews lazy + cache localStorage + 3 ações por card
//   - Decisão #6: 2 variações simultâneas na tela final
//   - Decisão #7: 7 etapas (6 do Trendly + Etapa 7 Personalidade & Nicho)
//   - Decisão #8: salva no mesmo localStorage 'marcos-studio-vton-profiles' com type:'avatar'
//   - Decisão #9: realismo ULTRA via system prompt (já no avatar-prompt.js)
//
// ⚠️ ATENÇÃO IMPORTANTE — IMPORTS DOS DATA FILES:
// Esses imports assumem nomes-padrão dos exports do Lote A (Sessão 1).
// Se algum nome não bater EXATAMENTE com o que tá no `src/data/avatar-*.js`,
// o Vite build vai falhar. Antes de commitar, abra cada data file e confirme:
//   - avatar-ethnicities.js   exporta `ETHNICITIES` + `getEthnicityLabel`
//   - avatar-skin-tones.js    exporta `SKIN_TONES`
//   - avatar-body-types.js    exporta `BODY_TYPES`
//   - avatar-eye-colors.js    exporta `EYE_COLORS`
//   - avatar-lips.js          exporta `LIPS`
//   - avatar-hair-styles.js   exporta `getHairStylesForGender`
//   - avatar-hair-colors.js   exporta `HAIR_COLORS`
//   - avatar-beard-styles.js  exporta `BEARD_STYLES`
//   - avatar-accessories.js   exporta `GLASSES_OPTIONS`, `PIERCINGS`, `describePiercings`
// Se algum estiver com nome diferente, ajuste o import correspondente abaixo.

import { useState, useEffect, useMemo } from 'react';
import {
  generateAvatarPrompt,
  generateAvatar,
  generateCardPreview,
  saveVtonProfile,
} from './api';

// ── Data files do Lote A ──────────────────────────────────────────────
import { ETHNICITIES, getEthnicityLabel } from './data/avatar-ethnicities';
import { SKIN_TONES } from './data/avatar-skin-tones';
import { BODY_TYPES } from './data/avatar-body-types';
import { EYE_COLORS } from './data/avatar-eye-colors';
import { LIPS } from './data/avatar-lips';
import { getHairStylesForGender } from './data/avatar-hair-styles';
import { HAIR_COLORS } from './data/avatar-hair-colors';
import { BEARD_STYLES } from './data/avatar-beard-styles';
import { GLASSES_OPTIONS, PIERCINGS, describePiercings } from './data/avatar-accessories';

// ── Nicho TikTok Shop (reusa data file existente) ─────────────────────
import { UGC_CATEGORIES } from './data/ugc-categories';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════

const TOTAL_STEPS = 7;
const PREVIEW_CACHE_KEY = 'marcos-studio-avatar-preview-cache';
const PREVIEW_ASPECT_RATIO = '1:1'; // Decisão padrão (cards quadrados)

const STEP_TITLES = [
  'Identidade Natural',     // 1
  'Origem Genética',        // 2
  'Corpo e Proporções',     // 3
  'Rosto e Expressão',      // 4
  'Estilo Capilar',         // 5
  'Detalhes Finais',        // 6
  'Personalidade & Nicho',  // 7
];

// ═══════════════════════════════════════════════════════════════════════
// CACHE DE PREVIEWS — localStorage
// ═══════════════════════════════════════════════════════════════════════

function loadPreviewCache() {
  try {
    const raw = localStorage.getItem(PREVIEW_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePreviewCache(cache) {
  try {
    localStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[AvatarWizard] preview cache save failed:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

export default function AvatarWizard({ onCancel, onSaved }) {
  // ── Estado principal ────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // Etapa 1
  const [name, setName] = useState('');
  const [gender, setGender] = useState('female');
  const [age, setAge] = useState(28);

  // Etapa 2
  const [ethnicityIds, setEthnicityIds] = useState([]); // até 2
  const [skinToneId, setSkinToneId] = useState(null);

  // Etapa 3
  const [bodyTypeId, setBodyTypeId] = useState(null);

  // Etapa 4
  const [eyeColorId, setEyeColorId] = useState(null);
  const [lipsId, setLipsId] = useState(null);

  // Etapa 5
  const [hairStyleId, setHairStyleId] = useState(null);
  const [hairColorId, setHairColorId] = useState(null);
  const [beardStyleId, setBeardStyleId] = useState(null);

  // Etapa 6
  const [glassesId, setGlassesId] = useState(null);
  const [piercingIds, setPiercingIds] = useState([]);

  // Etapa 7
  const [editorialLine, setEditorialLine] = useState('');
  const [signature, setSignature] = useState('');
  const [niche, setNiche] = useState('');

  // Geração final
  const [generating, setGenerating] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState('');
  const [generationError, setGenerationError] = useState(null);
  const [result, setResult] = useState(null); // { images, personaPrompt, englishPrompt, validationWarnings }

  // Cache de previews dos cards (lazy load)
  const [previewCache, setPreviewCache] = useState(() => loadPreviewCache());

  // Cards em geração (key → bool) pra mostrar spinner por card
  const [cardLoading, setCardLoading] = useState({});

  // Modal de "ver prompt" (transparência da Decisão #10)
  const [showPromptModal, setShowPromptModal] = useState(null); // { title, prompt }

  // ── Aviso ao fechar com progresso ───────────────────────────────────
  useEffect(() => {
    function beforeUnload(e) {
      if (step > 1 && !result) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [step, result]);

  // ── Filtros derivados ───────────────────────────────────────────────
  const hairStyles = useMemo(() => {
    try {
      return getHairStylesForGender(gender);
    } catch {
      return [];
    }
  }, [gender]);

  // ═══════════════════════════════════════════════════════════════════
  // VALIDAÇÃO POR ETAPA
  // ═══════════════════════════════════════════════════════════════════

  function isStepValid(s) {
    switch (s) {
      case 1: return name.trim().length >= 2 && (gender === 'male' || gender === 'female') && age >= 18 && age <= 70;
      case 2: return ethnicityIds.length >= 1 && ethnicityIds.length <= 2 && skinToneId;
      case 3: return !!bodyTypeId;
      case 4: return !!eyeColorId && !!lipsId;
      case 5: return !!hairStyleId && !!hairColorId; // barba é opcional
      case 6: return !!glassesId; // piercings opcionais
      case 7: return true; // tudo opcional
      default: return false;
    }
  }

  function canAdvance() {
    return isStepValid(step);
  }

  // ═══════════════════════════════════════════════════════════════════
  // NAVEGAÇÃO
  // ═══════════════════════════════════════════════════════════════════

  function handleBack() {
    if (step === 1) {
      const ok = window.confirm('Sair do wizard? Os dados preenchidos serão perdidos.');
      if (ok) onCancel?.();
      return;
    }
    setStep((s) => s - 1);
  }

  function handleAdvance() {
    if (!canAdvance()) return;
    if (step === TOTAL_STEPS) {
      handleGenerate();
      return;
    }
    setStep((s) => s + 1);
  }

  // ═══════════════════════════════════════════════════════════════════
  // GERAÇÃO FINAL
  // ═══════════════════════════════════════════════════════════════════

  async function handleGenerate() {
    setGenerating(true);
    setGenerationError(null);

    try {
      // 1. Resolve dados do wizard pra strings em inglês (descrição dos data files)
      setGeneratingMessage('Montando o prompt...');
      const promptPayload = buildPromptPayload();

      // 2. Chama Claude Sonnet 4 pra gerar JSON MIRR0R
      const promptResult = await generateAvatarPrompt(promptPayload);

      // 3. Chama Nano Banana Pro pra gerar 2 variações
      setGeneratingMessage('Gerando 2 variações... pode levar até 60 segundos.');
      const genResult = await generateAvatar(promptResult.englishPrompt, name);

      setResult({
        images: genResult.images,
        personaPrompt: promptResult.personaPrompt,
        englishPrompt: promptResult.englishPrompt,
        validationWarnings: promptResult.validationWarnings,
        wizardData: collectWizardData(),
      });
    } catch (err) {
      console.error('[AvatarWizard] generation error:', err);
      setGenerationError(err.message || 'Erro inesperado ao gerar avatar');
    } finally {
      setGenerating(false);
      setGeneratingMessage('');
    }
  }

  function buildPromptPayload() {
    const ethnicities = ethnicityIds
      .map((id) => ETHNICITIES.find((e) => e.id === id))
      .filter(Boolean);
    const skinTone = SKIN_TONES.find((s) => s.id === skinToneId);
    const bodyType = BODY_TYPES.find((b) => b.id === bodyTypeId);
    const eyeColor = EYE_COLORS.find((e) => e.id === eyeColorId);
    const lips = LIPS.find((l) => l.id === lipsId);
    const hairStyle = hairStyles.find((h) => h.id === hairStyleId);
    const hairColor = HAIR_COLORS.find((c) => c.id === hairColorId);
    const beardStyle = gender === 'male' && beardStyleId
      ? BEARD_STYLES.find((b) => b.id === beardStyleId)
      : null;
    const glasses = GLASSES_OPTIONS.find((g) => g.id === glassesId);

    return {
      name: name.trim(),
      gender,
      age,
      ethnicityDescriptions: ethnicities.map(
        (e) => e.description || e.traits || getEthnicityLabel(e, gender) || e.id
      ),
      skinToneDescription: skinTone?.description || skinTone?.label || '',
      bodyTypeDescription: bodyType?.description || bodyType?.traits || '',
      eyeColorDescription: eyeColor?.description || eyeColor?.label || '',
      lipsDescription: lips?.description || lips?.label || '',
      hairStyleDescription: hairStyle?.description || hairStyle?.label || '',
      hairColorDescription: hairColor?.description || hairColor?.label || '',
      beardStyleDescription: beardStyle ? (beardStyle.description || beardStyle.label) : null,
      glassesDescription: glasses?.description || glasses?.label || 'no glasses',
      piercingsDescriptions: piercingIds.length > 0 ? [describePiercings(piercingIds)] : [],
      editorialLine: editorialLine.trim() || undefined,
      signature: signature.trim() || undefined,
      niche: niche || undefined,
    };
  }

  function collectWizardData() {
    return {
      name, gender, age,
      ethnicityIds, skinToneId, bodyTypeId, eyeColorId, lipsId,
      hairStyleId, hairColorId, beardStyleId,
      glassesId, piercingIds,
      editorialLine, signature, niche,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // SALVAR (após escolher uma das 2 variações)
  // ═══════════════════════════════════════════════════════════════════

  function handleChooseImage(image) {
    if (!result) return;
    const profile = {
      id: `avatar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      gender,
      type: 'avatar', // Decisão #1
      age,
      facePhoto: {
        url: image.url,
        preview: image.url, // referencia o url do fal.ai (sem base64 local)
        seed: image.seed,
      },
      wizardData: result.wizardData,
      personaPrompt: result.personaPrompt,
      // Campos pra retrocompat com sistema atual (que usa hair/vibe/signature):
      hair: { color: HAIR_COLORS.find((c) => c.id === hairColorId)?.label || 'unknown' },
      vibe: editorialLine.trim() || 'Avatar IA',
      signature: signature.trim() || '',
      ageHint: age,
      createdAt: new Date().toISOString(),
    };
    saveVtonProfile(profile);
    onSaved?.(profile);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PREVIEW DE CARD (Decisão #10 — 3 ações)
  // ═══════════════════════════════════════════════════════════════════

  // Monta um prompt inglês simples pra um card (preview only).
  function buildCardPreviewPrompt(category, item) {
    const base = 'candid documentary-style photo of a real person, natural skin texture, 50mm prime lens, available daylight, real human asymmetry,';
    const desc = item.description || item.traits || item.label || item.id;
    if (category === 'ethnicity') {
      const subj = gender === 'male' ? 'man' : 'woman';
      return `${base} ${subj} of ${desc} heritage, neutral background, natural expression. Headshot.`;
    }
    if (category === 'skinTone') {
      const subj = gender === 'male' ? 'man' : 'woman';
      return `${base} ${subj} with ${desc}, neutral background, headshot.`;
    }
    if (category === 'bodyType') {
      const subj = gender === 'male' ? 'man' : 'woman';
      return `${base} full-body candid photo of a ${subj} with ${desc}, neutral background.`;
    }
    if (category === 'eyeColor' || category === 'lips' || category === 'hairStyle' || category === 'hairColor' || category === 'beardStyle' || category === 'glasses') {
      const subj = gender === 'male' ? 'man' : 'woman';
      return `${base} close-up portrait of a ${subj}, ${desc}, neutral background.`;
    }
    return `${base} ${desc}.`;
  }

  async function handleGenerateCardPreview(category, item) {
    const cacheKey = `${category}/${item.id}-${gender[0]}`;
    setCardLoading((s) => ({ ...s, [cacheKey]: true }));
    try {
      const prompt = buildCardPreviewPrompt(category, item);
      const result = await generateCardPreview(prompt, PREVIEW_ASPECT_RATIO, cacheKey);
      const newCache = { ...previewCache, [cacheKey]: result.url };
      setPreviewCache(newCache);
      savePreviewCache(newCache);
    } catch (err) {
      console.error(`[AvatarWizard] card preview failed for ${cacheKey}:`, err);
      window.alert(`Erro ao gerar preview: ${err.message}`);
    } finally {
      setCardLoading((s) => ({ ...s, [cacheKey]: false }));
    }
  }

  function handleUploadCardPreview(category, item, file) {
    if (!file) return;
    const cacheKey = `${category}/${item.id}-${gender[0]}`;
    const reader = new FileReader();
    reader.onload = () => {
      const newCache = { ...previewCache, [cacheKey]: reader.result };
      setPreviewCache(newCache);
      savePreviewCache(newCache);
    };
    reader.readAsDataURL(file);
  }

  function handleShowPrompt(category, item) {
    const prompt = buildCardPreviewPrompt(category, item);
    setShowPromptModal({
      title: `${item.label || item.labelMale || item.labelFemale || item.id}`,
      prompt,
    });
  }

  function getCachedPreview(category, item) {
    const cacheKey = `${category}/${item.id}-${gender[0]}`;
    return { url: previewCache[cacheKey], loading: cardLoading[cacheKey] };
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  if (result) return renderResult();
  if (generating) return renderGenerating();

  return (
    <div style={S.container}>
      <Stepper currentStep={step} totalSteps={TOTAL_STEPS} titles={STEP_TITLES} />

      <div style={S.stepContent}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
        {step === 6 && renderStep6()}
        {step === 7 && renderStep7()}
      </div>

      <div style={S.navRow}>
        <button style={S.navBtnSecondary} onClick={handleBack}>
          {step === 1 ? '✕ Cancelar' : '← Voltar'}
        </button>
        <button
          style={{
            ...S.navBtnPrimary,
            opacity: canAdvance() ? 1 : 0.4,
            cursor: canAdvance() ? 'pointer' : 'not-allowed',
          }}
          onClick={handleAdvance}
          disabled={!canAdvance()}
        >
          {step === TOTAL_STEPS ? '🎨 Gerar Avatar' : 'Avançar →'}
        </button>
      </div>

      {showPromptModal && (
        <PromptModal
          title={showPromptModal.title}
          prompt={showPromptModal.prompt}
          onClose={() => setShowPromptModal(null)}
        />
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // ETAPAS
  // ═══════════════════════════════════════════════════════════════════

  function renderStep1() {
    return (
      <div style={S.stepBlock}>
        <h2 style={S.stepTitle}>1. Identidade Natural</h2>
        <p style={S.stepHint}>Defina nome, gênero e idade da sua influencer.</p>

        <label style={S.label}>Nome</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Carla, Rafael, ..."
          style={S.input}
          maxLength={40}
        />

        <label style={S.label}>Gênero</label>
        <div style={S.genderRow}>
          <button
            type="button"
            style={{ ...S.genderBtn, ...(gender === 'female' ? S.genderBtnActive : {}) }}
            onClick={() => setGender('female')}
          >
            👩 Feminino
          </button>
          <button
            type="button"
            style={{ ...S.genderBtn, ...(gender === 'male' ? S.genderBtnActive : {}) }}
            onClick={() => setGender('male')}
          >
            👨 Masculino
          </button>
        </div>

        <label style={S.label}>Idade: <strong>{age} anos</strong></label>
        <input
          type="range"
          min={18}
          max={70}
          value={age}
          onChange={(e) => setAge(parseInt(e.target.value, 10))}
          style={S.slider}
        />
        <div style={S.sliderRange}>
          <span>18</span><span>44</span><span>70</span>
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div style={S.stepBlock}>
        <h2 style={S.stepTitle}>2. Origem Genética</h2>
        <p style={S.stepHint}>
          Selecione até 2 etnias e 1 tom de pele. Os 2 podem ser combinados (ex: Latino + Mediterrâneo).
        </p>

        <div style={S.subTitle}>Etnia ({ethnicityIds.length}/2 selecionadas)</div>
        <div style={S.cardsGrid}>
          {ETHNICITIES.map((eth) => (
            <SelectableCard
              key={eth.id}
              item={eth}
              category="ethnicity"
              gender={gender}
              selected={ethnicityIds.includes(eth.id)}
              onToggle={() => {
                if (ethnicityIds.includes(eth.id)) {
                  setEthnicityIds(ethnicityIds.filter((id) => id !== eth.id));
                } else if (ethnicityIds.length < 2) {
                  setEthnicityIds([...ethnicityIds, eth.id]);
                }
              }}
              preview={getCachedPreview('ethnicity', eth)}
              onGenerate={() => handleGenerateCardPreview('ethnicity', eth)}
              onUpload={(file) => handleUploadCardPreview('ethnicity', eth, file)}
              onShowPrompt={() => handleShowPrompt('ethnicity', eth)}
              labelOverride={getEthnicityLabel?.(eth, gender) || eth.label || eth.id}
            />
          ))}
        </div>

        <div style={{ ...S.subTitle, marginTop: 24 }}>Tom de Pele</div>
        <div style={S.cardsGridSmall}>
          {SKIN_TONES.map((tone) => (
            <button
              key={tone.id}
              type="button"
              onClick={() => setSkinToneId(tone.id)}
              style={{
                ...S.swatchCard,
                background: tone.hex || '#ccc',
                outline: skinToneId === tone.id ? '3px solid var(--gb)' : '2px solid var(--bd)',
              }}
              title={tone.label || tone.description}
            >
              <span style={S.swatchLabel}>{tone.label || tone.id}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div style={S.stepBlock}>
        <h2 style={S.stepTitle}>3. Corpo e Proporções</h2>
        <p style={S.stepHint}>Escolha 1 dos 6 tipos corporais.</p>

        <div style={S.cardsGrid}>
          {BODY_TYPES.map((bt) => (
            <SelectableCard
              key={bt.id}
              item={bt}
              category="bodyType"
              gender={gender}
              selected={bodyTypeId === bt.id}
              onToggle={() => setBodyTypeId(bt.id)}
              preview={getCachedPreview('bodyType', bt)}
              onGenerate={() => handleGenerateCardPreview('bodyType', bt)}
              onUpload={(file) => handleUploadCardPreview('bodyType', bt, file)}
              onShowPrompt={() => handleShowPrompt('bodyType', bt)}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderStep4() {
    return (
      <div style={S.stepBlock}>
        <h2 style={S.stepTitle}>4. Rosto e Expressão</h2>

        <div style={S.subTitle}>Cor dos Olhos</div>
        <div style={S.cardsGridSmall}>
          {EYE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setEyeColorId(c.id)}
              style={{
                ...S.swatchCard,
                background: c.hex || '#888',
                outline: eyeColorId === c.id ? '3px solid var(--gb)' : '2px solid var(--bd)',
              }}
              title={c.label || c.description}
            >
              <span style={S.swatchLabel}>{c.label || c.id}</span>
            </button>
          ))}
        </div>

        <div style={{ ...S.subTitle, marginTop: 24 }}>Lábios</div>
        <div style={S.cardsGrid}>
          {LIPS.map((l) => (
            <SelectableCard
              key={l.id}
              item={l}
              category="lips"
              gender={gender}
              selected={lipsId === l.id}
              onToggle={() => setLipsId(l.id)}
              preview={getCachedPreview('lips', l)}
              onGenerate={() => handleGenerateCardPreview('lips', l)}
              onUpload={(file) => handleUploadCardPreview('lips', l, file)}
              onShowPrompt={() => handleShowPrompt('lips', l)}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderStep5() {
    return (
      <div style={S.stepBlock}>
        <h2 style={S.stepTitle}>5. Estilo Capilar</h2>

        <div style={S.subTitle}>Corte de Cabelo</div>
        <div style={S.cardsGrid}>
          {hairStyles.map((h) => (
            <SelectableCard
              key={h.id}
              item={h}
              category="hairStyle"
              gender={gender}
              selected={hairStyleId === h.id}
              onToggle={() => setHairStyleId(h.id)}
              preview={getCachedPreview('hairStyle', h)}
              onGenerate={() => handleGenerateCardPreview('hairStyle', h)}
              onUpload={(file) => handleUploadCardPreview('hairStyle', h, file)}
              onShowPrompt={() => handleShowPrompt('hairStyle', h)}
            />
          ))}
        </div>

        <div style={{ ...S.subTitle, marginTop: 24 }}>Cor do Cabelo</div>
        <div style={S.cardsGridSmall}>
          {HAIR_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setHairColorId(c.id)}
              style={{
                ...S.swatchCard,
                background: c.hex || '#444',
                outline: hairColorId === c.id ? '3px solid var(--gb)' : '2px solid var(--bd)',
              }}
              title={c.label || c.description}
            >
              <span style={S.swatchLabel}>{c.label || c.id}</span>
            </button>
          ))}
        </div>

        {gender === 'male' && (
          <>
            <div style={{ ...S.subTitle, marginTop: 24 }}>Barba (opcional)</div>
            <div style={S.cardsGrid}>
              {BEARD_STYLES.map((b) => (
                <SelectableCard
                  key={b.id}
                  item={b}
                  category="beardStyle"
                  gender={gender}
                  selected={beardStyleId === b.id}
                  onToggle={() => setBeardStyleId(b.id)}
                  preview={getCachedPreview('beardStyle', b)}
                  onGenerate={() => handleGenerateCardPreview('beardStyle', b)}
                  onUpload={(file) => handleUploadCardPreview('beardStyle', b, file)}
                  onShowPrompt={() => handleShowPrompt('beardStyle', b)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderStep6() {
    return (
      <div style={S.stepBlock}>
        <h2 style={S.stepTitle}>6. Detalhes Finais</h2>

        <div style={S.subTitle}>Óculos</div>
        <div style={S.cardsGrid}>
          {GLASSES_OPTIONS.map((g) => (
            <SelectableCard
              key={g.id}
              item={g}
              category="glasses"
              gender={gender}
              selected={glassesId === g.id}
              onToggle={() => setGlassesId(g.id)}
              preview={getCachedPreview('glasses', g)}
              onGenerate={() => handleGenerateCardPreview('glasses', g)}
              onUpload={(file) => handleUploadCardPreview('glasses', g, file)}
              onShowPrompt={() => handleShowPrompt('glasses', g)}
            />
          ))}
        </div>

        <div style={{ ...S.subTitle, marginTop: 24 }}>
          Piercings (opcional, multi-seleção)
        </div>
        <div style={S.cardsGrid}>
          {PIERCINGS.map((p) => (
            <SelectableCard
              key={p.id}
              item={p}
              category="piercing"
              gender={gender}
              selected={piercingIds.includes(p.id)}
              onToggle={() => {
                if (piercingIds.includes(p.id)) {
                  setPiercingIds(piercingIds.filter((id) => id !== p.id));
                } else {
                  setPiercingIds([...piercingIds, p.id]);
                }
              }}
              preview={{ url: null, loading: false }}
              onGenerate={() => {}}
              onUpload={() => {}}
              onShowPrompt={() => {}}
              hideActions
            />
          ))}
        </div>
      </div>
    );
  }

  function renderStep7() {
    return (
      <div style={S.stepBlock}>
        <h2 style={S.stepTitle}>7. Personalidade & Nicho</h2>
        <p style={S.stepHint}>Tudo opcional. Vai sutilmente influenciar a expressão e o mood do avatar gerado.</p>

        <label style={S.label}>📝 Linha Editorial</label>
        <textarea
          value={editorialLine}
          onChange={(e) => setEditorialLine(e.target.value.substring(0, 200))}
          placeholder="Ex: focada em moda casual, atitude descontraída, transmite confiança natural..."
          style={S.textarea}
          rows={3}
          maxLength={200}
        />
        <div style={S.charCount}>{editorialLine.length}/200</div>

        <label style={S.label}>💎 Característica signature (opcional)</label>
        <input
          type="text"
          value={signature}
          onChange={(e) => setSignature(e.target.value.substring(0, 80))}
          placeholder="Ex: covinhas, marca na bochecha esquerda, ..."
          style={S.input}
          maxLength={80}
        />

        <label style={S.label}>🎯 Nicho TikTok Shop (opcional)</label>
        <select
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          style={S.select}
        >
          <option value="">— Sem nicho específico —</option>
          {UGC_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label || c.name || c.id}
            </option>
          ))}
        </select>

        <div style={S.summary}>
          <strong>📋 Resumo do avatar:</strong>
          <div>• {name || '?'} · {gender === 'male' ? 'masculino' : 'feminino'} · {age} anos</div>
          <div>• {ethnicityIds.length} etnia(s) · pele {SKIN_TONES.find((s) => s.id === skinToneId)?.label || '?'}</div>
          <div>• Corpo: {BODY_TYPES.find((b) => b.id === bodyTypeId)?.label || '?'}</div>
          <div>• Olhos: {EYE_COLORS.find((e) => e.id === eyeColorId)?.label || '?'} · Lábios: {LIPS.find((l) => l.id === lipsId)?.label || '?'}</div>
          <div>• Cabelo: {hairStyles.find((h) => h.id === hairStyleId)?.label || '?'} · {HAIR_COLORS.find((c) => c.id === hairColorId)?.label || '?'}</div>
          {gender === 'male' && (
            <div>• Barba: {beardStyleId ? BEARD_STYLES.find((b) => b.id === beardStyleId)?.label : 'sem barba'}</div>
          )}
          <div>• Óculos: {GLASSES_OPTIONS.find((g) => g.id === glassesId)?.label || '?'} · {piercingIds.length} piercing(s)</div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // TELA DE GERAÇÃO + RESULTADO
  // ═══════════════════════════════════════════════════════════════════

  function renderGenerating() {
    return (
      <div style={S.container}>
        <div style={S.generatingBox}>
          <div style={S.spinner}>✨</div>
          <h2 style={S.generatingTitle}>Gerando seu avatar...</h2>
          <p style={S.generatingMsg}>{generatingMessage || 'Aguarde...'}</p>
          <p style={S.generatingHint}>
            Custo dessa geração: ~$0.10 (2 variações).
          </p>
        </div>
      </div>
    );
  }

  function renderResult() {
    if (generationError) {
      return (
        <div style={S.container}>
          <div style={S.errorBox}>
            <h2>❌ Erro na geração</h2>
            <p>{generationError}</p>
            <button style={S.navBtnPrimary} onClick={() => { setGenerationError(null); handleGenerate(); }}>
              🔄 Tentar de novo
            </button>
            <button
              style={{ ...S.navBtnSecondary, marginLeft: 8 }}
              onClick={() => { setResult(null); setGenerationError(null); setStep(7); }}
            >
              ← Voltar pra Etapa 7
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={S.container}>
        <h2 style={S.stepTitle}>✨ Avatar gerado!</h2>
        <p style={S.stepHint}>
          Escolha uma das 2 variações. A escolhida será salva no seu portfólio como Avatar IA.
        </p>

        {result.validationWarnings?.length > 0 && (
          <div style={S.warningBox}>
            <strong>⚠️ Avisos do gerador:</strong>
            <ul style={{ margin: '4px 0 0 16px' }}>
              {result.validationWarnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        <div style={S.resultGrid}>
          {result.images.map((img, i) => (
            <div key={i} style={S.resultCard}>
              <img src={img.url} alt={`Variação ${i + 1}`} style={S.resultImage} />
              <div style={S.resultMeta}>
                <span>Variação {i + 1}</span>
                {img.seed && <span style={{ opacity: 0.6 }}>seed {img.seed}</span>}
              </div>
              <button
                style={S.chooseBtn}
                onClick={() => handleChooseImage(img)}
              >
                ✓ Escolher esta
              </button>
            </div>
          ))}
        </div>

        <div style={S.resultActions}>
          <button style={S.navBtnSecondary} onClick={() => { setResult(null); setStep(7); }}>
            ← Voltar
          </button>
          <button style={S.navBtnSecondary} onClick={() => { setResult(null); handleGenerate(); }}>
            🔄 Gerar 2 novas
          </button>
        </div>
      </div>
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═══════════════════════════════════════════════════════════════════════

function Stepper({ currentStep, totalSteps, titles }) {
  return (
    <div style={S.stepperContainer}>
      <div style={S.stepperBar}>
        <div
          style={{
            ...S.stepperFill,
            width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
          }}
        />
      </div>
      <div style={S.stepperLabel}>
        Etapa <strong>{currentStep}</strong> de {totalSteps} · {titles[currentStep - 1]}
      </div>
    </div>
  );
}

function SelectableCard({
  item,
  category,
  gender,
  selected,
  onToggle,
  preview,
  onGenerate,
  onUpload,
  onShowPrompt,
  labelOverride,
  hideActions,
}) {
  const label = labelOverride || (gender === 'male' ? item.labelMale : item.labelFemale) || item.label || item.id;

  return (
    <div
      style={{
        ...S.selectableCard,
        ...(selected ? S.selectableCardSelected : {}),
      }}
    >
      <div style={S.selectableCardImage} onClick={onToggle}>
        {preview?.loading ? (
          <div style={S.selectableCardPlaceholder}>⏳</div>
        ) : preview?.url ? (
          <img src={preview.url} alt={label} style={S.selectableCardImg} />
        ) : (
          <div style={S.selectableCardPlaceholder}>🎨</div>
        )}
      </div>
      <div style={S.selectableCardLabel} onClick={onToggle}>
        {selected && <span style={{ color: 'var(--gb)' }}>✓ </span>}
        {label}
      </div>
      {!hideActions && (
        <div style={S.cardActions}>
          <button
            type="button"
            style={S.cardActionBtn}
            onClick={(e) => { e.stopPropagation(); onGenerate(); }}
            disabled={preview?.loading}
            title="Gerar preview com IA"
          >
            🎨
          </button>
          <label style={S.cardActionBtn} title="Subir foto">
            📤
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => onUpload(e.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            style={S.cardActionBtn}
            onClick={(e) => { e.stopPropagation(); onShowPrompt(); }}
            title="Ver prompt usado"
          >
            👁
          </button>
        </div>
      )}
    </div>
  );
}

function PromptModal({ title, prompt, onClose }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>👁 Prompt de "{title}"</h3>
        <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 8 }}>
          Use esse prompt em qualquer ferramenta externa (ChatGPT, Veo Studio Ultra, etc.)
        </p>
        <textarea
          value={prompt}
          readOnly
          style={{ ...S.textarea, minHeight: 120, fontFamily: 'monospace', fontSize: 12 }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            type="button"
            style={S.navBtnPrimary}
            onClick={() => { navigator.clipboard?.writeText(prompt); }}
          >
            📋 Copiar
          </button>
          <button type="button" style={S.navBtnSecondary} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════

const S = {
  container: {
    maxWidth: 900,
    margin: '0 auto',
    padding: 20,
    color: 'var(--t1)',
  },
  stepperContainer: { marginBottom: 24 },
  stepperBar: {
    height: 6,
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  stepperFill: {
    height: '100%',
    background: 'var(--gb)',
    transition: 'width 0.25s ease-out',
  },
  stepperLabel: { fontSize: 13, color: 'var(--t2)' },
  stepContent: {
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
  },
  stepBlock: {},
  stepTitle: { fontSize: 22, margin: '0 0 6px 0', color: 'var(--t1)' },
  stepHint: { color: 'var(--t2)', fontSize: 13, marginBottom: 20 },
  subTitle: { fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 12 },

  label: { display: 'block', fontSize: 13, color: 'var(--t2)', marginTop: 16, marginBottom: 6 },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 6,
    color: 'var(--t1)',
    fontSize: 14,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: 10,
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 6,
    color: 'var(--t1)',
    fontSize: 13,
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  charCount: { fontSize: 11, color: 'var(--t2)', textAlign: 'right', marginTop: 4 },
  select: {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 6,
    color: 'var(--t1)',
    fontSize: 14,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  slider: { width: '100%', marginTop: 4 },
  sliderRange: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t2)', marginTop: 2 },

  genderRow: { display: 'flex', gap: 10 },
  genderBtn: {
    flex: 1,
    padding: '12px 16px',
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 8,
    color: 'var(--t1)',
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  genderBtnActive: { background: 'var(--gd)', border: '1px solid var(--gb)' },

  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 10,
  },
  cardsGridSmall: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: 8,
  },
  selectableCard: {
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 10,
    padding: 8,
    transition: 'all 0.15s',
    display: 'flex',
    flexDirection: 'column',
  },
  selectableCardSelected: { border: '1px solid var(--gb)', background: 'var(--gd)' },
  selectableCardImage: {
    width: '100%',
    aspectRatio: '1 / 1',
    background: 'var(--bg2)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 6,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectableCardImg: { width: '100%', height: '100%', objectFit: 'cover' },
  selectableCardPlaceholder: { fontSize: 28, color: 'var(--t2)', opacity: 0.5 },
  selectableCardLabel: {
    fontSize: 12,
    color: 'var(--t1)',
    textAlign: 'center',
    cursor: 'pointer',
    padding: '4px 0',
    minHeight: 20,
  },
  cardActions: { display: 'flex', gap: 4, justifyContent: 'center', marginTop: 4 },
  cardActionBtn: {
    flex: 1,
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    borderRadius: 4,
    padding: '4px 6px',
    cursor: 'pointer',
    fontSize: 12,
    color: 'var(--t1)',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  swatchCard: {
    aspectRatio: '1 / 1',
    border: '2px solid var(--bd)',
    borderRadius: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: 4,
    fontFamily: 'inherit',
    transition: 'outline 0.15s',
  },
  swatchLabel: {
    fontSize: 10,
    color: '#fff',
    background: 'rgba(0,0,0,0.55)',
    padding: '2px 6px',
    borderRadius: 4,
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
  },

  navRow: { display: 'flex', gap: 12, justifyContent: 'space-between' },
  navBtnPrimary: {
    background: 'var(--gb)',
    border: 'none',
    borderRadius: 20,
    padding: '10px 24px',
    color: '#000',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
    fontSize: 14,
  },
  navBtnSecondary: {
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 20,
    padding: '10px 20px',
    color: 'var(--t1)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
  },

  summary: {
    marginTop: 24,
    padding: 12,
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.7,
    color: 'var(--t2)',
  },

  generatingBox: { textAlign: 'center', padding: 60 },
  spinner: { fontSize: 56, animation: 'pulse 1.2s ease-in-out infinite' },
  generatingTitle: { fontSize: 22, marginTop: 16 },
  generatingMsg: { color: 'var(--t2)', fontSize: 14, marginTop: 8 },
  generatingHint: { color: 'var(--t2)', fontSize: 12, opacity: 0.7, marginTop: 16 },

  errorBox: {
    background: 'rgba(255, 80, 80, 0.1)',
    border: '1px solid rgba(255, 80, 80, 0.4)',
    borderRadius: 12,
    padding: 24,
    textAlign: 'center',
  },
  warningBox: {
    background: 'rgba(255, 170, 60, 0.1)',
    border: '1px solid rgba(255, 170, 60, 0.4)',
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    marginBottom: 16,
  },

  resultGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 12 },
  resultCard: {
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  resultImage: { width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 6, background: 'var(--bg)' },
  resultMeta: { display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 12, color: 'var(--t2)' },
  chooseBtn: {
    width: '100%',
    background: 'var(--gb)',
    border: 'none',
    borderRadius: 20,
    padding: '10px 16px',
    color: '#000',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  resultActions: { display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 },

  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1100, padding: 20,
  },
  modal: {
    background: 'var(--bg2)', border: '1px solid var(--bd)',
    borderRadius: 12, padding: 20, width: '100%', maxWidth: 600,
    color: 'var(--t1)',
  },
};
