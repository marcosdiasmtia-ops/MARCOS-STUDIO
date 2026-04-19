import { useState } from 'react';
import { getProfiles, saveProfile, deleteProfile, fileToBase64, analyzeIdentity } from './api';

export default function ProfileManager({ onClose, onSelect, forceCreate = false }) {
  const [profiles, setProfiles] = useState(getProfiles());
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    bodyDescription: '',
    facePrompt: '',   // v2.4
    photo: null
  });
  const [photoError, setPhotoError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);   // v2.4
  const [analyzeError, setAnalyzeError] = useState(''); // v2.4

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    setAnalyzeError('');
    try {
      const { preview, base64, mimeType } = await fileToBase64(file);
      setForm(p => ({ ...p, photo: preview }));

      // v2.4: analisar automaticamente a foto via Claude Vision
      setAnalyzing(true);
      try {
        const analysis = await analyzeIdentity(base64, mimeType);
        setForm(p => ({
          ...p,
          // Só preenche se o campo estiver vazio — não sobrescreve o que o usuário já digitou
          facePrompt: p.facePrompt?.trim() ? p.facePrompt : analysis.facePrompt,
          bodyDescription: p.bodyDescription?.trim() ? p.bodyDescription : analysis.bodyDescription,
        }));
      } catch (err) {
        console.error('[analyze] falhou:', err);
        setAnalyzeError('Não consegui analisar a foto automaticamente. Você pode preencher os campos manualmente.');
      } finally {
        setAnalyzing(false);
      }
    } catch (err) {
      setPhotoError('Erro ao ler a foto. Tenta outra.');
    }
  };

  const handleSave = () => {
    setPhotoError('');
    if (!form.name.trim()) return;
    if (!form.photo) {
      setPhotoError('Foto da influencer é obrigatória — ela é a referência visual para todas as imagens geradas.');
      return;
    }
    const profile = {
      ...form,
      id: editing?.id || undefined,
    };
    const updated = saveProfile(profile);
    setProfiles(updated);
    setForm({ name: '', bodyDescription: '', facePrompt: '', photo: null });
    setEditing(null);
    setAnalyzeError('');
  };

  const handleEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      bodyDescription: p.bodyDescription || '',
      facePrompt: p.facePrompt || '',   // v2.4: carrega facePrompt ao editar
      photo: p.photo
    });
    setAnalyzeError('');
  };

  const handleDelete = (id) => {
    const updated = deleteProfile(id);
    setProfiles(updated);
  };

  const handleCancel = () => {
    setEditing(null);
    setForm({ name: '', bodyDescription: '', facePrompt: '', photo: null });
    setPhotoError('');
    setAnalyzeError('');
  };

  const hasProfiles = profiles.length > 0;

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
            <p className="hint" style={{marginTop:6}}>Cadastre pelo menos uma influencer para começar. A foto e as descrições de rosto e corpo são usadas como referência visual em todas as imagens geradas.</p>
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
                    {p.facePrompt ? <span className="badge-sm" style={{marginLeft:6,fontSize:10,opacity:0.7}}>v2.4</span> : null}
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
          <div className="form-row">
            <div className="photo-upload" onClick={() => document.getElementById('photo-input').click()}>
              {form.photo ? <img src={form.photo} alt="preview"/> : <span>📷 Foto *</span>}
              <input id="photo-input" type="file" accept="image/*" hidden onChange={handlePhoto}/>
            </div>
            <div className="form-fields">
              <input
                placeholder="Nome (ex: Lígia, Marina...)"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
              <textarea
                placeholder="Descrição do corpo em inglês (preenchido automaticamente após análise da foto)"
                value={form.bodyDescription}
                rows={2}
                onChange={e => setForm(p => ({ ...p, bodyDescription: e.target.value }))}
                disabled={analyzing}
              />
              <textarea
                placeholder="Descrição detalhada do rosto em inglês — facePrompt (preenchido automaticamente após análise da foto)"
                value={form.facePrompt}
                rows={5}
                onChange={e => setForm(p => ({ ...p, facePrompt: e.target.value }))}
                disabled={analyzing}
              />
            </div>
          </div>

          {/* Feedback visual da análise */}
          {analyzing && (
            <p className="hint" style={{color:'#a3a3f5',marginTop:6}}>
              🔍 Analisando a foto com Claude Vision... aguarde uns segundos.
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
