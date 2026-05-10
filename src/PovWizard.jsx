// src/PovWizard.jsx (v1.0 — Sub-lote 3a — wizard 11 steps, steps 1-3 implementados)
//
// Wizard principal da aba POV. Coleta todas as decisões do usuário pra gerar
// um vídeo POV (Point of View) pra TikTok Shop.
//
// SUB-LOTE 3a (atual):
//   ✅ Step 1: Influencer (seleção do perfil cadastrado)
//   ✅ Step 2: Produto (7 campos manuais)
//   ✅ Step 3: Tipo de POV (11 opções em 4 grupos) + ✨ Claude sugere
//   🚧 Steps 4-11: placeholder (vêm no Sub-lote 3b)
//
// SUB-LOTE 3b (próximo):
//   - Step 4: Cenário (15 opções)
//   - Step 5: Mãos (toggle Influencer ⟷ Anônima · 11 opções)
//   - Step 6: Estilo de câmera (8 opções)
//   - Step 7: Duração (20s/30s/40s/60s)
//   - Step 8: Áudio (Sem voz ⟷ Com voz)
//   - Step 9: Voz/Roteiro (só se Com voz)
//   - Step 10: Música (sugestão Comercial + Viral)
//   - Geração: dispara pipeline 7 helpers
//
// SUB-LOTE 3c (depois):
//   - Step 11: Resultado (vídeo + pacote postagem) — vai pra PovOutput
//
// PADRÕES REUTILIZADOS (espelhando AvatarWizard.jsx):
//   - step (number) state pra navegação
//   - Stepper visual no topo
//   - SelectableCard pra grids de opções (simplificado, sem preview lazy)
//   - isStepValid(s) por step
//   - Aviso ao fechar com progresso (beforeUnload)

import { useState, useEffect, useMemo } from 'react';
import { getRealInfluencers, recommendPovDefaults } from './api';
import { POV_TYPES, POV_TYPE_GROUPS } from './data/pov-types';
import { UGC_CATEGORIES } from './data/ugc-categories';

const TOTAL_STEPS = 11;

const STEP_TITLES = [
  'Influencer',          // 1
  'Produto',             // 2
  'Tipo de POV',         // 3
  'Cenário',             // 4
  'Mãos',                // 5
  'Estilo de câmera',    // 6
  'Duração',             // 7
  'Áudio',               // 8
  'Voz/Roteiro',         // 9
  'Música',              // 10
  'Resultado',           // 11
];

// Sub-lote 3a: só steps 1-3 estão implementados
const IMPLEMENTED_STEPS = [1, 2, 3];

