import { useState, useEffect } from 'react';
import { getSystemPrompt, VIDEO_NUMBERS_RULES } from './systemPrompt';
import { callClaude, generateContent, searchTrends, generateImage, generateBackPrompt, generateVideo, checkVideoStatus, uploadToFal, fileToBase64, getProfiles } from './api';
import ProfileManager from './ProfileManager';
import './styles.css';

const VIDEO_TYPES = [
  { id: 'sem_voz', label: 'Sem voz — silencioso 15s', icon: '🔇' },
  { id: 'com_voz', label: 'Com voz — fala pra câmera', icon: '🗣' },
  { id: 'viral_sem', label: 'Viral sem voz — replicar', icon: '🔥' },
  { id: 'viral_com', label: 'Viral com voz', icon: '🔥🗣' },
  { id: 'transicao', label: 'Transição de cores', icon: '🎨' },
];

const VIDEO_ENGINES = [
  { id: 'kling', label: 'Kling 3.0', desc: 'Scenes/Elements, multi-shot', price: '~$0.84/15s' },
  { id: 'veo3', label: 'Veo 3', desc: 'Clipes separados, lip sync', price: '~$3.00/15s' },
  { id: 'grok', label: 'Grok Imagine', desc: 'Mais rápido, áudio nativo', price: '~$0.75/15s' },
];

const MOMENTOS = ["Trabalho / Home Office","Encontro Romântico","Festa / Balada","Casual Dia a Dia","Rolê com Amigas","Brunch / Almoço","Academia / Fitness","Viagem","Evento Especial","Em Casa / Lazy Day","Happy Hour","Igreja / Domingo","Final de Semana"];
const ESTACOES = ["Verão","Meia-Estação","Inverno"];
const ESTETICAS = ["Clean Girl","Office Siren","Soft Feminine","Street Casual","Glamour Night","Cozy Chic","Sporty Effortless"];

// Reusable components
function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return <button className="copy-btn" data-copied={ok} onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}>{ok ? '✓ Copiado' : '⎘ Copiar'}</button>;
}

function CodeBlock({ label, content, onRegen }) {
  if (!content) return null;
  return (
    <div className="code-block">
      <div className="code-header"><span className="code-label">{label}</span>
        <div style={{display:'flex',gap:6}}>{onRegen && <button className="regen-btn" onClick={onRegen}>🔄</button>}<CopyBtn text={content}/></div>
      </div>
      <pre className="code-content">{content}</pre>
    </div>
  );
}

