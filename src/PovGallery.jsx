// src/PovGallery.jsx (v1.1 — Opção C: exibe NAME amigável da voz em vez do id/hash)
//
// CHANGELOG v1.1 (13/05/2026 — Opção C, Sub-passo 3):
//   🆕 No modal de detalhes do POV, o campo "Áudio: Com voz (X)" agora
//      exibe o NOME amigável da voz (ex: "Raquel") em vez do id cru
//      (que vai virar voice_id hash do ElevenLabs Voice Library no v2.0
//      do data file).
//   🔁 Retrocompat 100%: usa fallback `voice?.name || w.voiceId` — se o
//      data file ainda não tiver `name` (vozes anglo legacy), exibe o id
//      idêntico ao comportamento v1.0.
//
// CHANGELOG v1.0 (10/05/2026 — Sub-lote 3c):
//
// Lista todos os POVs gerados anteriormente (salvos em localStorage por
// PovOutput.jsx). Permite filtrar, abrir, gerar variação, editar config,
// e deletar.
//
// SCHEMA do entry (definido em PovOutput.jsx):
//   {
//     id: 'pov_${timestamp}',
//     createdAt: ISO date string,
//     finalVideoUrl: string,
//     wizardData: {
//       productName, productDescription, productPrice, productOriginalPrice,
//       productCategoryId, productViralTranscript,
//       productPhotoUrl?,           // URL fal.ai (salvada no 3c)
//       handsReferenceUrl?,         // URL fal.ai (salvada no 3c)
//       influencerId, influencerName, influencerGender,
//       typeId, scenarioId, styleId, durationId,
//       handsMode, handsId,
//       audioMode, voiceId,
//       musicSuggestion,
//     },
//     packageData: { description, hashtags, ctaWritten, script, musicSuggestion },
//     takesData: [{ takeNumber, videoUrl }]
//   }
//
// PROPS:
//   onStartVariation(wizardData) — dispara nova geração com mesmas decisões
//                                   (PovStudio troca pra modo 'output')
//   onEditConfig(wizardData)     — volta pro wizard pré-preenchido
//                                   (PovStudio troca pra modo 'wizard')
//   onClose()                    — volta pro modo padrão (wizard limpo)

import { useState, useEffect, useMemo } from 'react';
import { POV_TYPES } from './data/pov-types';
import { POV_SCENARIOS } from './data/pov-scenarios';
import { POV_STYLES } from './data/pov-styles';
import { POV_DURATIONS } from './data/pov-durations';
import { getVoiceById } from './data/pov-elevenlabs-voices'; // 🆕 v1.1 (Opção C — resolver name a partir de id)

const POV_GALLERY_KEY = 'marcos-studio-pov-gallery';

