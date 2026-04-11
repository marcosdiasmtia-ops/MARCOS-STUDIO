import { useState } from 'react';
import { getProfiles, saveProfile, deleteProfile, fileToBase64 } from './api';

export default function ProfileManager({ onClose, onSelect }) {
  const [profiles, setProfiles] = useState(getProfiles());
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', bodyDescription: '', photo: null });

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { preview } = await fileToBase64(file);
    setForm(p => ({ ...p, photo: preview }));
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const profile = {
      ...form,
      id: editing?.id || undefined,
      isLigia: false
    };
    const updated = saveProfile(profile);
    setProfiles(updated);
    setForm({ name: '', bodyDescription: '', photo: null });
    setEditing(null);
  };

  const handleEdit = (p) => {
    if (p.isLigia) return;
    setEditing(p);
    setForm({ name: p.name, bodyDescription: p.bodyDescription, photo: p.photo });
  };

  const handleDelete = (id) => {
    const updated = deleteProfile(id);
    setProfiles(updated);
  };

  const isFormOpen = editing !== null || form.name;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>👤 Influencers</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Profile list */}
        <div className="profile-list">
          {profiles.map(p => (
            <div key={p.id} className="profile-card" onClick={() => onSelect(p)}>
              <div className="profile-avatar">
                {p.photo ? <img src={p.photo} alt={p.name}/> : <span>{p.isLigia ? '⭐' : p.name[0]}</span>}
              </div>
              <div className="profile-info">
                <div className="profile-name">
                  {p.name}
                  {p.isLigia && <span className="badge-sm">padrão</span>}
                </div>
                <div className="profile-body">{p.bodyDescription?.substring(0, 60)}...</div>
              </div>
              <div className="profile-actions">
                {!p.isLigia && (
                  <>
                    <button className="icon-btn" onClick={e => { e.stopPropagation(); handleEdit(p); }}>✏️</button>
                    <button className="icon-btn" onClick={e => { e.stopPropagation(); handleDelete(p.id); }}>🗑️</button>
                  </>
                )}
                <button className="select-btn" onClick={e => { e.stopPropagation(); onSelect(p); }}>Usar</button>
              </div>
            </div>
          ))}
        </div>

        {/* Add/Edit form */}
        <div className="profile-form">
          <h3>{editing ? `Editar ${editing.name}` : '+ Nova Influencer'}</h3>
          <div className="form-row">
            <div className="photo-upload" onClick={() => document.getElementById('photo-input').click()}>
              {form.photo ? <img src={form.photo} alt="preview"/> : <span>📷 Foto</span>}
              <input id="photo-input" type="file" accept="image/*" hidden onChange={handlePhoto}/>
            </div>
            <div className="form-fields">
              <input placeholder="Nome (ex: Marina)" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}/>
              <textarea placeholder="Descrição do corpo em inglês (ex: slim athletic body, long legs, tanned skin...)"
                value={form.bodyDescription} rows={3}
                onChange={e => setForm(p => ({ ...p, bodyDescription: e.target.value }))}/>
            </div>
          </div>
          <div className="form-actions">
            {editing && <button className="cancel-btn" onClick={() => { setEditing(null); setForm({ name: '', bodyDescription: '', photo: null }); }}>Cancelar</button>}
            <button className="save-btn" onClick={handleSave} disabled={!form.name.trim()}>
              {editing ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
