import { useState } from 'react';
import { getProfiles, saveProfile, deleteProfile, fileToBase64 } from './api';

export default function ProfileManager({ onClose, onSelect, forceCreate = false }) {
  const [profiles, setProfiles] = useState(getProfiles());
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', bodyDescription: '', photo: null });
  const [photoError, setPhotoError] = useState('');

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    try {
      const { preview } = await fileToBase64(file);
      setForm(p => ({ ...p, photo: preview }));
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
    setForm({ name: '', bodyDescription: '', photo: null });
    setEditing(null);
  };

  const handleEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, bodyDescription: p.bodyDescription, photo: p.photo });
  };

  const handleDelete = (id) => {
    const updated = deleteProfile(id);
    setProfiles(updated);
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
            <p className="hint" style={{marginTop:6}}>Cadastre pelo menos uma influencer para começar. A foto e a descrição corporal são usadas como referência visual em todas as imagens geradas.</p>
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
                  <div className="profile-name">{p.name}</div>
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
              <input placeholder="Nome (ex: Lígia, Marina...)" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}/>
              <textarea placeholder="Descrição do corpo em inglês (ex: curvy natural Brazilian body, defined waist, full rounded hips...)"
                value={form.bodyDescription} rows={3}
                onChange={e => setForm(p => ({ ...p, bodyDescription: e.target.value }))}/>
            </div>
          </div>
          {photoError && <p className="hint" style={{color:'#ef4444',marginTop:6}}>⚠️ {photoError}</p>}
          <div className="form-actions">
            {editing && <button className="cancel-btn" onClick={() => { setEditing(null); setForm({ name: '', bodyDescription: '', photo: null }); setPhotoError(''); }}>Cancelar</button>}
            <button className="save-btn" onClick={handleSave} disabled={!form.name.trim() || !form.photo}>
              {editing ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
