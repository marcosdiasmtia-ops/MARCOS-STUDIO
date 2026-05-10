// api/pov-recommend.js (v1.0 — Claude Sonnet 4 sugere defaults do wizard POV)
//
// Endpoint que recebe (categoria TikTok Shop, produto, gênero da influencer) e
// retorna sugestões pra preencher os 4 campos do wizard POV:
//   - typeId      (de pov-types.js — 11 opções)
//   - scenarioId  (de pov-scenarios.js — 15 opções)
//   - styleId     (de pov-styles.js — 8 opções)
//   - handsId     (de pov-hands.js — só se modo for 'anonymous'; senão null)
//
// Claude analisa o produto (texto + foto opcional) e escolhe combinação que
// faz sentido visualmente. Se Claude falhar ou retornar IDs inválidos, cai
// num FALLBACK DETERMINÍSTICO baseado em CATEGORY_TO_TYPE_DEFAULT e
// TYPE_TO_SCENARIOS_IDEAL (espelhados de src/data/pov-mappings.js).
//
// Espelha o padrão de api/ugc-voice-recommend.js (validado em produção):
//   - Self-contained (mappings duplicados)
//   - Validação inline + fallback gracioso
//   - Logging estruturado [pov-recommend] OK/Error
//
// REQUEST:
//   POST /api/pov-recommend
//   Body: {
//     categoryId: string,           // de ugc-categories.js (ex: 'perfumes')
//     productName: string,
//     productDescription?: string,
//     productPhotoBase64?: string,  // opcional — Claude usa Vision se vier
//     productPhotoMimeType?: string,// 'image/jpeg' | 'image/png'
//     influencerGender?: string,    // 'female' | 'male' (default 'female')
//     handsMode?: string,           // 'influencer' | 'anonymous' (se 'influencer', handsId vem null)
//   }
//
// RESPONSE:
//   200: { recommendations: { typeId, scenarioId, styleId, handsId }, reasoning, source }
//   400: { error: <mensagem> }
//   500: { error: <mensagem> }
//
// SOURCE pode ser:
//   - 'claude'             — Claude respondeu com IDs válidos
//   - 'claude_partial'     — Claude respondeu mas algum ID era inválido (fallback parcial)
//   - 'fallback'           — Claude falhou completamente, fallback determinístico
//
// 🔁 SE ALTERAR UM ARQUIVO, ATUALIZE O OUTRO:
//   - src/data/pov-mappings.js (frontend + getDefaultTypeForCategory)
//   - api/pov-recommend.js     (backend, este arquivo)

// ════════════════════════════════════════════════════════════════════════
// Espelho dos arrays de IDs válidos (pra validar resposta do Claude)
// ════════════════════════════════════════════════════════════════════════

const VALID_TYPE_IDS = [
  'frasco', 'pote', 'sapatos', 'capinha', 'pequeno',
  'cabide', 'pulso', 'vestindo',
  'mordida',
  'superficie', 'unboxing',
];

const VALID_SCENARIO_IDS = [
  'bancada_marmore', 'vanity', 'pia_banheiro',
  'mesa_escritorio', 'setup_gamer', 'estudio_neutro',
  'cozinha_clean', 'mesa_cafe', 'cama_lencol_claro', 'quarto_noturno', 'mesa_ar_livre',
  'mesa_unboxing', 'mesa_bar', 'loja_showroom', 'estudio_neon',
];

const VALID_STYLE_IDS = [
  'textura_closeup', 'design_acabamento', 'detalhes_premium', 'rotacao_360',
  'tamanho_real', 'funcionalidade', 'aplicacao', 'revelacao_embalagem',
];

const VALID_HANDS_FEMALE = [
  'fem_natural', 'fem_unhas_decoradas', 'fem_francesinha',
  'fem_pulseiras_aneis', 'fem_tatuagem',
];
const VALID_HANDS_MALE = [
  'masc_natural', 'masc_tatuadas', 'masc_relogio', 'masc_pulseira',
];
const VALID_HANDS_SPECIAL = ['luvas_brancas', 'sem_maos'];

const VALID_HANDS_IDS = [...VALID_HANDS_FEMALE, ...VALID_HANDS_MALE, ...VALID_HANDS_SPECIAL];

// ════════════════════════════════════════════════════════════════════════
// Mapping fallback (espelho de pov-mappings.js)
// ════════════════════════════════════════════════════════════════════════