export default function PovGallery({ onStartVariation, onEditConfig, onClose }) {
  // ── Lista de POVs ─────────────────────────────────────────────────────
  const [items, setItems] = useState([]);

  // ── Filtros ───────────────────────────────────────────────────────────
  const [filterInfluencer, setFilterInfluencer] = useState('all');
  const [filterDuration, setFilterDuration] = useState('all');
  const [filterAudio, setFilterAudio] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  // ── Modal de POV aberto ───────────────────────────────────────────────
  const [openedItem, setOpenedItem] = useState(null);

  // ── Carrega galeria do localStorage ───────────────────────────────────
  useEffect(() => {
    loadGallery();
  }, []);

  function loadGallery() {
    try {
      const raw = localStorage.getItem(POV_GALLERY_KEY);
      const list = raw ? JSON.parse(raw) : [];
      setItems(list);
    } catch (err) {
      console.error('[PovGallery] erro carregando galeria:', err);
      setItems([]);
    }
  }

  function deleteItem(id) {
    if (!confirm('Tem certeza? POV apagado não pode ser recuperado.')) return;
    try {
      const filtered = items.filter((it) => it.id !== id);
      localStorage.setItem(POV_GALLERY_KEY, JSON.stringify(filtered));
      setItems(filtered);
      if (openedItem?.id === id) setOpenedItem(null);
    } catch (err) {
      console.error('[PovGallery] erro deletando:', err);
      alert('Erro ao deletar do localStorage');
    }
  }

  // ── Influencers únicos pra filtro ─────────────────────────────────────
  const uniqueInfluencers = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const id = it.wizardData?.influencerId;
      const name = it.wizardData?.influencerName;
      if (id && name && !map.has(id)) map.set(id, name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [items]);

  // ── Aplica filtros + sort ─────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (filterInfluencer !== 'all') {
      result = result.filter((it) => it.wizardData?.influencerId === filterInfluencer);
    }
    if (filterDuration !== 'all') {
      result = result.filter((it) => it.wizardData?.durationId === filterDuration);
    }
    if (filterAudio !== 'all') {
      result = result.filter((it) => it.wizardData?.audioMode === filterAudio);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [items, filterInfluencer, filterDuration, filterAudio, sortOrder]);

  const hasFilters = filterInfluencer !== 'all' || filterDuration !== 'all' || filterAudio !== 'all';

  function clearFilters() {
    setFilterInfluencer('all');
    setFilterDuration('all');
    setFilterAudio('all');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════

  if (items.length === 0) {
    return renderEmpty();
  }

  return (
    <div>
      {/* Header + filtros */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header-row">
          <div className="card-title">🖼 Galeria de POVs ({items.length})</div>
          <button className="secondary-btn" onClick={onClose} style={{ padding: '5px 14px', fontSize: 12 }}>
            ✨ Novo POV
          </button>
        </div>

        <p className="hint" style={{ marginBottom: 14 }}>
          POVs gerados ficam aqui pra você reusar, variar ou editar. Limite: 50 itens (mais antigo é removido).
        </p>

        {/* Filtros */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 8,
          marginBottom: 8,
        }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>👤 Influencer</label>
            <select
              value={filterInfluencer}
              onChange={(e) => setFilterInfluencer(e.target.value)}
              style={{ fontSize: 12, padding: '6px 8px' }}
            >
              <option value="all">Todos ({uniqueInfluencers.length})</option>
              {uniqueInfluencers.map((inf) => (
                <option key={inf.id} value={inf.id}>{inf.name}</option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>⏱ Duração</label>
            <select
              value={filterDuration}
              onChange={(e) => setFilterDuration(e.target.value)}
              style={{ fontSize: 12, padding: '6px 8px' }}
            >
              <option value="all">Todas</option>
              {POV_DURATIONS.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>🎙️ Áudio</label>
            <select
              value={filterAudio}
              onChange={(e) => setFilterAudio(e.target.value)}
              style={{ fontSize: 12, padding: '6px 8px' }}
            >
              <option value="all">Todos</option>
              <option value="silent">🔇 Sem voz</option>
              <option value="voiced">🎙️ Com voz</option>
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>📅 Ordem</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{ fontSize: 12, padding: '6px 8px' }}
            >
              <option value="newest">Mais recente</option>
              <option value="oldest">Mais antigo</option>
            </select>
          </div>
        </div>

        {hasFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--t2)' }}>
              {filteredItems.length} resultado(s)
            </span>
            <button
              onClick={clearFilters}
              style={{
                background: 'transparent',
                border: '1px solid var(--bd)',
                color: 'var(--t2)',
                padding: '3px 10px',
                borderRadius: 12,
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ✕ Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* Grid de cards */}
      {filteredItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>
          <p style={{ color: 'var(--t2)', fontSize: 13 }}>
            Nenhum POV bate com esses filtros. <a onClick={clearFilters} style={{ color: 'var(--bl)', cursor: 'pointer' }}>Limpar filtros</a>.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {filteredItems.map((item) => (
            <PovCard
              key={item.id}
              item={item}
              onOpen={() => setOpenedItem(item)}
              onVariation={() => handleVariation(item)}
              onEdit={() => handleEdit(item)}
              onDelete={() => deleteItem(item.id)}
            />
          ))}
        </div>
      )}

      {/* Modal de POV aberto */}
      {openedItem && (
        <PovDetailModal
          item={openedItem}
          onClose={() => setOpenedItem(null)}
          onVariation={() => { handleVariation(openedItem); setOpenedItem(null); }}
          onEdit={() => { handleEdit(openedItem); setOpenedItem(null); }}
          onDelete={() => deleteItem(openedItem.id)}
        />
      )}
    </div>
  );

  // ── Empty state ──────────────────────────────────────────────────────
  function renderEmpty() {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🖼</div>
        <h3 style={{ color: 'var(--g)', fontSize: 17, marginBottom: 10, fontWeight: 700 }}>
          Galeria vazia
        </h3>
        <p style={{ color: 'var(--t2)', fontSize: 13, lineHeight: 1.6, maxWidth: 360, margin: '0 auto 20px' }}>
          Nenhum POV gerado ainda. Crie seu primeiro vídeo POV e ele aparecerá aqui pra você reusar, variar e editar.
        </p>
        <button
          className="main-btn"
          onClick={onClose}
          style={{ maxWidth: 220, margin: '0 auto', display: 'block' }}
        >
          ✨ Criar primeiro POV
        </button>
      </div>
    );
  }

  // ── Handlers ──────────────────────────────────────────────────────────
  function handleVariation(item) {
    if (!item.wizardData) return;
    // Checa se temos a URL do produto (preciso pra pular re-upload)
    const productUrl = item.wizardData.productPhotoUrl;
    if (!productUrl) {
      const ok = confirm(
        'Este POV foi gerado antes do salvamento de URL. Pra variar, você precisa voltar no wizard e re-fazer upload da foto do produto. Continuar?'
      );
      if (ok) onEditConfig(item.wizardData);
      return;
    }
    // Tem URL → variação direta
    onStartVariation(item.wizardData);
  }

  function handleEdit(item) {
    if (!item.wizardData) return;
    onEditConfig(item.wizardData);
  }
}

// ════════════════════════════════════════════════════════════════════════
// PovCard — card individual de cada POV
// ════════════════════════════════════════════════════════════════════════

function PovCard({ item, onOpen, onVariation, onEdit, onDelete }) {
  const w = item.wizardData || {};
  const type = POV_TYPES.find((t) => t.id === w.typeId);
  const scenario = POV_SCENARIOS.find((s) => s.id === w.scenarioId);
  const style = POV_STYLES.find((s) => s.id === w.styleId);
  const duration = POV_DURATIONS.find((d) => d.id === w.durationId);

  return (
    <div style={{
      background: 'var(--cd)',
      border: '1px solid var(--bd)',
      borderRadius: 'var(--rs)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Video preview (4:5 aspect ratio) */}
      <div
        onClick={onOpen}
        style={{
          position: 'relative',
          aspectRatio: '9 / 16',
          background: '#000',
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        <video
          src={item.finalVideoUrl}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'rgba(0,0,0,0.7)',
          color: 'var(--g)',
          padding: '3px 8px',
          borderRadius: 10,
          fontSize: 11,
          fontWeight: 600,
        }}>
          {w.audioMode === 'voiced' ? '🎙️' : '🔇'} {duration?.label || '—'}
        </div>
      </div>

      {/* Metadados + ações */}
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--g)', marginBottom: 4 }}>
          {w.influencerName || 'Sem nome'}{' '}
          <span style={{ color: 'var(--t3)', fontWeight: 400, fontSize: 11 }}>
            · {formatRelativeDate(item.createdAt)}
          </span>
        </div>

        <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4, lineHeight: 1.4 }}>
          {type?.emoji} {type?.name || '—'}
          {scenario && <span> · {scenario.emoji} {scenario.name}</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 10, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {w.productName || 'Sem produto'}
        </div>

        {/* Ações */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          <ActionButton emoji="🎬" label="Abrir" title="Ver vídeo + pacote" onClick={onOpen} />
          <ActionButton emoji="🔁" label="Variar" title="Gerar variação (mesma config)" onClick={onVariation} />
          <ActionButton emoji="✏️" label="Editar" title="Editar config no wizard" onClick={onEdit} />
          <ActionButton emoji="🗑" label="" title="Deletar" onClick={onDelete} danger />
        </div>
      </div>
    </div>
  );
}

function ActionButton({ emoji, label, title, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: danger ? 'rgba(255,107,107,0.08)' : 'var(--sf)',
        border: danger ? '1px solid rgba(255,107,107,0.2)' : '1px solid var(--bd)',
        color: danger ? '#ff6b6b' : 'var(--t)',
        padding: '6px 4px',
        borderRadius: 'var(--rs)',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'inherit',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {emoji}{label && ` ${label}`}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PovDetailModal — modal expandido com vídeo + pacote postagem
// ════════════════════════════════════════════════════════════════════════

function PovDetailModal({ item, onClose, onVariation, onEdit, onDelete }) {
  const w = item.wizardData || {};
  const pkg = item.packageData || {};
  const type = POV_TYPES.find((t) => t.id === w.typeId);
  const scenario = POV_SCENARIOS.find((s) => s.id === w.scenarioId);
  const style = POV_STYLES.find((s) => s.id === w.styleId);
  const duration = POV_DURATIONS.find((d) => d.id === w.durationId);

  // Fechar ao clicar fora ou Esc
  useEffect(() => {
    function onEsc(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 999,
        overflowY: 'auto',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 600,
          margin: '0 auto',
          background: 'var(--cd)',
          border: '1px solid var(--bd)',
          borderRadius: 'var(--rs)',
          overflow: 'hidden',
        }}
      >
        {/* Header com close */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid var(--bd)',
          background: 'var(--sf)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--g)' }}>
            🎬 {w.influencerName} · {formatRelativeDate(item.createdAt)}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--t2)',
              fontSize: 22,
              cursor: 'pointer',
              padding: '0 8px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Video */}
        <video
          src={item.finalVideoUrl}
          controls
          autoPlay
          muted
          loop
          playsInline
          style={{ width: '100%', display: 'block', background: '#000', maxHeight: 500 }}
        />

        {/* Ações */}
        <div style={{ padding: 14, borderBottom: '1px solid var(--bd)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
            <a
              href={item.finalVideoUrl}
              download={`pov-${w.influencerName?.toLowerCase() || 'video'}-${Date.now()}.mp4`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'var(--gd)',
                border: '1px solid var(--gb)',
                color: 'var(--g)',
                padding: '8px 10px',
                borderRadius: 'var(--rs)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              📥 MP4
            </a>
            <button
              onClick={onVariation}
              style={{
                background: 'rgba(139,184,232,0.1)',
                border: '1px solid rgba(139,184,232,0.25)',
                color: 'var(--bl)',
                padding: '8px 10px',
                borderRadius: 'var(--rs)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              🔁 Variar
            </button>
            <button
              onClick={onEdit}
              style={{
                background: 'var(--sf)',
                border: '1px solid var(--bd)',
                color: 'var(--t)',
                padding: '8px 10px',
                borderRadius: 'var(--rs)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ✏️ Editar
            </button>
            <button
              onClick={onDelete}
              style={{
                background: 'rgba(255,107,107,0.08)',
                border: '1px solid rgba(255,107,107,0.2)',
                color: '#ff6b6b',
                padding: '8px 10px',
                borderRadius: 'var(--rs)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              🗑 Deletar
            </button>
          </div>
        </div>

        {/* Configuração resumida */}
        <div style={{ padding: 14, borderBottom: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 11, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>
            ⚙️ Configuração
          </div>
          <div style={{ fontSize: 12, color: 'var(--t)', lineHeight: 1.7 }}>
            <div><strong>Produto:</strong> {w.productName}</div>
            <div><strong>Tipo:</strong> {type?.emoji} {type?.name}</div>
            <div><strong>Cenário:</strong> {scenario?.emoji} {scenario?.name}</div>
            <div><strong>Estilo:</strong> {style?.name}</div>
            <div><strong>Duração:</strong> {duration?.label} ({duration?.composition})</div>
            <div><strong>Áudio:</strong> {w.audioMode === 'voiced' ? `🎙️ Com voz (${getVoiceById(w.voiceId)?.name || w.voiceId})` : '🔇 Sem voz'}</div>
          </div>
        </div>

        {/* Pacote postagem */}
        {pkg.description && (
          <CopyableInModal title="📝 Descrição" text={pkg.description} />
        )}
        {pkg.hashtags && pkg.hashtags.length > 0 && (
          <CopyableInModal
            title="#️⃣ Hashtags"
            text={pkg.hashtags.map((h) => h.startsWith('#') ? h : `#${h}`).join(' ')}
          />
        )}
        {pkg.ctaWritten && (
          <CopyableInModal title="📣 CTA" text={pkg.ctaWritten} />
        )}
        {pkg.musicSuggestion && (
          <div style={{ padding: 14, borderBottom: '1px solid var(--bd)' }}>
            <div style={{ fontSize: 11, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>
              🎵 Música sugerida
            </div>
            {pkg.musicSuggestion.viral && (
              <div style={{ fontSize: 12, color: 'var(--t)' }}>
                <strong>{pkg.musicSuggestion.viral.title}</strong>
                {pkg.musicSuggestion.viral.artist && ` · ${pkg.musicSuggestion.viral.artist}`}
              </div>
            )}
            {pkg.musicSuggestion.comercial && (
              <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4 }}>
                {pkg.musicSuggestion.comercial.mood} · {pkg.musicSuggestion.comercial.bpm} BPM
              </div>
            )}
          </div>
        )}

        {/* Takes individuais */}
        {Array.isArray(item.takesData) && item.takesData.length > 0 && (
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>
              🎞 Takes individuais
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {item.takesData.map((t) => (
                <a
                  key={t.takeNumber}
                  href={t.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'var(--blb)',
                    border: '1px solid rgba(139,184,232,0.25)',
                    color: 'var(--bl)',
                    padding: '4px 10px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Take {t.takeNumber} →
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CopyableInModal({ title, text }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div style={{ padding: 14, borderBottom: '1px solid var(--bd)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          {title}
        </div>
        <button
          onClick={handleCopy}
          style={{
            background: 'transparent',
            border: '1px solid var(--bd)',
            color: copied ? 'var(--gr)' : 'var(--t2)',
            padding: '3px 10px',
            borderRadius: 12,
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {copied ? '✓ Copiado' : '📋 Copiar'}
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--t)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {text}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Helper: formata data relativa em PT-BR
// ════════════════════════════════════════════════════════════════════════

function formatRelativeDate(isoString) {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    if (diffHr < 24) return `${diffHr}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return '—';
  }
}
