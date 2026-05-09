// src/AvatarChoiceModal.jsx (v1.0 — Avatar IA Sessão 3 — modal de escolha "+ Nova Influencer")
//
// Modal apresentado quando Marcos clica "+ Nova Influencer" na aba 👤 Influencers.
// Oferece 2 caminhos visuais:
//   📸 Cadastrar Influencer Real  → fluxo atual (analyzeFace + foto real)
//   ✨ Criar Avatar IA            → wizard de 7 etapas
//
// REFERÊNCIAS arquiteturais:
//   - Decisão #1: naming "Avatar IA" (vs "Real")
//   - Decisão #8: modal de escolha como ponto de entrada único
//
// Props:
//   - isOpen: boolean         (controla visibilidade)
//   - onClose: () => void     (fecha modal sem escolher)
//   - onChooseReal: () => void   (caminho atual de cadastro real)
//   - onChooseAvatar: () => void (abre AvatarWizard — Sessão 3 próximo arquivo)
//
// Comportamento:
//   - ESC fecha
//   - Click no overlay (fora do modal) fecha
//   - Click nos cards dispara o callback apropriado
//   - Sem persistência (puramente reativo)
//
// Estilo: segue padrão `S` inline + CSS variables (--t1, --bg, --bd, etc.)
// dos demais componentes do projeto (UgcStudio, InfluencerManager).

import { useEffect } from 'react';

export default function AvatarChoiceModal({
  isOpen,
  onClose,
  onChooseReal,
  onChooseAvatar,
}) {
  // ESC fecha o modal
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={S.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-choice-title"
    >
      <div
        style={S.modal}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={S.header}>
          <div>
            <h2 id="avatar-choice-title" style={S.title}>
              + Nova Influencer
            </h2>
            <p style={S.subtitle}>Como você quer criar?</p>
          </div>
          <button
            style={S.closeBtn}
            onClick={onClose}
            aria-label="Fechar"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* 2 cards lado a lado */}
        <div style={S.cardsGrid}>
          <ChoiceCard
            icon="📸"
            iconBg="rgba(120, 160, 220, 0.15)"
            title="Cadastrar Influencer Real"
            description="Suba uma foto e o sistema cadastra automaticamente analisando rosto + corpo."
            time="~30 segundos"
            onClick={() => {
              onChooseReal();
              onClose();
            }}
          />

          <ChoiceCard
            icon="✨"
            iconBg="rgba(220, 120, 200, 0.15)"
            title="Criar Avatar IA"
            description="Wizard de 7 etapas pra gerar uma influencer do zero usando IA."
            time="~5 minutos"
            highlight
            onClick={() => {
              onChooseAvatar();
              onClose();
            }}
          />
        </div>

        {/* Footer hint */}
        <div style={S.footerHint}>
          💡 Os dois caminhos salvam no mesmo portfólio. Você pode misturar reais e Avatares IA livremente.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTE: ChoiceCard
// ═══════════════════════════════════════════════════════════════════════

function ChoiceCard({ icon, iconBg, title, description, time, highlight, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...S.card,
        ...(highlight ? S.cardHighlight : {}),
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = 'var(--gb)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = highlight ? 'var(--gb)' : 'var(--bd)';
      }}
    >
      <div style={{ ...S.iconBubble, background: iconBg }}>
        <span style={S.iconChar}>{icon}</span>
      </div>
      <div style={S.cardTitle}>{title}</div>
      <div style={S.cardDesc}>{description}</div>
      <div style={S.cardTime}>⏱ {time}</div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STYLES — segue padrão inline + CSS variables do projeto
// ═══════════════════════════════════════════════════════════════════════

const S = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
    animation: 'fadeIn 0.15s ease-out',
  },
  modal: {
    background: 'var(--bg2)',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    width: '100%',
    maxWidth: 720,
    maxHeight: '90vh',
    overflow: 'auto',
    padding: 24,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 16,
  },
  title: {
    fontSize: 22,
    margin: '0 0 4px 0',
    color: 'var(--t1)',
  },
  subtitle: {
    color: 'var(--t2)',
    fontSize: 13,
    margin: 0,
  },
  closeBtn: {
    background: 'transparent',
    border: '1px solid var(--bd)',
    color: 'var(--t2)',
    width: 32,
    height: 32,
    borderRadius: 16,
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 14,
    marginBottom: 16,
  },
  card: {
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    padding: 20,
    cursor: 'pointer',
    transition: 'all 0.15s ease-out',
    color: 'var(--t1)',
    textAlign: 'left',
    fontFamily: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardHighlight: {
    border: '1px solid var(--gb)',
    background: 'var(--gd)',
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconChar: {
    fontSize: 26,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--t1)',
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 13,
    color: 'var(--t2)',
    lineHeight: 1.4,
    flex: 1,
    marginBottom: 6,
  },
  cardTime: {
    fontSize: 12,
    color: 'var(--t2)',
    opacity: 0.8,
    marginTop: 'auto',
  },
  footerHint: {
    background: 'var(--bg)',
    border: '1px solid var(--bd)',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: 'var(--t2)',
    textAlign: 'center',
    lineHeight: 1.4,
  },
};