// Categoria TikTok Shop → typeId default
const CATEGORY_TO_TYPE_DEFAULT = {
  skincare_facial: 'pote',     maquiagem: 'pequeno',         cabelos: 'frasco',
  perfumes: 'frasco',          corpo: 'pote',
  moda_feminina: 'cabide',     lingerie: 'cabide',           fitness: 'cabide',
  calcados: 'sapatos',         acessorios: 'pequeno',        joias: 'pulso',
  oculos: 'vestindo',
  decoracao: 'superficie',     cozinha: 'superficie',        cama_mesa_banho: 'superficie',
  organizacao: 'unboxing',     iluminacao: 'superficie',
  acessorios_celular: 'capinha', audio: 'pequeno',           eletrodomesticos: 'superficie',
  smart_home: 'superficie',
  suplementos: 'frasco',       massagem: 'pequeno',          saude_intima: 'pequeno',
  aromaterapia: 'frasco',
  pet_shop: 'superficie',      maternidade: 'superficie',    papelaria: 'superficie',
  brinquedos: 'unboxing',
};

// typeId → primeiro scenarioId ideal (pra fallback rápido)
const TYPE_TO_SCENARIO_FALLBACK = {
  frasco: 'bancada_marmore',  pote: 'bancada_marmore',  sapatos: 'loja_showroom',
  capinha: 'mesa_escritorio', pequeno: 'mesa_escritorio',
  cabide: 'loja_showroom',    pulso: 'mesa_escritorio', vestindo: 'estudio_neutro',
  mordida: 'mesa_cafe',
  superficie: 'estudio_neutro', unboxing: 'mesa_unboxing',
};

// typeId → styleId default (combinação que costuma funcionar)
const TYPE_TO_STYLE_FALLBACK = {
  frasco: 'aplicacao',     pote: 'textura_closeup',  sapatos: 'design_acabamento',
  capinha: 'rotacao_360',  pequeno: 'tamanho_real',
  cabide: 'design_acabamento', pulso: 'detalhes_premium', vestindo: 'funcionalidade',
  mordida: 'aplicacao',
  superficie: 'rotacao_360', unboxing: 'revelacao_embalagem',
};

// ════════════════════════════════════════════════════════════════════════
// Catálogos curtos pro Claude (description em 1 linha cada)
// ════════════════════════════════════════════════════════════════════════

const TYPES_CATALOG = `
TIPOS POV (escolha 1):
- frasco: mão segurando frasco/garrafa pelo corpo (perfume, sérum, bebida, óleo)
- pote: uma mão segura pote, outra abre tampa (creme, manteiga, alimento em pote)
- sapatos: mão erguendo sapato pra exibir lateral/sola (tênis, sandália)
- capinha: mão segurando capinha/gadget retangular (capinha celular, power bank, gadget compacto)
- pequeno: estojo aberto na mão revelando produto pequeno dentro (fones, joia em estojo)
- cabide: roupa pendurada num cabide, mão revela tecido (vestido, blusa, peça pendurada)
- pulso: produto no pulso (relógio, pulseira, anel)
- vestindo: produto sendo colocado/vestido (óculos, chapéu, brinco)
- mordida: produto sendo mordido/comido/bebido (comida, bebida, snack)
- superficie: produto estático em mesa/bancada, vibe catálogo (decoração, eletrodoméstico)
- unboxing: caixa fechada → mãos abrindo → produto interno revelado`;

const SCENARIOS_CATALOG = `
CENÁRIOS POV (escolha 1):
- bancada_marmore: mármore branco com luz suave, vibe spa premium
- vanity: mesa de maquiagem com luzes Hollywood, vibe getting-ready
- pia_banheiro: pia clean de banheiro moderno, vibe rotina manhã
- mesa_escritorio: mesa minimalista com laptop e caderno, vibe produtividade
- setup_gamer: mesa com luz RGB ao fundo, vibe tech enthusiast
- estudio_neutro: fundo neutro estilo estúdio fotográfico, foco máximo no produto
- cozinha_clean: bancada de cozinha clara e limpa, vibe doméstica luminosa
- mesa_cafe: mesa pequena com xícara e croissant, vibe brunch cozy
- cama_lencol_claro: lençol branco amassado, vibe íntima de manhã
- quarto_noturno: quarto noturno com luz quente baixa, vibe rotina noturna
- mesa_ar_livre: mesa de jardim com folhagem ao fundo, vibe outdoor verão
- mesa_unboxing: mesa neutra com caixa fechada, superfície dedicada ao reveal
- mesa_bar: bar escuro com luz ambiente colorida, vibe noturna sofisticada
- loja_showroom: showroom com prateleira ao fundo, vibe varejo aspiracional
- estudio_neon: fundo escuro com LEDs coloridos, vibe pop viral jovem`;

