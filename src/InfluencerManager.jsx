// src/InfluencerManager.jsx (v1.0 — Sessão 3.5: aba dedicada de cadastro)
//
// Aba "👤 Influencers" do MARCOS-STUDIO. Source of truth ÚNICA pra cadastro
// de influencers, usada por todas as abas de geração de vídeo (VTON,
// UGC Falante, e qualquer outra futura).
//
// ARQUITETURA REFERENCIADA:
//   Notion: HUB MARCOS-STUDIO → Arquitetura UGC Falante v3.0
//   Plano de codificação: Sessão 3.5 (refator de cadastro)
//     Fase 1 (cria InfluencerManager + adiciona tab) ← VOCÊ ESTÁ AQUI
//     Fase 2 (limpa VtonStudio — remove cadastro embutido)
//     Fase 3 (UgcStudio ganha botão + Nova + visual gender)
//
// EXTRAÍDO DE: VtonStudio.jsx (lógica de cadastro estava embutida lá)
// EVOLUÇÃO: adiciona campo `gender` (M/F) — sistema dos endpoints já tava
// preparado pra isso (recommendVoice aceita gender, VOICE_BY_STYLE_MALE
// existe em ugc-veo-voices.js).
//
// STORAGE: usa as MESMAS funções de api.js que VtonStudio usa
//   (getVtonProfiles, saveVtonProfile, deleteVtonProfile).
//   localStorage key: marcos-studio-vton-profiles.
//   ⇒ Cassandra/Lígia continuam funcionando sem migração.
//
// RETROCOMPAT: perfis antigos sem `gender` continuam válidos. Quando
// editados, marca gender=female por padrão (todas atuais são femininas)
// mas pede pra Marcos confirmar.

import { useState, useEffect } from 'react';
import {
  analyzeFace,
  getVtonProfiles,
  saveVtonProfile,
  deleteVtonProfile,
} from './api';

// ═══════════════════════════════════════════════════════════════════════
// HELPER: compressImage (extraído de VtonStudio, idêntico)
// ═══════════════════════════════════════════════════════════════════════

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
        });
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

export default function InfluencerManager() {
  const [profiles, setProfiles] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editing, setEditing] = useState(null); // perfil em edição (null = novo)

  // Form state
  const [name, setName] = useState('');
  const [gender, setGender] = useState('female'); // 'female' | 'male'
  const [photo, setPhoto] = useState(null); // {base64, mimeType, preview}
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setProfiles(getVtonProfiles());
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────
  function resetForm() {
    setName('');
    setGender('female');
    setPhoto(null);
    setAnalysis(null);
    setError(null);
    setAnalyzing(false);
    setEditing(null);
  }

  function goToList() {
    resetForm();
    setView('list');
  }

  function startNew() {
    resetForm();
    setView('form');
  }

  function startEdit(profile) {
    setEditing(profile);
    setName(profile.name);
    setGender(profile.gender || 'female'); // perfis antigos: default female
    setPhoto({
      base64: profile.facePhoto.base64,
      mimeType: profile.facePhoto.mimeType,
      preview: profile.facePhoto.preview,
    });
    setAnalysis({
      hair: profile.hair,
      ageHint: profile.ageHint,
      vibe: profile.vibe,
      signature: profile.signature,
    });
    setError(null);
    setView('form');
  }

  // ── Handlers ─────────────────────────────────────────────────────────
  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await compressImage(file, 1280, 0.85);
      setPhoto(data);
      setError(null);
      setAnalysis(null);

      setAnalyzing(true);
      const result = await analyzeFace({
        faceBase64: data.base64,
        faceMimeType: data.mimeType,
      });
      setAnalysis(result);
    } catch (err) {
      console.error('[InfluencerManager] analyze error:', err);
      setError(err.message || 'Erro ao analisar foto');
    } finally {
      setAnalyzing(false);
    }
  }

  function handleSave() {
    if (!name.trim() || !photo || !analysis) return;
    const profile = {
      id: editing?.id || `vton_${Date.now()}`,
      name: name.trim(),
      gender, // ⭐ campo NOVO da Sessão 3.5
      facePhoto: {
        base64: photo.base64,
        mimeType: photo.mimeType,
        preview: photo.preview,
      },
      hair: analysis.hair,
      ageHint: analysis.ageHint,
      vibe: analysis.vibe,
      signature: analysis.signature,
      bodyHint: editing?.bodyHint || null, // preservado em edição
      createdAt: editing?.createdAt || new Date().toISOString(),
    };
    const updated = saveVtonProfile(profile);
    setProfiles(updated);
    goToList();
  }

  function handleDelete(id) {
    if (!confirm('Deletar essa influencer? Essa ação não pode ser desfeita.')) {
      return;
    }
    const updated = deleteVtonProfile(id);
    setProfiles(updated);
  }

  // ── Render ───────────────────────────────────────────────────────────
  if (view === 'form') return renderForm();
  return renderList();

  function renderList() {
    return (
      <div className="container">
        <div className="header">
          <span className="badge">Influencers · v1.0</span>
          <h1 className="title">👤 Cadastro de Influencers</h1>
          <p className="subtitle">
            Gerencie suas influencers · disponíveis em todas as abas (VTON, UGC Falante)
          </p>
        </div>
        <div className="card">
          <div className="card-header-row">
            <h3 className="card-title">
              Cadastradas ({profiles.length})
            </h3>
            <button className="main-btn" onClick={startNew}>
              + Nova Influencer
            </button>
          </div>
          {profiles.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <p className="hint" style={{ marginBottom: 12 }}>
                📭 Nenhuma cadastrada ainda.
              </p>
              <p className="hint" style={{ fontSize: 12 }}>
                Cadastra a primeira influencer pra começar a gerar vídeos.
              </p>
            </div>
          )}
          {profiles.map((p) => (
            <div
              key={p.id}
              className="card influencer-selector"
              style={{ marginBottom: 8 }}
            >
              <div className="inf-row">
                <div className="inf-avatar">
                  {p.facePhoto?.preview ? (
                    <img src={p.facePhoto.preview} alt={p.name} />
                  ) : (
                    '👤'
                  )}
                </div>
                <div className="inf-info">
                  <div className="inf-name">
                    {p.gender === 'male' ? '👨' : '👩'} {p.name}
                    {!p.gender && (
                      <span
                        style={{
                          fontSize: 10,
                          color: '#ffaa44',
                          marginLeft: 8,
                          fontWeight: 'normal',
                        }}
                        title="Perfil antigo sem gênero — clica em Editar pra atualizar"
                      >
                        ⚠️ sem gênero
                      </span>
                    )}
                  </div>
                  <div className="inf-hint">
                    {p.hair?.color || '?'} · {p.vibe || '?'}
                    {p.gender && (
                      <span style={{ opacity: 0.7 }}>
                        {' · '}
                        {p.gender === 'male' ? 'masculino' : 'feminino'}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="back-btn"
                    onClick={() => startEdit(p)}
                    style={{ fontSize: 11, padding: '4px 10px' }}
                  >
                    Editar
                  </button>
                  <button
                    className="back-btn"
                    onClick={() => handleDelete(p.id)}
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      color: '#ff8888',
                    }}
                  >
                    Deletar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {profiles.some((p) => !p.gender) && (
            <div
              className="hint"
              style={{
                marginTop: 12,
                padding: 12,
                background: 'rgba(255,170,68,0.08)',
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              💡 Algumas influencers ainda não têm gênero cadastrado. Clica em
              "Editar" pra atualizar — assim o sistema recomenda a voz Veo 3
              correta automaticamente em UGC Falante.
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderForm() {
    return (
      <div className="container">
        <button
          className="back-btn"
          onClick={goToList}
          style={{ marginBottom: 14 }}
        >
          ← Voltar
        </button>
        <div className="header">
          <h1 className="title">
            {editing ? 'Editar Influencer' : 'Nova Influencer'}
          </h1>
          <p className="subtitle">
            Cadastro mínimo: nome, gênero e 1 foto de rosto bem iluminada
          </p>
        </div>
        <div className="card">
          <h3 className="card-title">Dados básicos</h3>

          <div className="field">
            <label>Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Aline"
            />
          </div>

          {/* Campo NOVO da Sessão 3.5 */}
          <div className="field">
            <label>Gênero</label>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <label
                style={{
                  flex: 1,
                  cursor: 'pointer',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border:
                    gender === 'female'
                      ? '2px solid var(--gb)'
                      : '1px solid var(--bd)',
                  background:
                    gender === 'female' ? 'var(--gd)' : 'transparent',
                  color: gender === 'female' ? 'var(--g)' : 'var(--t1)',
                  fontWeight: gender === 'female' ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                }}
              >
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={gender === 'female'}
                  onChange={(e) => setGender(e.target.value)}
                  style={{ display: 'none' }}
                />
                👩 Feminino
              </label>
              <label
                style={{
                  flex: 1,
                  cursor: 'pointer',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border:
                    gender === 'male'
                      ? '2px solid var(--gb)'
                      : '1px solid var(--bd)',
                  background:
                    gender === 'male' ? 'var(--gd)' : 'transparent',
                  color: gender === 'male' ? 'var(--g)' : 'var(--t1)',
                  fontWeight: gender === 'male' ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                }}
              >
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={gender === 'male'}
                  onChange={(e) => setGender(e.target.value)}
                  style={{ display: 'none' }}
                />
                👨 Masculino
              </label>
            </div>
            <div
              className="hint"
              style={{ fontSize: 11, marginTop: 6, color: 'var(--t2)' }}
            >
              Usado em UGC Falante pra recomendar voz Veo 3 (femininas: Zephyr,
              Kore, etc · masculinas: Charon, Puck, Orus, etc)
            </div>
          </div>

          <div className="field">
            <label>Foto de rosto (close-up bem iluminado)</label>
            <label className="upload-area">
              {photo?.preview ? (
                <img src={photo.preview} alt="rosto" />
              ) : (
                <span>📸 Clica pra subir</span>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {analyzing && (
            <div
              className="loading-screen"
              style={{ minHeight: 120, padding: 20 }}
            >
              <div className="spinner"></div>
              <div className="loading-sub">Claude analisando rosto...</div>
            </div>
          )}

          {error && (
            <div className="error-box">
              <p>{error}</p>
            </div>
          )}

          {analysis && (
            <div
              className="card"
              style={{
                marginTop: 12,
                background: 'rgba(212,165,116,0.05)',
              }}
            >
              <h3 className="card-title">Análise automática</h3>
              <div className="field">
                <label>Cabelo</label>
                <div style={{ fontSize: 13, color: 'var(--t2)' }}>
                  {analysis.hair?.color} · {analysis.hair?.texture} ·{' '}
                  {analysis.hair?.length}
                </div>
              </div>
              <div className="field">
                <label>Idade aparente</label>
                <div style={{ fontSize: 13, color: 'var(--t2)' }}>
                  {analysis.ageHint}
                </div>
              </div>
              <div className="field">
                <label>Vibe</label>
                <div style={{ fontSize: 13, color: 'var(--t2)' }}>
                  {analysis.vibe}
                </div>
              </div>
              <div className="field">
                <label>Pele</label>
                <div style={{ fontSize: 13, color: 'var(--t2)' }}>
                  {analysis.signature?.skin}
                </div>
              </div>
              {analysis.signature?.accent && (
                <div className="field">
                  <label>Sinal distintivo</label>
                  <div style={{ fontSize: 13, color: 'var(--t2)' }}>
                    {analysis.signature.accent}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            className="main-btn"
            onClick={handleSave}
            disabled={!name.trim() || !photo || !analysis || analyzing}
            style={{ marginTop: 20 }}
          >
            {editing ? 'Salvar alterações' : 'Cadastrar influencer'}
          </button>
        </div>
      </div>
    );
  }
}