export default function PovWizard({ onComplete, onSwitchTab }) {
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
  const [productPhoto, setProductPhoto] = useState(null); // { base64, mimeType, name, preview }
  const [productViralTranscript, setProductViralTranscript] = useState('');

  // ── Step 3: Tipo de POV ───────────────────────────────────────────────
  const [typeId, setTypeId] = useState(null);
  const [recommendingDefaults, setRecommendingDefaults] = useState(false);
  const [recommendError, setRecommendError] = useState(null);

  // ── Step 4-10: futuros (Sub-lote 3b) — só guarda placeholders ────────
  // Mantém os states aqui pra não quebrar quando 3b implementar
  const [scenarioId, setScenarioId] = useState(null);
  const [handsConfig, setHandsConfig] = useState({ mode: 'influencer' }); // mode: 'influencer' | 'anonymous'
  const [styleId, setStyleId] = useState(null);
  const [durationId, setDurationId] = useState(null);
  const [audioMode, setAudioMode] = useState('silent'); // 'silent' | 'voiced'
  const [voiceId, setVoiceId] = useState(null);

  // ── Carrega influencers do localStorage ───────────────────────────────
  useEffect(() => {
    setProfiles(getRealInfluencers());
  }, []);

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

  // ── Validação por step ────────────────────────────────────────────────
  function isStepValid(s) {
    switch (s) {
      case 1: return !!selectedProfileId;
      case 2: return productName.trim().length >= 2 && productCategoryId && !!productPhoto;
      case 3: return !!typeId;
      // Sub-lote 3b implementa 4-10
      default: return false;
    }
  }

  function canAdvance() {
    if (!IMPLEMENTED_STEPS.includes(step)) return false; // bloqueia em placeholders
    return isStepValid(step);
  }

  // ── Navegação ─────────────────────────────────────────────────────────
  function handleBack() {
    if (step === 1) return; // Sem cancelar — usuário troca de aba se quiser
    setStep((s) => s - 1);
  }

  function handleAdvance() {
    if (!canAdvance()) return;
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
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

  // ── Step 3: ✨ Claude sugere (chama recommendPovDefaults) ─────────────
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
        influencerGender: selectedProfile?.gender || 'female',
        handsMode: 'influencer', // default no 3a
      });

      // Aplica todas as sugestões nos states (frontend valida que ID é válido)
      const rec = result.recommendations;
      if (rec.typeId && POV_TYPES.find((t) => t.id === rec.typeId)) {
        setTypeId(rec.typeId);
      }
      // 3b vai aplicar scenarioId, styleId, handsId também
      if (rec.scenarioId) setScenarioId(rec.scenarioId);
      if (rec.styleId) setStyleId(rec.styleId);

      console.log('[PovWizard] Claude sugeriu:', rec, '· source:', result.source);
    } catch (err) {
      console.error('[PovWizard] recommendPovDefaults falhou:', err);
      setRecommendError(err.message || 'Erro ao chamar Claude');
    } finally {
      setRecommendingDefaults(false);
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

        {/* Linha 1: foto + nome */}
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

        {/* Descrição */}
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

        {/* Preço + preço original */}
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

        {/* Transcrição viral */}
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
    return (
      <div>
        <div className="card" style={{ marginBottom: 14 }}>
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
          </p>

          {/* Grupos */}
          {POV_TYPE_GROUPS.map((group) => {
            const typesOfGroup = POV_TYPES.filter((t) => t.group === group.id);
            return (
              <div key={group.id} style={{ marginBottom: 18 }}>
                <div style={{
                  fontSize: 11,
                  color: 'var(--t2)',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  fontWeight: 700,
                  marginBottom: 8,
                }}>
                  {group.emoji} {group.name}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: 8,
                }}>
                  {typesOfGroup.map((type) => {
                    const isSelected = type.id === typeId;
                    return (
                      <div
                        key={type.id}
                        onClick={() => setTypeId(type.id)}
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
                        <div style={{ fontSize: 28, marginBottom: 6 }}>{type.emoji}</div>
                        <div style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: isSelected ? 'var(--g)' : 'var(--t)',
                          marginBottom: 4,
                        }}>
                          {isSelected && '✓ '}{type.name}
                        </div>
                        <div style={{
                          fontSize: 10,
                          color: 'var(--t3)',
                          lineHeight: 1.3,
                        }}>
                          {type.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Detalhes do tipo selecionado */}
          {typeId && (
            <div style={{
              background: 'var(--blb)',
              border: '1px solid rgba(139,184,232,0.2)',
              borderRadius: 'var(--rs)',
              padding: 12,
              marginTop: 8,
            }}>
              <div style={{ fontSize: 11, color: 'var(--bl)', fontWeight: 600, marginBottom: 4 }}>
                💡 Bom pra:
              </div>
              <div style={{ fontSize: 13, color: 'var(--t)', lineHeight: 1.5 }}>
                {POV_TYPES.find((t) => t.id === typeId)?.bestFor}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderPlaceholder(stepNumber) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🚧</div>
        <h3 style={{ color: 'var(--g)', fontSize: 17, marginBottom: 12 }}>
          Step {stepNumber}: {STEP_TITLES[stepNumber - 1]}
        </h3>
        <p style={{ color: 'var(--t2)', fontSize: 14, lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
          Em construção — vem no <strong>Sub-lote 3b</strong>.<br />
          Por enquanto, você pode navegar até aqui mas não avançar.
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
        {step >= 4 && step <= 11 && renderPlaceholder(step)}
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
          {step === TOTAL_STEPS ? '🎬 Gerar POV' : 'Avançar →'}
        </button>
      </div>

      {!canAdvance() && IMPLEMENTED_STEPS.includes(step) && (
        <p className="hint" style={{ textAlign: 'center', marginTop: 12, fontSize: 12 }}>
          Preencha os campos obrigatórios pra avançar.
        </p>
      )}
      {!IMPLEMENTED_STEPS.includes(step) && (
        <p className="hint" style={{ textAlign: 'center', marginTop: 12, fontSize: 12 }}>
          Esta etapa está em construção. Volte ou aguarde a Sessão 3b.
        </p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Componentes auxiliares (copiados do AvatarWizard.jsx — pattern do projeto)
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

// ════════════════════════════════════════════════════════════════════════
// Helper de renderização das categorias agrupadas (Step 2)
// ════════════════════════════════════════════════════════════════════════

function renderCategoryOptions() {
  // Agrupa as 29 categorias TikTok Shop em 6 macro-grupos
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