function OptionSelector({ label, options, selected, onSelect }) {
  return (
    <div className="option-group">
      <span className="option-label">{label}</span>
      <div className="option-cards">
        {options.map((opt, i) => (
          <div key={i} className={`option-card ${selected === i ? 'active' : ''}`} onClick={() => onSelect(i)}>
            <div className="option-text">{opt.texto || opt.text || opt.set || opt}</div>
            {opt.categoria && <span className="option-meta">{opt.categoria} · {opt.formato}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Accordion({ title, icon, children, open: def = false }) {
  const [open, setOpen] = useState(def);
  return (
    <div className="accordion">
      <button className="accordion-header" onClick={() => setOpen(!open)}>
        <span>{icon}</span><span className="accordion-title">{title}</span><span className={`arrow ${open?'open':''}`}>▾</span>
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('form'); // form | loading | results | content
  // Na v2.2 não há mais Lígia hardcoded: o estado inicial é null até o usuário cadastrar/selecionar
  const [influencer, setInfluencer] = useState(() => getProfiles()[0] || null);
  // Se não há perfil, força abertura do ProfileManager no primeiro render
  const [showProfiles, setShowProfiles] = useState(() => getProfiles().length === 0);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(null); // null | 'frontal' | 'costas' | 'video'
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState(null);

  // Form state
  const [form, setForm] = useState({
    nome:'', preco:'', descricao:'', tipoVideo:'', engine:'kling',
    momento:'', estacao:'', estetica:'', auto:true,
    promptViral:'', transcricaoViral:'',
    fotoProduto: null, fotoProdutoUrl: null,
    fotoCostas: null, fotoCostasUrl: null,
  });
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  // Results
  const [prompts, setPrompts] = useState(null); // From Claude (visual prompts)
  const [content, setContent] = useState(null); // From Claude (TikTok content - 3 options)
  const [selections, setSelections] = useState({ gancho:0, detalhe:0, precoCTA:0, descricao:0, hashtags:0 });
  const [generatedImages, setGeneratedImages] = useState({ frontal:null, costas:null });
  const [generatedVideos, setGeneratedVideos] = useState({}); // { 0: url, 1: url }
  const [backPromptReady, setBackPromptReady] = useState(false); // true after back prompt regenerated from frontal image

  // Video tracking
  const [videoNum, setVideoNum] = useState(1);
  const [history, setHistory] = useState([]);

  // ── Handle file uploads ──
  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { base64, mimeType, preview } = await fileToBase64(file);
    set(field, { base64, mimeType, preview, name: file.name });
  };

  // ── Step 1: Generate Visual Prompts ──
  const generatePrompts = async () => {
    // v2.2: exige perfil antes de qualquer coisa
    if (!influencer || !influencer.name) {
      setShowProfiles(true);
      setError('Cadastre e selecione uma influencer antes de gerar vídeos.');
      return;
    }

    setPage('loading'); setError(null);
    setLoadingMsg('Gerando prompts visuais...');

    try {
      const system = getSystemPrompt(influencer);
      const prevCtx = history.length > 0
        ? `\nVÍDEOS ANTERIORES — OBRIGATÓRIO NÃO REPETIR NADA:\n${history.map((h,i)=>`V${i+1}: Momento=${h.momento||'?'}, Estética=${h.estetica||'?'}, Cenário=${h.cenario||'?'}, POV=${h.pov}, Hook=${h.hook}`).join('\n')}\n${VIDEO_NUMBERS_RULES[videoNum]}\n\nREGRA CRÍTICA: Escolha combinação de 3 CAMADAS (momento + estação + estética) COMPLETAMENTE DIFERENTE dos vídeos anteriores. Use momento DIFERENTE, estética DIFERENTE, cenário DIFERENTE, POV DIFERENTE e hook DIFERENTE.`
        : '';

      const viralCtx = form.tipoVideo.includes('viral')
        ? `\nPROMPT VIRAL:\n${form.promptViral}\nTRANSCRIÇÃO:\n${form.transcricaoViral||'N/A'}`
        : '';

      const msg = `PRODUTO — VÍDEO ${videoNum}/3:
Nome: ${form.nome}
Preço: R$${form.preco}
Descrição: ${form.descricao||'Não fornecida'}
Tipo: ${form.tipoVideo}
IA para vídeo: ${form.engine}
${form.auto ? `Sugira as 3 camadas (momento + estação + estética) automaticamente.${videoNum > 1 ? ' OBRIGATÓRIO: escolha camadas COMPLETAMENTE DIFERENTES dos vídeos anteriores listados acima.' : ''}` : `Momento: ${form.momento}\nEstação: ${form.estacao}\nEstética: ${form.estetica}`}
${prevCtx}${viralCtx}

Gere prompts visuais (imagem + vídeo). APENAS JSON.`;

      const result = await callClaude(system, msg);
      setPrompts(result);

      // Now generate content in parallel
      setLoadingMsg('Buscando tendências TikTok...');
      let trendData = '';
      try {
        trendData = await searchTrends('moda feminina', form.nome);
      } catch(e) { console.warn('Trend search failed:', e); }

      setLoadingMsg('Gerando textos criativos (3 opções)...');
      const contentResult = await generateContent({
        produto: form.nome,
        preco: form.preco,
        diferenciais: result.diferenciais,
        momento: result.camadas?.momento,
        estetica: result.camadas?.estetica,
        trendData,
        videoNum,
        previousContent: history,
      });
      setContent(contentResult);
      setPage('results');
    } catch(err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Generate Image via fal.ai ──
  const handleGenerateImage = async (type) => {
    setLoadingStep(type); setError(null);
    setLoadingMsg(`Gerando imagem ${type}...`);
    try {
      // v2.2: sempre exige perfil com foto antes de gerar
      if (!influencer || !influencer.photo) {
        throw new Error('Selecione uma influencer com foto de referência antes de gerar imagens.');
      }

      const prompt = type === 'frontal' ? prompts.promptImagemFrontal?.positivo : prompts.promptImagemCostas?.positivo;
      if (!prompt) throw new Error('Prompt não encontrado');

      // Upload reference images to fal.ai
      const urls = [];

      if (type === 'frontal') {
        // FRONTAL: foto da influencer (obrigatória v2.2) + produto frontal
        const b64 = influencer.photo.split(',')[1];
        const url = await uploadToFal(b64, 'image/png', 'influencer.png');
        urls.push(url);
        if (form.fotoProduto) {
          const urlP = await uploadToFal(form.fotoProduto.base64, form.fotoProduto.mimeType, 'produto.png');
          urls.push(urlP);
        }
      } else {
        // COSTAS: imagem frontal gerada (identidade travada) + produto costas
        if (generatedImages.frontal) {
          urls.push(generatedImages.frontal); // já é URL, sem upload
        }
        if (form.fotoCostas) {
          const url = await uploadToFal(form.fotoCostas.base64, form.fotoCostas.mimeType, 'costas.png');
          urls.push(url);
        }
      }

      // v2.2: passa nome e descrição corporal pro backend aplicar os 3 fixes
      const imageUrl = await generateImage(
        prompt,
        urls.length > 0 ? urls : undefined,
        { profileName: influencer.name, bodyDescription: influencer.bodyDescription }
      );
      setGeneratedImages(prev => ({ ...prev, [type]: imageUrl }));
    } catch(err) {
      console.error('Image generation error:', err);
      setError(err.message);
    } finally {
      setLoadingStep(null);
    }
  };

  // ── Step 2b: Generate Back Prompt from frontal image via Claude ──
  const handleGenerateBackPrompt = async () => {
    setLoadingStep('backprompt'); setError(null);
    setLoadingMsg('Claude analisando imagem frontal para criar prompt de costas...');
    try {
      if (!generatedImages.frontal) throw new Error('Gere a imagem frontal primeiro');

      const backPrompt = await generateBackPrompt({
        frontalImageUrl: generatedImages.frontal,
        frontalPrompt: prompts.promptImagemFrontal?.positivo,
        visual: prompts.visual,
        camadas: prompts.camadas,
      });

      // Update prompts with new back prompt
      setPrompts(prev => ({
        ...prev,
        promptImagemCostas: backPrompt
      }));
      setBackPromptReady(true);
    } catch(err) {
      console.error('Back prompt generation error:', err);
      setError(err.message);
    } finally {
      setLoadingStep(null);
    }
  };

  // ── Step 3: Generate Video via fal.ai ──
  const handleGenerateVideo = async (clipIndex = 0) => {
    setLoading(true); setLoadingStep(`video-${clipIndex}`); setError(null);
    const videoPrompts = prompts.promptsVideo || [prompts.promptVideo];
    const totalClips = videoPrompts.length;
    setLoadingMsg(`Gerando vídeo clipe ${clipIndex + 1}/${totalClips}...`);
    try {
      const clip = videoPrompts[clipIndex] || videoPrompts[0];

      const params = {
        engine: form.engine,
        prompt: clip.prompt,
        image_url: generatedImages.frontal,
        negative_prompt: clip.negativo || '',
        duration: clip.duracao?.replace('s','') || '5',
        aspect_ratio: '9:16',
        generate_audio: form.tipoVideo.toLowerCase().includes('com voz'),
      };
      if (form.engine.startsWith('kling') && generatedImages.costas) {
        params.element_image_url = generatedImages.costas;
      }

      const result = await generateVideo(params);

      if (result.video) {
        setGeneratedVideos(prev => ({ ...prev, [clipIndex]: result.video.url }));
      } else if (result.requestId) {
        setLoadingMsg(`Clipe ${clipIndex + 1}/${totalClips} em processamento...`);
        let done = false;
        let attempts = 0;
        const maxAttempts = 120;
        while (!done && attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 5000));
          attempts++;
          const status = await checkVideoStatus(result.requestId, result.endpoint, result.statusUrl, result.responseUrl);
          if (status.status === 'COMPLETED') {
            setGeneratedVideos(prev => ({ ...prev, [clipIndex]: status.result?.video?.url }));
            done = true;
          } else if (status.status === 'FAILED') {
            throw new Error(`Geração do clipe ${clipIndex + 1} falhou`);
          } else {
            setLoadingMsg(`Clipe ${clipIndex + 1}: ${status.status || 'processando'}... (${attempts * 5}s)`);
          }
        }
        if (!done) throw new Error('Timeout: vídeo não completou em 10 minutos.');
      }
    } catch(err) {
      console.error('Video generation error:', err);
      setError(err.message);
    } finally {
      setLoading(false); setLoadingStep(null);
    }
  };

  // ── Next video ──
  const nextVideo = () => {
    const sel = selections;
    setHistory(prev => [...prev, {
      pov: content?.ganchos?.[sel.gancho]?.categoria,
      hook: content?.ganchos?.[sel.gancho]?.formato,
      gancho: content?.ganchos?.[sel.gancho]?.texto,
      detalhe: content?.detalhes?.[sel.detalhe]?.texto,
      // Save camadas + visual so Claude knows what was used before
      momento: prompts?.camadas?.momento,
      estacao: prompts?.camadas?.estacao,
      estetica: prompts?.camadas?.estetica,
      cenario: prompts?.visual?.cenario,
      cabelo: prompts?.visual?.cabelo,
    }]);
    setVideoNum(prev => prev + 1);
    setPrompts(null); setContent(null);
    setGeneratedImages({ frontal:null, costas:null });
    setGeneratedVideos({}); setLoadingStep(null); setBackPromptReady(false);
    setSelections({ gancho:0, detalhe:0, precoCTA:0, descricao:0, hashtags:0 });
    setPage('form');
  };

  const newProduct = () => {
    setForm({ nome:'', preco:'', descricao:'', tipoVideo:'', engine:'kling', momento:'', estacao:'', estetica:'', auto:true, promptViral:'', transcricaoViral:'', fotoProduto:null, fotoProdutoUrl:null, fotoCostas:null, fotoCostasUrl:null });
    setPrompts(null); setContent(null); setHistory([]); setVideoNum(1);
    setGeneratedImages({ frontal:null, costas:null }); setGeneratedVideos({}); setLoadingStep(null); setBackPromptReady(false);
    setSelections({ gancho:0, detalhe:0, precoCTA:0, descricao:0, hashtags:0 });
    setPage('form');
  };

  // ══════════ FORM PAGE ══════════
  if (page === 'form') return (
    <div className="app">
      <div className="container">
        {showProfiles && (
          <ProfileManager
            onClose={() => setShowProfiles(false)}
            onSelect={p => { setInfluencer(p); setShowProfiles(false); }}
            forceCreate={!influencer}
          />
        )}

        <header className="header">
          <div className="badge">⚡ v8.2 + Automação</div>
          <h1 className="title">UGC Studio</h1>
          <p className="subtitle">TikTok Shop · Imagem · Vídeo · Conteúdo</p>
        </header>

        {/* Influencer Selector */}
        <div className="card influencer-selector" onClick={() => setShowProfiles(true)}>
          <div className="inf-row">
            <div className="inf-avatar">
              {influencer?.photo
                ? <img src={influencer.photo} alt=""/>
                : <span>{influencer?.name?.[0] || '+'}</span>}
            </div>
            <div className="inf-info">
              <div className="inf-name">{influencer?.name || 'Cadastrar influencer'}</div>
              <div className="inf-hint">{influencer ? 'Toque para trocar influencer' : 'Cadastre a primeira influencer para começar'}</div>
            </div>
            <span className="inf-arrow">▸</span>
          </div>
        </div>

        {/* Product */}
        <div className="card">
          <h3 className="card-title">📦 Produto</h3>
          <div className="grid-2">
            <div className="field"><label>Nome</label><input value={form.nome} onChange={e=>set('nome',e.target.value)} placeholder="Ex: Legging Suplex Premium"/></div>
            <div className="field"><label>Preço (R$)</label><input value={form.preco} onChange={e=>set('preco',e.target.value)} placeholder="79.90"/></div>
          </div>
          <div className="field"><label>Descrição / diferenciais <span className="opt">(opcional)</span></label>
            <textarea value={form.descricao} onChange={e=>set('descricao',e.target.value)} placeholder="Tecido suplex premium, cintura alta, não marca..." rows={3}/>
          </div>
          <div className="grid-2">
            <div className="field"><label>📸 Foto do produto (frontal)</label>
              <div className="upload-area" onClick={()=>document.getElementById('f-produto').click()}>
                {form.fotoProduto ? <img src={form.fotoProduto.preview} alt=""/> : <span>+ Upload</span>}
                <input id="f-produto" type="file" accept="image/*" hidden onChange={e=>handleFileUpload(e,'fotoProduto')}/>
              </div>
            </div>
            <div className="field"><label>📸 Costas do produto <span className="opt">(opcional)</span></label>
              <div className="upload-area" onClick={()=>document.getElementById('f-costas').click()}>
                {form.fotoCostas ? <img src={form.fotoCostas.preview} alt=""/> : <span>+ Upload</span>}
                <input id="f-costas" type="file" accept="image/*" hidden onChange={e=>handleFileUpload(e,'fotoCostas')}/>
              </div>
            </div>
          </div>
        </div>

        {/* Video Type */}
        <div className="card">
          <h3 className="card-title">🎬 Tipo de Vídeo</h3>
          <div className="radio-group">
            {VIDEO_TYPES.map(t => (
              <button key={t.id} className={`radio-btn ${form.tipoVideo===t.label?'active':''}`} onClick={()=>set('tipoVideo',t.label)}>
                <span className="ri">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Viral fields */}
        {form.tipoVideo.toLowerCase().includes('viral') && (
          <div className="card">
            <h3 className="card-title">🔥 Referência Viral</h3>
            <div className="field"><label>Prompt extraído</label><textarea value={form.promptViral} onChange={e=>set('promptViral',e.target.value)} placeholder="Cole o prompt do PromptAI Videos..." rows={4}/></div>
            <div className="field"><label>Transcrição <span className="opt">(se houver)</span></label><textarea value={form.transcricaoViral} onChange={e=>set('transcricaoViral',e.target.value)} rows={3}/></div>
          </div>
        )}

        {/* Video Engine */}
        <div className="card">
          <h3 className="card-title">🤖 IA para Vídeo</h3>
          <div className="engine-group">
            {VIDEO_ENGINES.map(e => (
              <button key={e.id} className={`engine-btn ${form.engine===e.id?'active':''}`} onClick={()=>set('engine',e.id)}>
                <div className="engine-name">{e.label}</div>
                <div className="engine-desc">{e.desc}</div>
                <div className="engine-price">{e.price}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 3 Layers */}
        <div className="card">
          <div className="card-header-row"><h3 className="card-title">🎯 3 Camadas</h3>
            <button className={`toggle ${form.auto?'active':''}`} onClick={()=>set('auto',!form.auto)}>{form.auto?'✓ Auto':'Manual'}</button>
          </div>
          {form.auto ? <p className="hint">Claude sugere automaticamente.</p> : (
            <div className="grid-3">
              <div className="field"><label>Momento</label><select value={form.momento} onChange={e=>set('momento',e.target.value)}><option value="">...</option>{MOMENTOS.map(m=><option key={m}>{m}</option>)}</select></div>
              <div className="field"><label>Estação</label><select value={form.estacao} onChange={e=>set('estacao',e.target.value)}><option value="">...</option>{ESTACOES.map(e=><option key={e}>{e}</option>)}</select></div>
              <div className="field"><label>Estética</label><select value={form.estetica} onChange={e=>set('estetica',e.target.value)}><option value="">...</option>{ESTETICAS.map(e=><option key={e}>{e}</option>)}</select></div>
            </div>
          )}
        </div>

        <div className="video-counter"><span>Vídeo {videoNum}/3</span><div className="dots">{[1,2,3].map(n=><span key={n} className={`dot ${n<=videoNum?'filled':''}`}/>)}</div></div>
        <button className="main-btn" disabled={!form.nome||!form.preco||!form.tipoVideo} onClick={generatePrompts}>⚡ Gerar Tudo</button>
      </div>
    </div>
  );

  // ══════════ LOADING PAGE ══════════
  if (page === 'loading') return (
    <div className="app loading-screen">
      <div className="spinner"/><p className="loading-title">{loadingMsg || 'Processando...'}</p>
      <p className="loading-sub">Vídeo {videoNum}/3 · {form.nome}</p>
      {error && <div className="error-box"><p>{error}</p><button className="retry-btn" onClick={()=>{setError(null);generatePrompts();}}>Tentar novamente</button></div>}
    </div>
  );

  // ══════════ RESULTS PAGE ══════════
  if (page === 'results' && prompts) {
    const r = prompts;
    const c = content;
    const sel = selections;

    // Build copy-paste block
    const selectedDesc = c?.descricoes?.[sel.descricao]?.texto || '';
    const selectedHash = c?.hashtags?.[sel.hashtags]?.set || '';
    const copyBlock = `${selectedDesc}\n\n${selectedHash}`;

    return (
      <div className="app">
        <div className="container">
          {showProfiles && <ProfileManager onClose={()=>setShowProfiles(false)} onSelect={p=>{setInfluencer(p);setShowProfiles(false);}}/>}

          <div className="results-header">
            <div>
              <div className="results-badge">Vídeo {videoNum}/3 · {influencer?.name}</div>
              <h1 className="results-title">{form.nome}</h1>
              <p className="results-sub">R${form.preco} · {form.engine.toUpperCase()}</p>
            </div>
            <button className="back-btn" onClick={newProduct}>← Novo</button>
          </div>

          {/* Error display */}
          {error && <div className="error-box" style={{margin:'16px 0'}}>
            <p>⚠️ {error}</p>
            <button className="retry-btn" onClick={()=>setError(null)}>✕ Fechar</button>
          </div>}

          {/* Camadas */}
          {r.camadas && <div className="pills-row">
            {Object.entries(r.camadas).filter(([k])=>k!=='justificativa').map(([k,v])=><span key={k} className="pill"><span className="pk">{k}:</span> {v}</span>)}
          </div>}

          {/* Diferenciais */}
          {r.diferenciais?.length > 0 && <div className="dif-box"><span className="dif-label">📋 Diferenciais</span>
            <div className="dif-tags">{r.diferenciais.map((d,i)=><span key={i} className="dif-tag">{d}</span>)}</div>
          </div>}

          {/* Visual */}
          {r.visual && <Accordion title="Look Completo" icon="👗">
            <div className="visual-grid">{Object.entries(r.visual).map(([k,v])=><div key={k} className="vi"><div className="vk">{k}</div><div className="vv">{v}</div></div>)}</div>
          </Accordion>}

          {/* Image Prompts + Generation */}
          <Accordion title="Imagens" icon="📸" open>
            <CodeBlock label="PROMPT FRONTAL" content={r.promptImagemFrontal?.positivo}/>
            <CodeBlock label="NEGATIVE" content={r.promptImagemFrontal?.negativo}/>
            <div className="gen-row">
              <button className="gen-btn" onClick={()=>handleGenerateImage('frontal')} disabled={loadingStep !== null}>
                {loadingStep === 'frontal' ? '⏳ Gerando imagem frontal...' : '🎨 Gerar Imagem Frontal (fal.ai)'}
              </button>
              {generatedImages.frontal && <div className="gen-preview"><img src={generatedImages.frontal} alt="frontal"/></div>}
            </div>

            {/* ── COSTAS: Step-by-step flow ── */}
            {generatedImages.frontal && <>
              <hr className="divider"/>

              {/* Step 2b: Generate back prompt from frontal image */}
              {!backPromptReady && (
                <div className="gen-row">
                  <button className="gen-btn" onClick={handleGenerateBackPrompt} disabled={loadingStep !== null} style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
                    {loadingStep === 'backprompt' ? '⏳ Claude analisando imagem frontal...' : '🤖 Gerar Prompt Costas (baseado na imagem frontal)'}
                  </button>
                  <p className="hint">O Claude vai analisar a imagem frontal gerada pra criar o prompt de costas com total consistência.</p>
                </div>
              )}

              {/* Step 2c: Show back prompt + generate back image */}
              {backPromptReady && <>
                <CodeBlock label="PROMPT COSTAS (baseado na imagem frontal)" content={r.promptImagemCostas?.positivo}/>
                {r.promptImagemCostas?.negativo && <CodeBlock label="NEGATIVE COSTAS" content={r.promptImagemCostas?.negativo}/>}
                <div className="gen-row">
                  <button className="gen-btn" onClick={()=>handleGenerateImage('costas')} disabled={loadingStep !== null}>
                    {loadingStep === 'costas' ? '⏳ Gerando imagem costas...' : '🎨 Gerar Imagem Costas (fal.ai)'}
                  </button>
                  {generatedImages.costas && <div className="gen-preview"><img src={generatedImages.costas} alt="costas"/></div>}
                </div>
              </>}
            </>}

            {!generatedImages.frontal && <>
              <hr className="divider"/>
              <p className="hint">Gere a imagem frontal primeiro para habilitar a etapa de costas.</p>
            </>}
          </Accordion>

          {/* Video Prompts + Generation */}
          <Accordion title={`Vídeo — ${form.engine.toUpperCase()}`} icon="🎬" open>
            {(r.promptsVideo || [r.promptVideo]).map((clip,i) => {
              const totalClips = (r.promptsVideo || [r.promptVideo]).length;
              const isMultiClip = totalClips > 1;
              return (
                <div key={i}>
                  <CodeBlock label={`CLIPE ${i+1}${clip.duracao ? ` — ${clip.duracao}` : ''}`} content={clip.prompt}/>
                  {clip.negativo && <CodeBlock label={`NEGATIVE CLIPE ${i+1}`} content={clip.negativo}/>}

                  {/* Per-clip generate button (Veo 3 multi-clip) */}
                  {isMultiClip && generatedImages.frontal && (
                    <div className="gen-row">
                      <button className="gen-btn video" onClick={()=>handleGenerateVideo(i)} disabled={loadingStep !== null}>
                        {loadingStep === `video-${i}` ? `⏳ Gerando clipe ${i+1}...` : `🎬 Gerar Clipe ${i+1} (${form.engine})`}
                      </button>
                      {generatedVideos[i] && <div className="gen-preview"><video src={generatedVideos[i]} controls style={{width:'100%',borderRadius:8}}/></div>}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Single generate button (Kling / Grok — 1 clip) */}
            {(r.promptsVideo || [r.promptVideo]).length <= 1 && generatedImages.frontal && (
              <div className="gen-row">
                <button className="gen-btn video" onClick={()=>handleGenerateVideo(0)} disabled={loadingStep !== null}>
                  {loadingStep === 'video-0' ? '⏳ Gerando vídeo...' : `🎬 Gerar Vídeo (${form.engine})`}
                </button>
                {generatedVideos[0] && <div className="gen-preview"><video src={generatedVideos[0]} controls style={{width:'100%',borderRadius:8}}/></div>}
              </div>
            )}

            {/* Hint: all clips generated */}
            {(r.promptsVideo || [r.promptVideo]).length > 1 && Object.keys(generatedVideos).length === (r.promptsVideo || [r.promptVideo]).length && (
              <div className="dif-box" style={{marginTop:12}}>
                <span className="dif-label">✅ Todos os clipes gerados</span>
                <p className="hint" style={{marginTop:6}}>Junte os {(r.promptsVideo || [r.promptVideo]).length} clipes no CapCut para montar o vídeo final de 15s.</p>
              </div>
            )}

            {!generatedImages.frontal && <p className="hint">Gere a imagem frontal primeiro para habilitar o vídeo.</p>}
          </Accordion>

          {/* TikTok Content with 3 options */}
          {c && <Accordion title="Conteúdo TikTok" icon="📱" open>
            {c.ganchos && <OptionSelector label="GANCHO (Texto 1 — 0s-5s)" options={c.ganchos} selected={sel.gancho} onSelect={i=>setSelections(p=>({...p,gancho:i}))}/>}
            {c.detalhes && <OptionSelector label="DETALHE (Texto 2 — 6s-11s)" options={c.detalhes} selected={sel.detalhe} onSelect={i=>setSelections(p=>({...p,detalhe:i}))}/>}
            {c.precoCTAs && <OptionSelector label="PREÇO+CTA (Texto 3 — 12s-15s)" options={c.precoCTAs} selected={sel.precoCTA} onSelect={i=>setSelections(p=>({...p,precoCTA:i}))}/>}
            <div className="texto-fixo">Comprei aqui 🔗</div>
            {c.descricoes && <OptionSelector label="DESCRIÇÃO" options={c.descricoes} selected={sel.descricao} onSelect={i=>setSelections(p=>({...p,descricao:i}))}/>}
            {c.hashtags && <OptionSelector label="HASHTAGS" options={c.hashtags} selected={sel.hashtags} onSelect={i=>setSelections(p=>({...p,hashtags:i}))}/>}
            <CodeBlock label="📋 PRONTO PARA COLAR" content={copyBlock}/>
            {c.musica && <div className="music-box"><span className="music-label">🎵 Música</span>
              <div className="music-grid">{Object.entries(c.musica).map(([k,v])=><div key={k} className="mi"><span className="mk">{k}:</span> {v}</div>)}</div>
            </div>}
          </Accordion>}

          {/* Actions */}
          <div className="actions-row">
            <button className="secondary-btn" onClick={newProduct}>Novo Produto</button>
            {videoNum < 3
              ? <button className="main-btn" onClick={nextVideo}>▶ Próximo Vídeo ({videoNum+1}/3)</button>
              : <button className="main-btn" onClick={generatePrompts}>🔄 Regenerar</button>}
          </div>

          <p className="footer">UGC Studio v2.2 · Claude + fal.ai · Kling · Veo3 · Grok</p>
        </div>
      </div>
    );
  }

  return null;
}