const STYLES_CATALOG = `
ESTILOS POV (escolha 1):
- textura_closeup: super zoom em fibras/superfície/material (vibe macro)
- design_acabamento: ângulo lateral revelando estética completa (vibe editorial)
- detalhes_premium: close em zíper/gravação/costura (vibe luxo)
- rotacao_360: produto girando lentamente (vibe e-commerce)
- tamanho_real: produto na palma da mão dando referência de tamanho
- funcionalidade: produto sendo acionado/operado (vibe demo prática)
- aplicacao: borrifo/passando/aplicando, vibe before/after
- revelacao_embalagem: caixa/embalagem se abrindo lentamente (vibe unboxing)`;

const HANDS_CATALOG_FEMALE = `
MÃOS FEMININAS (se influencer F e modo anonymous, escolha 1):
- fem_natural: mãos naturais, unhas curtas, sem adornos
- fem_unhas_decoradas: unhas longas com nail art colorida (vibe trendy)
- fem_francesinha: francesinha clássica (vibe elegante atemporal)
- fem_pulseiras_aneis: anéis e pulseira fina delicada (vibe estilosa)
- fem_tatuagem: tatuagem fininha discreta no pulso ou dedo`;

const HANDS_CATALOG_MALE = `
MÃOS MASCULINAS (se influencer M e modo anonymous, escolha 1):
- masc_natural: mãos naturais, sem tatuagem nem acessório
- masc_tatuadas: tatuagens visíveis na mão/pulso (vibe edgy)
- masc_relogio: relógio prata/aço escovado no pulso (vibe profissional)
- masc_pulseira: pulseira couro marrom ou elos metálicos`;

