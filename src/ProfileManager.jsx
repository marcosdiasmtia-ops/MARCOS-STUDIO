// src/ProfileManager.jsx (v3.0 — dual-photo upload: rosto + corpo)
//
// CHANGELOG v2.4 → v3.0:
// - Upload separado pra FOTO DE ROSTO (obrigatória) e FOTO DE CORPO (opcional)
// - Foto de rosto → analisa facePrompt
// - Foto de corpo → analisa bodyDescription
// - Se só rosto for enviado: fallback pra análise dupla na mesma foto (v2.4 behavior)
// - UI: 2 espaços lado a lado com labels claras
// - Campos facePrompt e bodyDescription continuam EDITÁVEIS (regra do Marcos)
// - Botão "Reanalisar" pra forçar nova análise (sobrescreve)
//
// FORMATO DO PERFIL SALVO:
//   { id, name, photo (rosto), bodyPhoto (opcional), bodyDescription, facePrompt, createdAt }
// NOTA: o campo "photo" continua sendo o rosto (compat com restante do sistema que usa
// como âncora de identidade). O "bodyPhoto" é novo e opcional.

import { useState } from 'react';
import { getProfiles, saveProfile, deleteProfile, fileToBase64, analyzeIdentity } from './api';

export default function ProfileManager({ onClose, onSelect, forceCreate = false }) {
  const [profiles, setProfiles] = useState(getProfiles());
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    bodyDescription: '',
    facePrompt: '',
    photo: null,       // foto de rosto (preview dataURL)
    bodyPhoto: null,   // foto de corpo (preview dataURL) — v3.0
  });
  // Guarda base64/mimeType em state separado pra poder reanalisar quando
  // a segunda foto chegar (ou quando o usuário quiser reanalise manual)
  const [photoData, setPhotoData] = useState({
    faceBase64: null,
    faceMimeType: null,
    bodyBase64: null,
    bodyMimeType: null,
  });
  const [photoError, setPhotoError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  // Helper: analisa baseado no que já tem carregado
  const runAnalyze = async (faceB64, faceMime, bodyB64, bodyMime) => {
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const analysis = await analyzeIdentity({
        faceBase64: faceB64,
        faceMimeType: faceMime,
        bodyBase64: bodyB64 || null,
        bodyMimeType: bodyMime || null,
      });
      setForm(p => ({
        ...p,
        // Só preenche se o campo estiver vazio — não sobrescreve o que o usuário já digitou
        facePrompt: p.facePrompt?.trim() ? p.facePrompt : analysis.facePrompt,
        bodyDescription: p.bodyDescription?.trim() ? p.bodyDescription : analysis.bodyDescription,
      }));
    } catch (err) {
      console.error('[analyze] falhou:', err);
      setAnalyzeError('Não consegui analisar automaticamente. Você pode preencher os campos manualmente.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Handler da FOTO DE ROSTO
  const handleFacePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    setAnalyzeError('');
    try {
      const { preview, base64, mimeType } = await fileToBase64(file);
      setForm(p => ({ ...p, photo: preview }));
      setPhotoData(d => ({ ...d, faceBase64: base64, faceMimeType: mimeType }));

      // Dispara análise — usa corpo se já tiver sido carregado, senão fallback single-photo
      await runAnalyze(base64, mimeType, photoData.bodyBase64, photoData.bodyMimeType);
    } catch (err) {
      setPhotoError('Erro ao ler a foto de rosto. Tenta outra.');
    }
  };

  // Handler da FOTO DE CORPO (v3.0)
  const handleBodyPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    setAnalyzeError('');
    try {
      const { preview, base64, mimeType } = await fileToBase64(file);
      setForm(p => ({ ...p, bodyPhoto: preview }));
      setPhotoData(d => ({ ...d, bodyBase64: base64, bodyMimeType: mimeType }));

      // Se rosto já foi carregado, reanalisa COM as 2 fotos juntas
      if (photoData.faceBase64) {
        await runAnalyze(photoData.faceBase64, photoData.faceMimeType, base64, mimeType);
      } else {
        // Corpo primeiro, sem rosto ainda — aguarda rosto
        setAnalyzeError('Foto de corpo carregada. Agora envie a foto de rosto pra iniciar a análise.');
      }
    } catch (err) {
      setPhotoError('Erro ao ler a foto de corpo. Tenta outra.');
    }
  };

  // Reanalise manual (botão) — FORÇA nova análise sobrescrevendo campos
  const handleReanalyze = async () => {
    if (!photoData.faceBase64) {
      setAnalyzeError('Precisa pelo menos da foto de rosto pra reanalisar.');
      return;
    }
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const analysis = await analyzeIdentity({
        faceBase64: photoData.faceBase64,
        faceMimeType: photoData.faceMimeType,
        bodyBase64: photoData.bodyBase64 || null,
        bodyMimeType: photoData.bodyMimeType || null,
      });
      setForm(p => ({
        ...p,
        facePrompt: analysis.facePrompt,
        bodyDescription: analysis.bodyDescription,
      }));
    } catch (err) {
      setAnalyzeError('Erro na reanalise. Tenta de novo.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = () => {
    setPhotoError('');
    if (!form.name.trim()) return;
    if (!form.photo) {
      setPhotoError('Foto de rosto é obrigatória — ela é a referência visual para todas as imagens geradas.');
      return;
    }
    const profile = {
      ...form,
      id: editing?.id || undefined,
    };
    const updated = saveProfile(profile);
    setProfiles(updated);
    resetForm();
  };

  const resetForm = () => {
    setForm({ name: '', bodyDescription: '', facePrompt: '', photo: null, bodyPhoto: null });
    setPhotoData({ faceBase64: null, faceMimeType: null, bodyBase64: null, bodyMimeType: null });
    setEditing(null);
    setAnalyzeError('');
    setPhotoError('');
  };

  const handleEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      bodyDescription: p.bodyDescription || '',
      facePrompt: p.facePrompt || '',
      photo: p.photo,
      bodyPhoto: p.bodyPhoto || null,
    });
    // Quando edita, não tem base64 disponível (só preview). Se quiser reanalisar,
    // usuário precisa re-enviar a foto.
    setPhotoData({ faceBase64: null, faceMimeType: null, bodyBase64: null, bodyMimeType: null });
    setAnalyzeError('');
  };

  const handleDelete = (id) => {
    const updated = deleteProfile(id);
    setProfiles(updated);
  };

  const handleCancel = () => resetForm();

  const hasProfiles = profiles.length > 0;
  const canReanalyze = !!photoData.faceBase64 && !analyzing;

  return (
    <div className="modal-overlay" onClick={forceCreate ? undefined : onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>👤 Influencers</h2>
          {!forceCreate && <button className="close-btn" onClick={onClose}>✕</button>}
        </div>

        {forceCreate && !hasProfiles && (
          <div className="dif-box" style={{margin:'0 0 12px 0'}}>
            <span className="dif-label">Primeiro acesso</span>
            <p className="hint" style={{marginTop:6}}>Cadastre pelo menos uma influencer para começar. Envie uma foto de rosto (obrigatória) e opcionalmente uma foto de corpo inteiro pra análise mais precisa.</p>
          </div>
        )}

        {/* Profile list */}
        {hasProfiles && (
          <div className="profile-list">
            {profiles.map(p => (
              <div key={p.id} className="profile-card" onClick={() => onSelect(p)}>
                <div className="profile-avatar">
                  {p.photo ? <img src={p.photo} alt={p.name}/> : <span>{p.name[0]}</span>}
                </div>
                <div className="profile-info">
                  <div className="profile-name">
                    {p.name}
                    {p.facePrompt ? <span className="badge-sm" style={{marginLeft:6,fontSize:10,opacity:0.7}}>v3.0</span> : null}
                  </div>
                  <div className="profile-body">{p.bodyDescription?.substring(0, 60) || 'Sem descrição'}{p.bodyDescription?.length > 60 ? '...' : ''}</div>
                </div>
                <div className="profile-actions">
                  <button className="icon-btn" onClick={e => { e.stopPropagation(); handleEdit(p); }}>✏️</button>
                  <button className="icon-btn" onClick={e => { e.stopPropagation(); if(confirm(`Excluir ${p.name}?`)) handleDelete(p.id); }}>🗑️</button>
                  <button className="select-btn" onClick={e => { e.stopPropagation(); onSelect(p); }}>Usar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit form */}
        <div className="profile-form">
          <h3>{editing ? `Editar ${editing.name}` : '+ Nova Influencer'}</h3>

          {/* v3.0: 2 uploads lado a lado */}
          <div className="form-row" style={{gap:12}}>
            {/* FOTO DE ROSTO (obrigatória) */}
            <div style={{flex:1}}>
              <label style={{display:'block', fontSize:12, marginBottom:4, opacity:0.8}}>
                📷 Foto de rosto *
              </label>
              <div
                className="photo-upload"
                onClick={() => document.getElementById('face-photo-input').click()}
                style={{width:'100%', aspectRatio:'1/1', cursor:'pointer'}}
              >
                {form.photo ? <img src={form.photo} alt="rosto"/> : <span>Clique pra enviar</span>}
                <input id="face-photo-input" type="file" accept="image/*" hidden onChange={handleFacePhoto}/>
              </div>
              <p className="hint" style={{fontSize:10, marginTop:4, opacity:0.6}}>
                Close do rosto (obrigatória)
              </p>
            </div>

            {/* FOTO DE CORPO (opcional — v3.0) */}
            <div style={{flex:1}}>
              <label style={{display:'block', fontSize:12, marginBottom:4, opacity:0.8}}>
                🧍 Foto de corpo
              </label>
              <div
                className="photo-upload"
                onClick={() => document.getElementById('body-photo-input').click()}
                style={{width:'100%', aspectRatio:'1/1', cursor:'pointer'}}
              >
                {form.bodyPhoto ? <img src={form.bodyPhoto} alt="corpo"/> : <span>Clique pra enviar</span>}
                <input id="body-photo-input" type="file" accept="image/*" hidden onChange={handleBodyPhoto}/>
              </div>
              <p className="hint" style={{fontSize:10, marginTop:4, opacity:0.6}}>
                Corpo inteiro (opcional, mas melhora análise)
              </p>
            </div>
          </div>

          {/* Campos de texto */}
          <div className="form-fields" style={{marginTop:12}}>
            <input
              placeholder="Nome (ex: Lígia, Marina...)"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
            <textarea
              placeholder="Descrição do corpo em inglês (preenchida automaticamente após análise)"
              value={form.bodyDescription}
              rows={2}
              onChange={e => setForm(p => ({ ...p, bodyDescription: e.target.value }))}
              disabled={analyzing}
            />
            <textarea
              placeholder="Descrição detalhada do rosto em inglês — facePrompt (preenchida automaticamente após análise)"
              value={form.facePrompt}
              rows={5}
              onChange={e => setForm(p => ({ ...p, facePrompt: e.target.value }))}
              disabled={analyzing}
            />
          </div>

          {/* Botão de reanalise manual (só aparece se tiver foto de rosto carregada) */}
          {canReanalyze && (
            <button
              type="button"
              className="icon-btn"
              onClick={handleReanalyze}
              style={{marginTop:8, fontSize:12, padding:'6px 12px'}}
              disabled={analyzing}
            >
              🔄 Reanalisar com Claude Vision
            </button>
          )}

          {/* Feedback visual */}
          {analyzing && (
            <p className="hint" style={{color:'#a3a3f5',marginTop:6}}>
              🔍 Analisando com Claude Vision... aguarde uns segundos.
            </p>
          )}
          {analyzeError && !analyzing && (
            <p className="hint" style={{color:'#eab308',marginTop:6}}>⚠️ {analyzeError}</p>
          )}
          {photoError && (
            <p className="hint" style={{color:'#ef4444',marginTop:6}}>⚠️ {photoError}</p>
          )}

          <div className="form-actions">
            {editing && (
              <button className="cancel-btn" onClick={handleCancel}>
                Cancelar
              </button>
            )}
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={!form.name.trim() || !form.photo || analyzing}
            >
              {analyzing ? 'Analisando...' : (editing ? 'Salvar' : 'Adicionar')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
