// src/PovStudio.jsx (v1.2 — Sub-lote 3c — galeria + variação + edição)
//
// Container principal da aba POV. Roteia entre 3 modos:
//   - 'wizard'   → PovWizard (formulário de 11 passos)
//   - 'output'   → PovOutput (pipeline + tela final)
//   - 'gallery'  → PovGallery (POVs gerados anteriormente) ✅ NOVO 3c
//
// Fluxos novos do 3c:
//   1. "🖼 Galeria" → mode='gallery' (lista POVs salvos)
//   2. "🔁 Variar" na galeria → mode='output' direto com wizardData salvo
//      (pula wizard inteiro, dispara pipeline com mesma config)
//   3. "✏️ Editar" na galeria → mode='wizard' com initialData pré-preenchido
//   4. PovOutput salva URL pública do produto pra permitir variação direta
//
// PROPS:
//   - onSwitchTab(tabName) — callback pra outras abas

import { useState } from 'react';
import PovWizard from './PovWizard';
import PovOutput from './PovOutput';
import PovGallery from './PovGallery';

export default function PovStudio({ onSwitchTab }) {
  // 'wizard' | 'output' | 'gallery'
  const [mode, setMode] = useState('wizard');

  // wizardData consolidado: vira input do PovOutput
  const [wizardData, setWizardData] = useState(null);

  // initialData: pré-preenche o wizard quando vem de "Editar config"
  const [wizardInitialData, setWizardInitialData] = useState(null);

  // ── Handlers do wizard ────────────────────────────────────────────────
  function handleWizardComplete(data) {
    setWizardData(data);
    setMode('output');
  }

  function handleStartNew() {
    setWizardData(null);
    setWizardInitialData(null);
    setMode('wizard');
  }

  // ── Handlers da galeria ───────────────────────────────────────────────
  function handleOpenGallery() {
    setMode('gallery');
  }

  function handleVariation(savedWizardData) {
    // Variação: dispara pipeline direto com config salva
    setWizardData(savedWizardData);
    setMode('output');
  }

  function handleEditConfig(savedWizardData) {
    // Edição: volta pro wizard pré-preenchido
    setWizardInitialData(savedWizardData);
    setWizardData(null);
    setMode('wizard');
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
          style={{
            background: mode === 'gallery' ? 'var(--gd)' : 'transparent',
            border: mode === 'gallery' ? '1px solid var(--gb)' : '1px solid var(--bd)',
            color: mode === 'gallery' ? 'var(--g)' : 'var(--t2)',
            padding: '6px 14px',
            borderRadius: 16,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          🖼 Galeria
        </button>
      </div>

      {/* Conteúdo do modo selecionado */}
      {mode === 'wizard' && (
        <PovWizard
          onComplete={handleWizardComplete}
          onSwitchTab={onSwitchTab}
          initialData={wizardInitialData}
        />
      )}

      {mode === 'output' && wizardData && (
        <PovOutput
          wizardData={wizardData}
          onStartNew={handleStartNew}
        />
      )}

      {mode === 'gallery' && (
        <PovGallery
          onStartVariation={handleVariation}
          onEditConfig={handleEditConfig}
          onClose={handleStartNew}
        />
      )}
    </div>
  );
}