// ════════════════════════════════════════════════════════════════════════
// Handler
// ════════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const {
      categoryId,
      productName,
      productDescription = '',
      productPhotoBase64 = null,
      productPhotoMimeType = 'image/jpeg',
      influencerGender = 'female',
      handsMode = 'influencer',
    } = req.body || {};

    // ── Validação básica ─────────────────────────────────────────────
    if (!categoryId || typeof categoryId !== 'string') {
      return res.status(400).json({ error: 'categoryId is required and must be a string' });
    }
    if (!productName || typeof productName !== 'string') {
      return res.status(400).json({ error: 'productName is required and must be a string' });
    }
    if (influencerGender !== 'female' && influencerGender !== 'male') {
      return res.status(400).json({ error: 'influencerGender must be "female" or "male"' });
    }
    if (handsMode !== 'influencer' && handsMode !== 'anonymous') {
      return res.status(400).json({ error: 'handsMode must be "influencer" or "anonymous"' });
    }

    // ── Monta prompt do Claude ───────────────────────────────────────
    const handsCatalog = handsMode === 'anonymous'
      ? (influencerGender === 'male' ? HANDS_CATALOG_MALE : HANDS_CATALOG_FEMALE)
      : '';

    const handsField = handsMode === 'anonymous'
      ? `\n  "handsId": "string (id de ${influencerGender === 'male' ? 'mãos masculinas' : 'mãos femininas'})",`
      : '';

    const systemPrompt = `Você é especialista em direção visual de vídeos UGC pra TikTok Shop.

MISSÃO: receber dados de um produto e sugerir a combinação ideal de TIPO POV + CENÁRIO + ESTILO de câmera (e MÃOS, se aplicável) pra um vídeo de afiliação com vibe TikTok autêntica.

Você vai escolher entre opções fechadas (não invente IDs novos). Se o produto for ambíguo, escolha o que faz mais sentido visualmente.
${TYPES_CATALOG}
${SCENARIOS_CATALOG}
${STYLES_CATALOG}${handsCatalog ? '\n' + handsCatalog : ''}

CRITÉRIOS:
1. TIPO deve combinar com a forma física do produto (frasco pra coisa em frasco, cabide pra roupa, etc.)
2. CENÁRIO deve combinar com o tipo (frasco em bancada de mármore funciona, frasco em setup_gamer não)
3. ESTILO deve valorizar o que o produto tem de melhor (textura close pra material premium, rotação pra mostrar 360°)
4. MÃOS (se for solicitado) devem combinar com o vibe do produto (joia premium pede pulseiras_aneis, gadget pede natural)

RESPONDA APENAS JSON VÁLIDO (sem markdown, sem backticks):
{
  "typeId": "string (id de tipo POV)",
  "scenarioId": "string (id de cenário)",
  "styleId": "string (id de estilo)",${handsField}
  "reasoning": "string em PT-BR, 1-2 frases curtas explicando a escolha"
}`;

    const userText = `Produto: "${productName}"
Categoria TikTok Shop: ${categoryId}
${productDescription ? `Descrição extra: ${productDescription}` : ''}
Influencer: ${influencerGender}
Modo de mãos: ${handsMode}${handsMode === 'anonymous' ? ' (escolha um id de mão)' : ' (NÃO sugira mãos — virá da influencer cadastrada)'}

${productPhotoBase64 ? 'Foto do produto anexada acima.' : 'Sem foto do produto — use o nome e a categoria.'}

Sugira a combinação ideal. Retorne APENAS o JSON.`;

    // ── Monta messages (com ou sem imagem) ───────────────────────────
    const userContent = [];
    if (productPhotoBase64) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: productPhotoMimeType,
          data: productPhotoBase64,
        },
      });
    }
    userContent.push({ type: 'text', text: userText });

    // ── Chamada Claude ───────────────────────────────────────────────
    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[pov-recommend v1.0] Anthropic error ${response.status}:`, errText.substring(0, 300));
      // Não falha — cai pro fallback determinístico
      return res.status(200).json(buildFallback(categoryId, influencerGender, handsMode, 'anthropic_http_error'));
    }

    const data = await response.json();
    const text = data.content?.map((c) => c.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('[pov-recommend v1.0] JSON parse error:', e.message, 'Raw:', clean.substring(0, 300));
      return res.status(200).json(buildFallback(categoryId, influencerGender, handsMode, 'json_parse_error'));
    }

    // ── Validação dos IDs retornados pelo Claude ─────────────────────
    let typeId = parsed.typeId;
    let scenarioId = parsed.scenarioId;
    let styleId = parsed.styleId;
    let handsId = handsMode === 'anonymous' ? parsed.handsId : null;
    const reasoning = parsed.reasoning || '';

    let invalidFields = [];

    if (!VALID_TYPE_IDS.includes(typeId)) {
      invalidFields.push(`typeId="${typeId}"`);
      typeId = CATEGORY_TO_TYPE_DEFAULT[categoryId] || 'superficie';
    }
    if (!VALID_SCENARIO_IDS.includes(scenarioId)) {
      invalidFields.push(`scenarioId="${scenarioId}"`);
      scenarioId = TYPE_TO_SCENARIO_FALLBACK[typeId] || 'estudio_neutro';
    }
    if (!VALID_STYLE_IDS.includes(styleId)) {
      invalidFields.push(`styleId="${styleId}"`);
      styleId = TYPE_TO_STYLE_FALLBACK[typeId] || 'rotacao_360';
    }
    if (handsMode === 'anonymous') {
      const validHandsForGender = influencerGender === 'male'
        ? [...VALID_HANDS_MALE, ...VALID_HANDS_SPECIAL]
        : [...VALID_HANDS_FEMALE, ...VALID_HANDS_SPECIAL];
      if (!validHandsForGender.includes(handsId)) {
        invalidFields.push(`handsId="${handsId}"`);
        handsId = influencerGender === 'male' ? 'masc_natural' : 'fem_natural';
      }
    }

    const source = invalidFields.length === 0 ? 'claude' : 'claude_partial';
    if (invalidFields.length > 0) {
      console.warn(`[pov-recommend v1.0] Claude returned invalid IDs: ${invalidFields.join(', ')} — usando fallback parcial`);
    }

    console.log(
      `[pov-recommend v1.0] OK (${source}): cat=${categoryId} type=${typeId} scenario=${scenarioId} style=${styleId} hands=${handsId || '-'}`
    );

    return res.status(200).json({
      recommendations: { typeId, scenarioId, styleId, handsId },
      reasoning,
      source,
    });
  } catch (error) {
    console.error('[pov-recommend v1.0] Error:', error);
    // Tenta fallback ao invés de retornar 500
    try {
      const { categoryId, influencerGender = 'female', handsMode = 'influencer' } = req.body || {};
      if (categoryId) {
        return res.status(200).json(buildFallback(categoryId, influencerGender, handsMode, 'exception'));
      }
    } catch (_) {}
    return res.status(500).json({ error: error.message });
  }
}

// ════════════════════════════════════════════════════════════════════════
// Fallback determinístico (sem chamar Claude)
// ════════════════════════════════════════════════════════════════════════

function buildFallback(categoryId, influencerGender, handsMode, reason) {
  const typeId = CATEGORY_TO_TYPE_DEFAULT[categoryId] || 'superficie';
  const scenarioId = TYPE_TO_SCENARIO_FALLBACK[typeId] || 'estudio_neutro';
  const styleId = TYPE_TO_STYLE_FALLBACK[typeId] || 'rotacao_360';
  const handsId = handsMode === 'anonymous'
    ? (influencerGender === 'male' ? 'masc_natural' : 'fem_natural')
    : null;

  console.warn(`[pov-recommend v1.0] FALLBACK (${reason}): cat=${categoryId} → type=${typeId} scenario=${scenarioId} style=${styleId} hands=${handsId || '-'}`);

  return {
    recommendations: { typeId, scenarioId, styleId, handsId },
    reasoning: `Sugestão padrão pra categoria "${categoryId}" (Claude indisponível).`,
    source: 'fallback',
  };
}
