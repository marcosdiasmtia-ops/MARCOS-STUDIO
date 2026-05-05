// api/ugc-voice-recommend.js
//
// Endpoint que recomenda uma voz Veo 3 baseada em (estilo × gênero da
// influencer). Cumpre o conceito de "voz dinâmica = ƒ(influencer × estilo)"
// validado empiricamente em 01/05/2026 (Descoberta 1 da arquitetura).
//
// REQUEST:
//   POST /api/ugc-voice-recommend
//   Body: { styleId: string, gender?: 'female' | 'male' }
//
// RESPONSE:
//   200: { voiceId, styleId, gender, source }
//   400: { error: 'styleId is required' | 'invalid gender' }
//   500: { error: <mensagem> }
//
// ⚠️ DUPLICAÇÃO INTENCIONAL DOS MAPPINGS:
// Os 22 mappings abaixo duplicam VOICE_BY_STYLE_FEMALE e VOICE_BY_STYLE_MALE
// de src/data/ugc-veo-voices.js. Foi feito assim pra manter o padrão do
// projeto (endpoints self-contained, sem imports cruzados de src/).
//
// 🔁 SE ALTERAR UM ARQUIVO, ATUALIZE O OUTRO:
//   - src/data/ugc-veo-voices.js (UI + recommendVoice helper)
//   - api/ugc-voice-recommend.js (backend, este arquivo)

// ── Mapeamento Estilo → Voz (FEMALE) — espelho de ugc-veo-voices.js ──
const VOICE_BY_STYLE_FEMALE = {
  natural:         'Zephyr',
  autoridade:      'Kore',
  amigavel:        'Aoede',
  urgente:         'Laomedeia',
  curioso:         'Autonoe',
  storytelling:    'Sulafat',
  comparacao:      'Erinome',
  confissao:       'Despina',
  alerta:          'Pulcherrima',
  hack:            'Callirrhoe',
  custo_beneficio: 'Gacrux',
};

// ── Mapeamento Estilo → Voz (MALE) — espelho de ugc-veo-voices.js ────
const VOICE_BY_STYLE_MALE = {
  natural:         'Charon',
  autoridade:      'Orus',
  amigavel:        'Achird',
  urgente:         'Puck',
  curioso:         'Fenrir',
  storytelling:    'Iapetus',
  comparacao:      'Alnilam',
  confissao:       'Algieba',
  alerta:          'Rasalgethi',
  hack:            'Umbriel',
  custo_beneficio: 'Sadaltager',
};

// Lista válida de estilos (pra validação) — espelha ugc-styles.js
const VALID_STYLE_IDS = Object.keys(VOICE_BY_STYLE_FEMALE);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { styleId, gender = 'female' } = req.body || {};

    // Validação básica
    if (!styleId || typeof styleId !== 'string') {
      return res.status(400).json({ error: 'styleId is required and must be a string' });
    }

    if (gender !== 'female' && gender !== 'male') {
      return res.status(400).json({ error: 'gender must be "female" or "male"' });
    }

    if (!VALID_STYLE_IDS.includes(styleId)) {
      // Não retorna 400 — degrada graciosamente pro fallback 'natural'
      console.warn(`[ugc-voice-recommend] Estilo desconhecido: "${styleId}" → fallback 'natural'`);
    }

    // Pega o mapping certo e calcula a voz
    const map = gender === 'male' ? VOICE_BY_STYLE_MALE : VOICE_BY_STYLE_FEMALE;
    const voiceId = map[styleId] || map.natural;

    // Determina origem da resposta (pra debug/UX)
    const source = map[styleId]
      ? 'mapped'         // mapping explícito pra (estilo, gênero)
      : 'fallback';      // caiu em 'natural'

    console.log(
      `[ugc-voice-recommend] OK: styleId=${styleId} gender=${gender} → voiceId=${voiceId} (${source})`
    );

    return res.status(200).json({
      voiceId,
      styleId,
      gender,
      source,
    });
  } catch (error) {
    console.error('[ugc-voice-recommend] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
