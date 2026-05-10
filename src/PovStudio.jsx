// src/PovStudio.jsx (v1.0 — Sub-lote 3a — container da aba POV)
//
// Container principal da aba POV. Roteia entre 3 modos:
//   - 'wizard'   → PovWizard (formulário de 11 passos pra gerar vídeo)
//   - 'output'   → PovOutput (tela final com vídeo + pacote postagem) [3c]
//   - 'gallery'  → PovGallery (POVs gerados anteriormente) [3c]
//
// SUB-LOTE 3a: só implementa o modo 'wizard'. Os outros são placeholders
// até as Sessões 3b/3c.
//
// PROPS:
//   - onSwitchTab(tabName) — callback pra ir pra outras abas (ex: redirecionar
//                            pra aba 'influencers' se zero influencers cadastradas)

import { useState } from 'react';
import PovWizard from './PovWizard';

const POV_GALLERY_KEY = 'marcos-studio-pov-gallery';

export default function PovStudio({ onSwitchTab }) {
  // 'wizard' | 'output' | 'gallery'
  const [mode, setMode] = useState('wizard');

  // Resultado do wizard (preenchido quando usuário gera um POV) — usado em 3c
  const [currentResult, setCurrentResult] = useState(null);

  // Sub-lote 3a: o wizard quando completar (no 3b) vai chamar onComplete(result).
  // Por enquanto, o wizard nem termina — só implementamos os primeiros steps.
  function handleWizardComplete(result) {
    setCurrentResult(result);
    setMode('output');
  }

  function handleStartNew() {
    setCurrentResult(null);
    setMode('wizard');
  }

  function handleOpenGallery() {
    setMode('gallery');
  }

  // ── Renderização ─────────────────────────────────────────────────────
  return (
    <div className="container" style={{ maxWidth: 720 }}>
      {/* Header da aba */}
      <div className="header" style={{ marginBottom: 24 }}>
        <div className="badge">🎬 POV · Point of View</div>
        <h1 className="title" style={{ marginTop: 8 }}>POV Studio</h1>
        <p className="subtitle">
          Gere vídeos POV (mãos + produto) prontos pra TikTok Shop.
          Sem rosto, vibe TikTok autêntica.
        </p>
      </div>

      {/* Navegação interna (modo: wizard | gallery) */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 20,
        justifyContent: 'center',
      }}>
        <button
          onClick={handleStartNew}
          style={{
            background: mode === 'wizard' ? 'var(--gd)' : 'transparent',
            border: mode === 'wizard' ? '1px solid var(--gb)' : '1px solid var(--bd)',
            color: mode === 'wizard' ? 'var(--g)' : 'var(--t2)',
            padding: '6px 14px',
            borderRadius: 16,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ✨ Novo POV
        </button>
        <button
          onClick={handleOpenGallery}
          disabled
          title="Disponível na Sessão 3c"
          style={{
            background: 'transparent',
            border: '1px solid var(--bd)',
            color: 'var(--t3)',
            padding: '6px 14px',
            borderRadius: 16,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'not-allowed',
            fontFamily: 'inherit',
            opacity: 0.5,
          }}
        >
          🖼 Galeria (em breve)
        </button>
      </div>

      {/* Conteúdo do modo selecionado */}
      {mode === 'wizard' && (
        <PovWizard
          onComplete={handleWizardComplete}
          onSwitchTab={onSwitchTab}
        />
      )}

      {mode === 'output' && (
        <PlaceholderCard
          icon="🎬"
          title="Tela Final do POV"
          message="Esta tela mostrará o vídeo final gerado + pacote de postagem (descrição, hashtags, CTAs, sugestões de música). Disponível na Sessão 3c."
          onBack={handleStartNew}
        />
      )}

      {mode === 'gallery' && (
        <PlaceholderCard
          icon="🖼"
          title="Galeria de POVs"
          message="Aqui ficarão todos os POVs gerados anteriormente, com filtros por influencer/categoria/duração. Disponível na Sessão 3c."
          onBack={handleStartNew}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Placeholder reutilizável pros modos não implementados (output / gallery)
// ════════════════════════════════════════════════════════════════════════

function PlaceholderCard({ icon, title, message, onBack }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>{icon}</div>
      <h2 style={{
        fontSize: 18,
        color: 'var(--g)',
        marginBottom: 12,
        fontWeight: 700,
      }}>
        {title}
      </h2>
      <p style={{
        color: 'var(--t2)',
        fontSize: 14,
        lineHeight: 1.6,
        maxWidth: 400,
        margin: '0 auto 24px',
      }}>
        {message}
      </p>
      <button onClick={onBack} className="back-btn">
        ← Voltar pro wizard
      </button>
    </div>
  );
}
