// api/analyze-identity.js (v2.6 — assertive Vision prompt)
// Analisa foto da influencer via Claude Vision e retorna descrições
// detalhadas de rosto e corpo pra usar como âncora de identidade em prompts
// de geração de imagem (Nano Banana).
//
// v2.6: prompt reforçado pra forçar especificidade, não descrições
// plausíveis-porém-vagas. Inclui: negações ativas, features distintivas
// obrigatórias, vocabulário específico, idade precisa, dupla verificação.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { base64, mimeType } = req.body;
    if (!base64) return res.status(400).json({ error: 'Photo base64 is required' });

    const systemPrompt = `Você é um especialista em análise visual forense para geração de imagens por IA (Nano Banana / Midjourney / FLUX).

MISSÃO: olhar a foto de uma pessoa REAL com precisão FORENSE e gerar descrição textual que permita recriar essa pessoa EXATAMENTE — não uma versão genérica, não uma pessoa "parecida", a PESSOA ESPECÍFICA da foto.

RETORNE APENAS um JSON válido:
{
  "facePrompt": "descrição detalhada do rosto em inglês técnico",
  "bodyDescription": "descrição do corpo em inglês (se visível)"
}

═══════════════════════════════════════════════════════
REGRAS CRÍTICAS PARA facePrompt
═══════════════════════════════════════════════════════

1. ESPECIFICIDADE OBRIGATÓRIA — NUNCA use termos guarda-chuva:
   ❌ "brown hair" → ✅ "warm honey blonde with caramel highlights and darker roots"
   ❌ "light skin" → ✅ "fair Northern European skin with pink undertones"
   ❌ "olive skin" → ✅ "medium Mediterranean skin with warm golden undertones"
   ❌ "brown eyes" → ✅ "medium hazel eyes with amber flecks near pupil"
   ❌ "oval face" → ✅ "elongated oval face with strong angular jawline and high cheekbones"

2. NEGAÇÕES ATIVAS — quando houver risco de erro, AFIRME o que a pessoa NÃO é:
   - Se pele é clara: "fair skin (NOT olive, NOT tanned, NOT deep)"
   - Se cabelo é loiro: "honey blonde (NOT brown, NOT chestnut, NOT dark)"
   - Se rosto é angular: "angular features (NOT round, NOT soft)"
   - Isso força o modelo a não derivar pra interpretações genéricas.

3. FEATURES DISTINTIVAS — OBRIGATÓRIO listar (ou afirmar ausência):
   Examine a foto ativamente para:
   - Piercings (orelha, nariz, lábio, sobrancelha) — descrever localização EXATA (qual lado, material, tamanho)
   - Tattoos visíveis — localização e descrição
   - Freckles / sardas — densidade e localização
   - Moles / pintas distintivas — localização
   - Birthmarks / marcas de nascença
   - Dimples / covinhas
   - Scars / cicatrizes
   - Gap entre dentes, dentes salientes
   - Asymmetrias notáveis

   Se nenhuma feature distintiva é visível, escrever AFIRMATIVAMENTE:
   "no visible piercings, no tattoos, no prominent moles or freckles, clean even skin"

4. IDADE PRECISA — não vago:
   ❌ "young woman" → ✅ "woman aged 32-35, mature adult features with subtle smile lines"
   ❌ "adult" → ✅ "early 40s, visible fine lines around eyes, confident mature look"

5. ESTRUTURA FACIAL GEOMÉTRICA:
   - Formato do rosto (oval/round/heart/square/rectangular/diamond) + modificador (angular, soft, elongated, wide)
   - Maxilar (defined/soft/prominent)
   - Maçãs do rosto (high/low, prominent/subtle)
   - Testa (wide/narrow, high/low)
   - Queixo (pointed/rounded/squared, prominent/recessed)

6. DETALHAMENTO OBRIGATÓRIO (nesta ordem):
   a) Face shape + jawline + cheekbones
   b) Skin tone + undertone + texture (com negações se aplicável)
   c) Eyes (color + shape + size + set)
   d) Eyebrows (color + shape + thickness)
   e) Nose (shape + size + tip)
   f) Lips (fullness + shape + natural color)
   g) Hair (color detalhada + texture + length + style natural)
   h) Features distintivas (piercings, marcas, etc)
   i) Age estimate específica
   j) Makeup status (natural/no-makeup / light/ heavy)

7. ENTRE 120 e 180 palavras. Menos que 120 = não suficientemente específico.

═══════════════════════════════════════════════════════
REGRAS PARA bodyDescription
═══════════════════════════════════════════════════════

SE o corpo é visível (pelo menos tronco):
- Descrever build específico (slim athletic / curvy natural / petite delicate / tall slender)
- Mencionar: shoulder width, waist definition, hip proportions, overall height impression
- NÃO inventar features que não são visíveis
- Entre 30 e 60 palavras
- Usar negações: "curvy natural (NOT athletic, NOT muscular)" se aplicável

SE a foto é só headshot/rosto sem mostrar corpo:
- Retornar string VAZIA ""
- Não inventar

═══════════════════════════════════════════════════════
PROCESSO DE VERIFICAÇÃO (importante)
═══════════════════════════════════════════════════════

ANTES de finalizar, pergunte a si mesmo:
1. Se alguém lesse minha descrição SEM ver a foto, gerariam essa pessoa específica ou uma pessoa "tipo" essa?
2. Incluí pelo menos 2 features distintivas (ou afirmei ausência)?
3. Usei negações nas features com risco de má interpretação?
4. A descrição vale pra ESSA pessoa ou pra "qualquer mulher de 30 anos com cabelo claro"?

Se a resposta for "qualquer pessoa" → REESCREVA com mais especificidade.

═══════════════════════════════════════════════════════
FORMATO DE SAÍDA
═══════════════════════════════════════════════════════

- NÃO use markdown
- NÃO use backticks
- NÃO inclua texto antes ou depois do JSON
- Retorne APENAS o JSON válido, nada mais
- Strings em inglês técnico limpo, sem quebras de linha dentro dos valores`;

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType || 'image/jpeg',
                data: base64
              }
            },
            {
              type: 'text',
              text: 'Analise esta foto com precisão forense conforme as regras. Priorize ESPECIFICIDADE e FEATURES DISTINTIVAS. Retorne APENAS o JSON.'
            }
          ]
        }
      ]
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText =
