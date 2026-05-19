// api/pov-kling-prompts.js (v2.1 — alinha referências de 10s → 15s pra Kling v3 Standard)
//
// CHANGELOG v2.1 (18/05/2026):
//   🆕 ATUALIZA REFERÊNCIAS A "10 SECONDS" → "15 SECONDS" e
//      "Kling 2.6 Pro" → "Kling v3 Standard" no system prompt + comentários.
//
//      Não muda comportamento — só mantém o prompt do Claude COERENTE com a
//      nova realidade do pipeline POV (migrou pra Kling v3 Standard 15s
//      nesta mesma sessão pra fix definitivo do freeze frame).
//
//      Sem essa atualização, o Claude teria duas instruções conflitantes:
//      "anima por 10 segundos" no system prompt, mas o vídeo real seria de
//      15s. Modelo poderia gerar prompts subdimensionados pro tempo total.
//
//   📌 Retrocompat 100%: schema de input/output inalterado.
//
// CHANGELOG v2.0 (12/05/2026 — Plano v4, Sub-lote B):
//   🆕 TYPE_PROMPT_HINTS expandido pra 22 tipos (era 11).
//      Inclui os 11 tipos novos: close_tatil, caminhando, correndo,
//      entrando_ambiente, mostrando_amigo, recebendo_produto,
//      reflexo_espelho, antes_depois, testando_primeira,
//      pegando_prateleira, tirando_mochila.
//   🆕 SCENARIO_PROMPT_HINTS expandido pra 37 cenários (era 15).
//      Inclui 22 novos: banheiro_bagunçado, closet_espelhado, mesa_caotica,
//      cafeteria, cozinha_em_uso, janela_chuva, cozinha_noturna, sofa_cozy,
//      mat_yoga, lavanderia, aparador_hall, gaveta_organizada, golden_hour,
//      rua_urbana, academia, elevador, corredor_predio, entrada_loja,
//      dentro_carro, parede_objetos, manequim_feminino, manequim_masculino.
//   🆕 IMPERFECTION_CAMERA_DIRECTIVES (NOVO) — 6 níveis de imperfeição
//      visual (POV_IMPERFECTIONS de pov-styles.js Plano v4). Cada nível
//      injeta 5-7 micro-comportamentos de câmera no prompt do Kling.
//      Quando `imperfectionId` é fornecido, substitui o STYLE_CAMERA
//      como diretriz principal — ou se combina com ele.
//   🆕 NATURALITY_EXTRA_DIRECTIVE (NOVO) — string única injetada quando
//      naturalExtra=true (e a imperfeição não desabilita).
//   🆕 secondaryObjects (NOVO) — array de strings opcional. Quando vem,
//      os objetos contextuais são listados no system prompt pra Claude
//      tecer no background do take (sem competir com o produto).
//   🆕 motionIntensity (NOVO) — número 1-5 opcional. Quando vem, modula
//      o tom do prompt (1-2: contemplativo; 3: moderado; 4-5: dinâmico).
//   🆕 PREFIXO DE FIDELIDADE DO PRODUTO (Solução B do Plano v4) —
//      auto-injetado no início de cada klingPrompt após geração:
//      "Preserve the product exactly as shown in the base image. No
//      changes to design, label, color, shape, or branding during motion."
//      Isso reforça o anchor visual do Nano Banana Pro durante a animação
//      do Kling v3 Standard, evitando que detalhes do produto desviem ao longo
//      dos 15s. Mecanismo robusto: se Claude já incluiu a frase no prompt
//      (porque o system prompt pede isso), não duplica.
//   🆕 max_tokens aumentado pra 4096 (era 3072) — mais regras = mais texto.
//
// Endpoint que recebe (script, typeId, scenarioId, styleId, handsConfig,
// produto + extras do Plano v4) e gera os N PROMPTS EM INGLÊS pro Kling v3
// Standard animar cada take de 15s.
//
// Cada prompt do Kling é INDEPENDENTE — descreve o que acontece naquele take
// específico, ancorado na imagem-base do Nano Banana Pro (gerada pelo
// pov-image-base.js). A imagem-base já carrega o contexto visual
// (mãos + produto + cenário), então o prompt do Kling foca em MOVIMENTO.
//
// PIPELINE:
//   1. pov-script.js     → roteiro PT-BR com N takes (com intensidade opcional)
//   2. pov-image-base.js → imagem-base (com seed compartilhado opcional)
//   3. pov-kling-prompts (ESTE)  → N prompts em inglês descrevendo movimento
//   4. pov-kling-generate.js → roda Kling v3 Standard pra cada (imagem, prompt) → vídeo 15s
//
// Cada prompt tem estrutura [HANDS] + [ACTION] + [PRODUCT] + [CAMERA] +
// [ENVIRONMENT] + opcionalmente [IMPERFECTION] + [SECONDARY OBJECTS].
// Claude monta integrado, em inglês fluente (não bloco-a-bloco), 60-150 palavras.
//
// REQUEST:
//   POST /api/pov-kling-prompts
//   Body: {
//     script: array,                // saída do pov-script.js (com takeNumber + purpose)
//     typeId: string,               // de pov-types.js (22 ids válidos)
//     scenarioId: string,           // de pov-scenarios.js (37 ids válidos)
//     styleId: string,              // de pov-styles.js (8 estilos atuais)
//     handsConfig: {                // ⭐ obrigatório
//       mode: 'influencer' | 'anonymous',
//       handsId?: string,           // só se mode='anonymous'
//       gender?: string,            // pra modo influencer: 'female'|'male'
//       skinDescription?: string,   // pra modo influencer: descrição livre
//     },
//     productName: string,
//     productDescription?: string,  // descrição em inglês (de api/analyze-product)
//     productPhotoBase64?: string,  // opcional pra Vision
//     productPhotoMimeType?: string,
//
//     // 🆕 Plano v4 (todos opcionais — retrocompat 100%)
//     imperfectionId?: string,      // 6 ids de POV_IMPERFECTIONS
//     naturalExtra?: boolean,       // checkbox Naturalidade Extra
//     motionIntensity?: number,     // 1-5 (auto-derivável do typeId)
//     secondaryObjects?: string[],  // array de strings pré-misturadas
//                                   // (frontend computa via mixSecondaryObjects)
//   }
//
// RESPONSE:
//   200: { prompts: [{ takeNumber, klingPrompt, purpose }, ...], source }
//   400: { error: <mensagem> }
//   500: { error: <mensagem> }
//
// 🔁 SE ALTERAR DATA FILES, ATUALIZE OS HINTS DUPLICADOS AQUI:
//   - src/data/pov-types.js     ↔ TYPE_PROMPT_HINTS (22)
//   - src/data/pov-scenarios.js ↔ SCENARIO_PROMPT_HINTS (37)
//   - src/data/pov-styles.js    ↔ STYLE_CAMERA_DIRECTIVES (8) +
//                                 IMPERFECTION_CAMERA_DIRECTIVES (6) +
//                                 NATURALITY_EXTRA_DIRECTIVE
//   - src/data/pov-hands.js     ↔ HANDS_PROMPT_HINTS (11)

// ════════════════════════════════════════════════════════════════════════
// Constantes — Fidelidade do produto (Solução B)
// ════════════════════════════════════════════════════════════════════════

const FIDELITY_PREFIX =
  'Preserve the product exactly as shown in the base image. No changes to design, label, color, shape, or branding during motion. ';

// ════════════════════════════════════════════════════════════════════════
// Hints duplicados — TIPOS (22 — Plano v4)
// Espelha promptHint de src/data/pov-types.js
// ════════════════════════════════════════════════════════════════════════

const TYPE_PROMPT_HINTS = {
  // 🤲 HANDHELD (6)
  frasco: 'Hand grasping a bottle or flask firmly from the side, fingers wrapped around the body of the container, product label clearly visible, smooth deliberate movements showing the product weight and shape, with slight thumb glides along the label and gentle wrist rotations revealing the bottle silhouette.',
  pote: 'One hand holding a jar steady from below, the other hand unscrewing or removing the lid in a smooth motion, product opening clearly visible, content texture revealed naturally, with a delicate lid twisting motion and a brief content peek with minimal arm tension.',
  sapatos: 'Hand lifting a single shoe by the heel or upper, rotating slowly to show the side profile, sole, stitching and material detail, product fully in focus against a clean background, with subtle wrist tilts and gentle finger repositioning on the upper.',
  capinha: 'Hand holding a rectangular phone case or compact gadget vertically, fingers gripping the edges, slight rotation revealing the back design, camera cutouts and material texture clearly visible, with light fingertip taps on edges and slow vertical rotation showing camera cutouts.',
  pequeno: 'Hand holding a small open case or box at chest level, product nested inside clearly visible, fingers framing the case without covering the product, soft natural lighting on the contents, with careful case tilting and subtle finger spread framing the contents.',
  close_tatil: 'Extreme close-up of fingers pressing or squeezing the product to test its texture and material quality, slow pressing motion, subtle finger compression on the surface, gentle release showing material rebound or bounce-back, every micro-detail of the surface visible (fabric weave, foam compression, leather grain, packaging finish).',

  // 👔 WORN (3)
  cabide: 'Hand holding a clothing hanger at eye level, garment hanging naturally, the other hand smoothing the fabric or revealing texture details, full piece visible from collar to hem, with gentle fabric brushing and a soft sway of the hanger.',
  pulso: 'Wrist or hand wearing the product, slight rotation showing the piece from multiple angles, skin texture and product detail in sharp focus, natural arm position with relaxed posture, with slow wrist rotation and gentle forearm angle adjustments.',
  vestindo: 'Hands bringing the wearable product toward the body and putting it on in a smooth motion (glasses lifting to the eyes, hat onto the head, earring to the lobe), product clearly visible during the action, with a smooth lifting motion and a brief settling adjustment after placement.',

  // 🍽 ORAL (1)
  mordida: 'Hand bringing the food or drink product toward the mouth, lips parting naturally as the product approaches, controlled bite or sip moment, product partially consumed visible, with a brief lip parting moment and a controlled chew or sip immediately after contact.',

  // 🎁 SPECIAL (2)
  superficie: 'Product placed on a clean surface (counter, table, shelf), camera circling slowly or zooming in for detail, no hands in frame, professional product photography lighting, multiple angles revealed, with no body motion in frame and a slow controlled camera glide around the product.',
  unboxing: 'Hands opening a sealed product box from the top, lifting the lid carefully, revealing the product inside with anticipation, packaging material and product surface clearly visible during the reveal, with an anticipation pause before the reveal and a controlled lid lift.',

  // 🚶 MOVEMENT (3 NOVOS)
  caminhando: 'Person walking forward holding the product visible in one hand, subtle arm swing, natural step rhythm, occasional weight shift between legs, urban or domestic setting slightly blurring in the background from forward motion, product staying clearly framed and in focus throughout the walk.',
  correndo: 'Person in athletic motion (running, lifting, training), product visible held in hand or worn on body, intense breathing rhythm, sweat-glistening skin highlights, dynamic arm pumping motion, gym or outdoor athletic setting with motion blur on the background, product staying in sharp focus despite the high-energy movement.',
  entrando_ambiente: 'Person entering a space (home doorway, office reception, store front) holding or carrying the product, purposeful step into the room, slight door interaction with shoulder or elbow, natural body rotation entering the frame, product visible in hand or on body during the arrival moment.',

  // 👋 SOCIAL (2 NOVOS)
  mostrando_amigo: 'Camera turning toward another person who reacts to the product, slight camera turn revealing a friend in frame, brief eye contact moment between the protagonist and the friend, casual gesture offering or showing the product, reaction of surprise or delight on the friends face, product framed naturally between the two people.',
  recebendo_produto: 'Another hand extending from off-frame to deliver the product into the protagonists open hand, subtle hand opening to receive, brief weight shift accepting the product, gentle grip closure around it, gift exchange or handoff context, both hands visible during the transfer moment.',

  // 🎬 CINEMATIC (1 NOVO)
  reflexo_espelho: 'Product appearing through a mirror reflection (bathroom mirror, vanity, dressing-room mirror, closet mirror), slow camera turn revealing the reflection, subtle body angle shift in front of the mirror, momentary eye contact with the reflection, the mirror showing both the person and the product cleanly framed together.',

  // 📖 STORYTELLING (2 NOVOS)
  antes_depois: 'Two distinct visual states shown sequentially with the product as the catalyst, clear before-state moment in the first beat, transition gesture using the product in between, distinct after-state reveal in the second beat, the contrast between before and after clearly visible in the same composition or with a smooth match cut.',
  testando_primeira: 'First-time experience with the product, tentative first touch or sniff or taste, brief hesitation pause before the reaction, micro-expressions of discovery on the face (surprise, curiosity, satisfaction), careful interaction revealing the initial impression honestly, product handled with attention and presence.',

  // 🛒 SHOPPING (2 NOVOS)
  pegando_prateleira: 'Hand reaching toward a product on a store shelf or kitchen cabinet, reaching motion toward the shelf with arm extension, brief product selection pause comparing nearby options, deliberate grab and pull motion, product extracted cleanly from a row of similar items, retail or pantry context visible around the hand.',
  tirando_mochila: 'Hand pulling the product out of a bag (backpack, tote, purse, fanny pack), casual bag opening motion with the other hand holding the bag open, hand searching briefly inside, gentle product extraction with controlled reveal, product emerging from inside the bag clearly into view.',
};

// ════════════════════════════════════════════════════════════════════════
// Hints duplicados — CENÁRIOS (37 — Plano v4)
// Espelha scenarioPrompt de src/data/pov-scenarios.js
// ════════════════════════════════════════════════════════════════════════

const SCENARIO_PROMPT_HINTS = {
  // 💄 Beleza (5)
  bancada_marmore: 'Clean white marble countertop with subtle grey veining, soft diffused natural daylight from above, premium spa-like atmosphere, slight reflection of the product on the polished marble.',
  vanity: 'Vanity makeup table with warm Hollywood-style ring light reflection in the background, soft pink or beige base tone, brushes and small beauty items slightly out of focus around the edges, intimate warm lighting.',
  pia_banheiro: 'Clean modern bathroom sink area with white ceramic surface, fresh white folded towel visible at the edge, soft cosmetic lighting from above, minimal Scandinavian aesthetic.',
  'banheiro_bagunçado': 'Lived-in modern bathroom with white tiles slightly steamed up after a shower, used hand towels casually draped over a rail, a few products grouped naturally on the counter edge, warm vanity-mirror lighting creating a real morning-routine atmosphere, slight humidity hanging in the air, authentic everyday vibe with no overproduced styling.',
  closet_espelhado: 'Walk-in closet space with a full-length mirror reflecting both the protagonist and the product, warm tungsten or LED dressing-room lighting on the rails, hanging clothes softly out of focus framing the mirror, polished hardwood floor catching gentle highlights, intimate getting-dressed atmosphere with reflection as the main visual element.',

  // 💼 Trabalho / Tech (4)
  mesa_escritorio: 'Minimalist office desk surface in light wood or matte white, closed laptop slightly out of focus, leather notebook and a coffee cup at the edge, soft natural daylight from a window on the side.',
  setup_gamer: 'Dark gamer desk surface with RGB ambient lighting in purple and cyan tones in the background, mechanical keyboard and headphones slightly out of focus, deep contrast tech-enthusiast aesthetic.',
  estudio_neutro: 'Seamless neutral studio backdrop in soft grey or beige, controlled three-point studio lighting eliminating harsh shadows, professional product photography atmosphere.',
  mesa_caotica: 'Real working desk surface with controlled chaos: scattered papers, a half-drunk coffee mug, sticky notes around the monitor base softly out of focus, a tangled phone cable visible at the edge, late afternoon ambient lighting from a window, authentic lived-in productivity atmosphere with no perfect styling, real-creator workspace vibe.',

  // 🛋 Casa / Lifestyle (14)
  cozinha_clean: 'Clean light kitchen countertop in white or light wood, modern kitchen utensils and a fresh herb plant slightly out of focus, bright natural daylight from a window.',
  mesa_cafe: 'Small wooden cafe table surface with a warm cappuccino cup and a fresh croissant on a ceramic plate slightly out of focus, soft morning light filtering through a nearby window.',
  cama_lencol_claro: 'Crisp white bedsheet softly wrinkled on a made bed, late morning sunlight casting gentle diagonal patterns across the fabric, intimate bedroom atmosphere.',
  quarto_noturno: 'Bedside table surface with a soft warm bedside lamp casting amber light, dim cozy bedroom in the background slightly out of focus, deep warm shadows and golden highlights on the product.',
  mesa_ar_livre: 'Outdoor wooden garden table surface, lush green foliage softly out of focus in the background, dappled natural sunlight filtering through leaves.',
  cafeteria: 'Mid-sized urban cafeteria interior with brushed wood tables and exposed brick or concrete walls slightly out of focus, soft warm pendant lighting from above, ambient background of people chatting and steam rising from cups, vibrant social third-place atmosphere with morning warmth.',
  cozinha_em_uso: 'Active kitchen scene with a stovetop simmering in the background out of focus, chopping board with fresh ingredients visible at the edge, steam rising from a pot, warm under-cabinet lighting, hands moving naturally in the workspace, real cooking moment atmosphere with sensory cues of food preparation.',
  janela_chuva: 'Wooden window-side surface (windowsill or small table) with a rain-streaked window behind, soft grey overcast daylight filtering through the wet glass, rain droplets visible on the pane creating diffused light patterns, cozy melancholic indoor-on-a-rainy-day atmosphere.',
  cozinha_noturna: 'Dimly lit kitchen at night with only the under-cabinet LED strip and a small pendant lamp casting warm pools of light, dark windows reflecting the interior, a glass of water or wine softly out of focus on the counter, intimate quiet night atmosphere.',
  sofa_cozy: 'Plush sofa with chunky knitted blanket draped naturally over the armrest, soft cushions piled in the background, a steaming mug placed on a side table beside it, warm yellow floor-lamp lighting creating golden highlights on the fabric textures, cozy hygge living-room atmosphere.',
  mat_yoga: 'Yoga mat unrolled on a wooden floor with a small plant and a soft towel beside it, soft morning natural daylight from a large window casting long gentle shadows across the floor, minimal mindful interior with neutral tones, peaceful pre-workout meditation atmosphere.',
  lavanderia: 'Bright modern laundry room with a stacked washer and dryer in the background slightly out of focus, neatly folded clothes on a counter, soft daylight through a small window, fresh detergent fragrance suggested by visual cues like a folded towel, clean and orderly utility atmosphere.',
  aparador_hall: 'Narrow entryway console table surface in dark wood or matte black, a small ceramic bowl with keys and a candle softly out of focus beside it, a framed mirror behind reflecting the natural light from a nearby door, refined elegant home-entrance atmosphere.',
  gaveta_organizada: 'Open drawer interior shot from above showing neatly arranged compartments with soft fabric liners, items grouped by category around the empty space, soft top-down natural light revealing the organization, satisfying-organization atmosphere with KonMari-style aesthetic.',

  // 🌟 Especial / Criativo (5)
  mesa_unboxing: 'Clean neutral surface (light wood or matte white) prepared for an unboxing moment, sealed product packaging centered in frame, soft even lighting eliminating shadows on the box.',
  mesa_bar: 'Dark bar countertop in deep wood or marble with soft amber and red ambient bar lighting in the background, blurred bottles and glassware slightly visible behind, sophisticated cinematic moody tones.',
  loja_showroom: 'Bright retail showroom counter with elegantly displayed products on shelves softly out of focus in the background, polished display lighting, premium retail atmosphere.',
  estudio_neon: 'Dark studio surface with vibrant LED neon lighting in pink, purple and cyan creating bold colored reflections on the product surface, contemporary pop aesthetic with high contrast.',
  golden_hour: 'Outdoor or window-side surface bathed in dramatic golden hour sunlight, long warm orange-amber light rays casting elongated shadows, the product catching a beautiful warm rim-light highlight, simple uncluttered background, cinematic magic-hour atmosphere.',

  // 🚶 Movimento (6 NOVOS)
  rua_urbana: 'Urban street scene with a mix of pedestrians and storefronts slightly out of focus behind, soft late-afternoon sunlight bouncing off building facades, ambient city movement with cars passing in the far background, authentic street-style influencer atmosphere with mild motion blur on the surroundings while the foreground stays sharp.',
  academia: 'Modern gym interior with dark equipment and mirror walls slightly out of focus in the background, focused spot lighting on the workout area, faint atmosphere of other gym-goers training out of focus, energetic fitness atmosphere with sweat-glistening highlights and visible intensity.',
  elevador: 'Inside a modern elevator cabin with metallic walls or mirror surface reflecting the protagonist, soft overhead recessed lighting, the floor indicator faintly visible at the top edge, contained intimate moment-in-transit atmosphere, lift-selfie aesthetic with the reflection element framing the product clearly.',
  corredor_predio: 'Building corridor or hallway with patterned carpet and a row of identical doors stretching into perspective, soft warm hallway lighting from sconces or recessed fixtures, architectural depth atmosphere with subtle motion forward.',
  entrada_loja: 'Storefront entrance with a clean glass door, soft natural daylight from outside contrasting with the warmer interior store lighting, retail-arrival atmosphere, brief threshold moment of entering or leaving with a purchase, slight motion of the door swinging.',
  dentro_carro: 'Car interior shot from the passenger seat angle, dashboard slightly visible at the bottom of the frame, soft daylight through the side window creating contoured highlights, comfortable cabin atmosphere with steering wheel partially in frame, that on-the-go moment of having just bought or unwrapped the product, intimate solo travel vibe.',

  // 🛍 Decoração & Varejo (3 NOVOS)
  parede_objetos: 'Display wall in a styled boutique or pop-up store with a curated arrangement of products on minimal floating shelves or pegboards softly out of focus, warm accent spotlights highlighting each piece, curated-retail atmosphere with editorial styling.',
  manequim_feminino: 'Fashion store interior with a styled female mannequin in the background wearing a complete look, soft retail spotlight illuminating the display, premium try-on atmosphere with optional mirror element, aspirational shopping vibe.',
  manequim_masculino: 'Menswear store interior with a styled male mannequin in the background wearing a complete look, focused retail lighting on the display, masculine shopping atmosphere with neutral tones, that menswear-fitting-room confidence vibe.',
};

// ════════════════════════════════════════════════════════════════════════
// Hints duplicados — ESTILOS (8 — não mudou no Plano v4)
// Espelha cameraDirective de src/data/pov-styles.js POV_STYLES
// ════════════════════════════════════════════════════════════════════════

const STYLE_CAMERA_DIRECTIVES = {
  textura_closeup: 'Extreme close-up macro shot focusing on the texture and material, fibers/weave/surface detail filling most of the frame, shallow depth of field with crisp focus, slight slow drift across the texture.',
  design_acabamento: 'Side angle medium shot showing the full design aesthetic, balanced composition with the product centered, soft directional lighting accentuating curves and silhouette.',
  detalhes_premium: 'Tight close-up on premium fine details (zipper teeth, engraved logo, hand stitching, hardware), camera moves slowly across each detail point, sharp focus on small features.',
  rotacao_360: 'Product rotating slowly on its vertical axis, smooth continuous turntable motion, even all-around lighting eliminating harsh shadows, product fully revealed from every angle.',
  tamanho_real: 'Product placed on an open palm at chest level for natural scale reference, hand visible giving size context, soft directional lighting on both hand and product.',
  funcionalidade: 'Product being actively used or operated (button being pressed, lid opening, mechanism engaging), camera close enough to capture the functional moment, real-time motion of the action.',
  aplicacao: 'Product being applied or activated (perfume mist spraying, lipstick gliding on lips, cream being smoothed onto skin), capturing the application moment in slow controlled motion.',
  revelacao_embalagem: 'Product packaging opening in a deliberate slow reveal motion (box lid lifting, plastic seal peeling back, drawer sliding open), the product gradually emerging from inside.',
};

// ════════════════════════════════════════════════════════════════════════
// 🆕 Imperfeições (6 — Plano v4)
// Espelha cameraDirective de src/data/pov-styles.js POV_IMPERFECTIONS
// ════════════════════════════════════════════════════════════════════════

const IMPERFECTION_CAMERA_DIRECTIVES = {
  comercial_limpo:
    'Pristine commercial cinematography: locked-off tripod stability, smooth motorized push-in or slow dolly, precise rack-focus pulls between subject and product, controlled three-point studio lighting, flawless framing with rule-of-thirds, color-graded for premium polish, zero handheld feel.',
  influencer_polido:
    'Polished influencer aesthetic: gimbal-stabilized smooth motion, gentle slow push-ins with cinematic deceleration, deliberate slow-pan reveals, soft beauty lighting from a key softbox, clean composition with branded styling, color-graded warm and bright, sense of high-effort production.',
  tiktok_natural:
    'Real creator TikTok aesthetic: handheld phone framing with light natural movement, single ambient room light source, casual eye-level angle, slight reframing mid-take, no post-color-grading just natural exposure, lived-in vibe without overproduction, social-feed authentic energy.',
  handheld_cru:
    'Visible handheld energy: organic shake on every movement, off-axis tilts during pans, motion blur on quick gestures, micro-adjustments in framing as the operator follows the action, slight horizon drift, raw uncorrected color, unrehearsed observational feel.',
  iphone_caseiro:
    'Home-iPhone aesthetic: visible autofocus hunting between subjects, exposure shifting as the camera moves between light and shadow, mild lens flare from indoor bulbs, slight motion blur from quick movements, vertical framing with occasional crooked angle, no professional polish at all, candid moment.',
  documentario:
    'Documentary observational aesthetic: visible film grain or sensor noise in low-light areas, wider master-shot framing leaving negative space, fly-on-the-wall passive observation feel, slow rack focus between background and product, natural ambient sound suggestion, longer slower takes, no choreographed motion, unfiltered authenticity.',
};

// 🆕 Naturalidade Extra (Plano v4) — string única injetada quando ON
// Espelha NATURALITY_EXTRA_DIRECTIVE de src/data/pov-styles.js
const NATURALITY_EXTRA_DIRECTIVE =
  'Subtle handheld camera with natural slight shake, minimal motion blur on quick moves, organic micro-adjustments in framing, slight focus breathing on close-ups.';

// IDs que TEM naturalidade nativa (não combinar com naturalExtra)
// Espelha disablesNaturality dos POV_IMPERFECTIONS níveis 4-6.
const IMPERFECTION_DISABLES_NATURALITY = new Set([
  'handheld_cru',
  'iphone_caseiro',
  'documentario',
]);

// ════════════════════════════════════════════════════════════════════════
// Hints duplicados — MÃOS (11 — não mudou)
// Espelha src/data/pov-hands.js
// ════════════════════════════════════════════════════════════════════════

const HANDS_PROMPT_HINTS = {
  fem_natural: 'Natural feminine hands with neatly trimmed short nails, no nail polish or minimal clear coat, smooth skin texture, no jewelry visible, slim relaxed fingers.',
  fem_unhas_decoradas: 'Feminine hands with long manicured nails featuring colorful nail art design, glossy finish catching the light, well-groomed cuticles, no rings, expressive fingertip presence.',
  fem_francesinha: 'Feminine hands with classic French manicure: white tips on a soft pink natural base, medium-length almond shape, glossy clean finish, refined elegant aesthetic.',
  fem_pulseiras_aneis: 'Feminine hands wearing one or two delicate gold or silver thin rings on different fingers, a subtle thin chain bracelet on the wrist, neat short or medium nails, polished refined styling.',
  fem_tatuagem: 'Feminine hands with one delicate fine-line tattoo on the wrist or side of finger (small minimalist design), neat natural nails, modern artistic vibe.',
  masc_natural: 'Natural masculine hands, well-groomed short nails, no jewelry, no tattoos visible, defined knuckles and fingers, healthy skin texture, neutral relaxed grip.',
  masc_tatuadas: 'Masculine hands with bold visible tattoos on the back of the hand and wrist (geometric or line work designs), short clean nails, defined fingers, modern edgy aesthetic.',
  masc_relogio: 'Masculine hands wearing a refined silver or brushed steel wristwatch on the left wrist, watch face partially visible, clean short nails, professional polished aesthetic.',
  masc_pulseira: 'Masculine hands wearing a brown leather wrist cuff or a metal chain bracelet, slightly worn aesthetic suggesting daily use, defined hands, no rings, casual styled vibe.',
  luvas_brancas: 'Hands wearing pristine white cotton or satin gloves, no skin visible, premium concierge or jewelry-presentation aesthetic, careful deliberate handling.',
  sem_maos: 'No hands visible in the frame, product appears alone (placed on surface, suspended by invisible support, or shown in catalog-style isolation), clean professional product photography vibe.',
};

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
      script = [],
      typeId,
      scenarioId,
      styleId,
      handsConfig = {},
      productName,
      productDescription = '',
      productPhotoBase64 = null,
      productPhotoMimeType = 'image/jpeg',
      // 🆕 Plano v4 — todos opcionais
      imperfectionId = null,
      naturalExtra = false,
      motionIntensity = null,
      secondaryObjects = null,
    } = req.body || {};

    // ── Validação ────────────────────────────────────────────────────
    if (!Array.isArray(script) || script.length === 0) {
      return res.status(400).json({ error: 'script is required (array of takes)' });
    }
    if (!productName) return res.status(400).json({ error: 'productName is required' });
    if (!TYPE_PROMPT_HINTS[typeId]) {
      return res.status(400).json({ error: `invalid typeId "${typeId}"` });
    }
    if (!SCENARIO_PROMPT_HINTS[scenarioId]) {
      return res.status(400).json({ error: `invalid scenarioId "${scenarioId}"` });
    }
    if (!STYLE_CAMERA_DIRECTIVES[styleId]) {
      return res.status(400).json({ error: `invalid styleId "${styleId}"` });
    }
    if (!handsConfig.mode || !['influencer', 'anonymous'].includes(handsConfig.mode)) {
      return res.status(400).json({ error: 'handsConfig.mode must be "influencer" or "anonymous"' });
    }

    // 🆕 Validação leve dos campos novos — inválido vira warning, não erro
    let finalImperfectionId = null;
    if (imperfectionId) {
      if (IMPERFECTION_CAMERA_DIRECTIVES[imperfectionId]) {
        finalImperfectionId = imperfectionId;
      } else {
        console.warn(`[pov-kling-prompts v2.0] Invalid imperfectionId "${imperfectionId}" — ignored.`);
      }
    }

    let finalMotionIntensity = null;
    if (motionIntensity !== null && motionIntensity !== undefined) {
      const mi = Number(motionIntensity);
      if (Number.isFinite(mi) && mi >= 1 && mi <= 5) {
        finalMotionIntensity = Math.round(mi);
      } else {
        console.warn(`[pov-kling-prompts v2.0] Invalid motionIntensity "${motionIntensity}" — ignored (expected 1-5).`);
      }
    }

    let finalSecondaryObjects = [];
    if (Array.isArray(secondaryObjects)) {
      finalSecondaryObjects = secondaryObjects
        .filter((o) => typeof o === 'string' && o.trim())
        .map((o) => o.trim());
    }

    // Naturalidade extra é desabilitada se a imperfeição já a inclui
    const naturalExtraActive =
      naturalExtra === true && !IMPERFECTION_DISABLES_NATURALITY.has(finalImperfectionId);

    // ── Resolve hands hint ───────────────────────────────────────────
    let handsHint;
    if (handsConfig.mode === 'anonymous') {
      const hh = HANDS_PROMPT_HINTS[handsConfig.handsId];
      if (!hh) {
        return res.status(400).json({ error: `invalid handsConfig.handsId "${handsConfig.handsId}"` });
      }
      handsHint = hh;
    } else {
      // mode='influencer' — usa skinDescription se vier, senão genérico do gênero
      const gender = handsConfig.gender || 'female';
      const generic = gender === 'male'
        ? 'Natural masculine hands consistent with the influencer profile, well-groomed short nails, defined fingers, neutral natural styling.'
        : 'Natural feminine hands consistent with the influencer profile, well-groomed nails, smooth skin, neutral natural styling.';
      handsHint = handsConfig.skinDescription
        ? `Hands consistent with the influencer profile: ${handsConfig.skinDescription}`
        : generic;
    }

    const totalTakes = script.length;
    const typeHint = TYPE_PROMPT_HINTS[typeId];
    const scenarioHint = SCENARIO_PROMPT_HINTS[scenarioId];
    const styleDirective = STYLE_CAMERA_DIRECTIVES[styleId];
    const imperfectionDirective = finalImperfectionId
      ? IMPERFECTION_CAMERA_DIRECTIVES[finalImperfectionId]
      : null;

    // ── Monta prompt ─────────────────────────────────────────────────
    const scriptSummary = script.map((t, i) => {
      const purpose = t.purpose || (i === 0 ? 'hook' : i === totalTakes - 1 ? 'cta' : 'demo');
      const onScreen = t.onScreenPhrase ? ` | on-screen: "${t.onScreenPhrase}"` : '';
      const voice = t.voiceText ? ` | spoken: "${t.voiceText.replace(/\[[^\]]+\]/g, '').trim()}"` : '';
      return `Take ${t.takeNumber || i + 1} (${purpose})${voice}${onScreen}`;
    }).join('\n');

    // 🆕 Building blocks condicionais (Plano v4)
    const imperfectionBlock = imperfectionDirective
      ? `\n\n[IMPERFECTION STYLE]: ${imperfectionDirective}`
      : '';
    const naturalExtraBlock = naturalExtraActive
      ? `\n\n[NATURALITY EXTRA]: ${NATURALITY_EXTRA_DIRECTIVE}`
      : '';
    const motionIntensityBlock = finalMotionIntensity
      ? `\n\n[MOTION INTENSITY]: ${finalMotionIntensity}/5 — ${
          finalMotionIntensity <= 2
            ? 'contemplative, minimal body movement, focus on subtle gestures'
            : finalMotionIntensity === 3
            ? 'moderate body movement, clear gestures with intentional pacing'
            : 'dynamic, energetic body movement, strong kinetic presence'
        }.`
      : '';
    const secondaryObjectsBlock = finalSecondaryObjects.length > 0
      ? `\n\n[SECONDARY OBJECTS]: weave these contextual elements naturally into the background of the take (softly out of focus, NEVER competing with the product): ${finalSecondaryObjects.join(', ')}.`
      : '';

    // 🆕 Regras adicionais sobre fidelidade do produto (Solução B)
    const productFidelityRules = `

PRODUCT FIDELITY (CRITICAL):
- The product appearance must remain IDENTICAL to the base image: same exact design, label text, color, shape, materials, and branding.
- Motion must NOT distort, modify, recolor, restyle, or invent new details on the product.
- Each prompt MUST begin with: "Preserve the product exactly as shown in the base image. No changes to design, label, color, shape, or branding during motion."
- If the base image shows a specific product orientation/state, motion should keep it visually consistent.`;

    const systemPrompt = `You generate cinematic image-to-video prompts in ENGLISH for the Kling v3 Standard model on fal.ai.

Each prompt animates a static base image (already prepared by Nano Banana Pro) for 15 seconds. Your job is to describe the MOTION/ACTION that should happen in those 15 seconds, anchored on the existing visual context.

You will write ${totalTakes} prompts — one per take — that together tell a coherent micro-story about a product, in TikTok POV style.

REUSABLE BUILDING BLOCKS (use these as anchors, integrated into fluent English — do NOT paste verbatim):

[HANDS]: ${handsHint}

[TYPE INTERACTION]: ${typeHint}

[CAMERA STYLE]: ${styleDirective}

[ENVIRONMENT]: ${scenarioHint}${imperfectionBlock}${naturalExtraBlock}${motionIntensityBlock}${secondaryObjectsBlock}

PRODUCT: ${productName}${productDescription ? ` — ${productDescription}` : ''}

NARRATIVE FLOW (drives the difference between takes):
${scriptSummary}

RULES:
1. Each prompt: 60-150 words, fluent English, integrated (not bullet-style).
2. Each prompt focuses on the MOTION of THAT take. The base image already shows hands/product/scene.
3. Reference what's spoken or on-screen as visual cues, never literal text in frame.
4. Hook take → start with something that grabs attention (sudden gesture, light catch, anticipation).
5. Demo takes → progress the interaction (move, flip, apply, reveal another angle).
6. CTA take → final beat (settle, place down, hold, slight zoom out for closure).
7. Keep VISUAL CONSISTENCY across takes (same hands, same product, same scene). The PRODUCT specifically must be preserved exactly (see PRODUCT FIDELITY below).
8. NO speech transcription in the prompt. NO literal text overlays. NO logos invented.
9. Style: cinematic, smooth, real-time motion (not slow-mo unless style demands).
${imperfectionDirective ? '10. If IMPERFECTION STYLE is active, its camera cues take precedence over CAMERA STYLE for handheld/grain/focus behavior. Blend the two: CAMERA STYLE defines the angle/framing, IMPERFECTION defines the texture of motion.' : ''}
${naturalExtraActive ? '11. The NATURALITY EXTRA layer adds subtle handheld micro-shake on top of the chosen style.' : ''}
${finalSecondaryObjects.length > 0 ? '12. SECONDARY OBJECTS must appear in the background, NEVER in sharp focus, NEVER replacing or visually competing with the product. They add context, not attention.' : ''}${productFidelityRules}

RESPOND ONLY VALID JSON (no markdown, no backticks):
{
  "prompts": [
    ${Array.from({ length: totalTakes }, (_, i) => `{
      "takeNumber": ${i + 1},
      "purpose": "${script[i]?.purpose || (i === 0 ? 'hook' : i === totalTakes - 1 ? 'cta' : 'demo')}",
      "klingPrompt": "string in English, 60-150 words, MUST start with the fidelity sentence"
    }`).join(',\n    ')}
  ]
}`;

    const userText = `Generate the ${totalTakes} Kling v3 Standard motion prompts following the rules above.

${productPhotoBase64 ? 'Product photo attached above for visual reference.' : 'No product photo — work from the name and description.'}

Return ONLY the JSON.`;

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
      max_tokens: 4096, // 🆕 era 3072 — system prompt cresceu com Plano v4
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
      console.error(`[pov-kling-prompts v2.0] Anthropic error ${response.status}:`, errText.substring(0, 300));
      return res.status(response.status).json({
        error: `Anthropic error: ${response.status}`,
        details: errText.substring(0, 300),
      });
    }

    const data = await response.json();
    const text = data.content?.map((c) => c.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('[pov-kling-prompts v2.0] JSON parse error:', e.message, 'Raw:', clean.substring(0, 500));
      return res.status(500).json({
        error: 'Failed to parse Claude response as JSON',
        raw: clean.substring(0, 500),
      });
    }

    // ── Validação estrutural ─────────────────────────────────────────
    let prompts = Array.isArray(parsed.prompts) ? parsed.prompts : [];
    const errors = [];

    if (prompts.length !== totalTakes) {
      errors.push(`prompts length ${prompts.length} != expected ${totalTakes}`);
      while (prompts.length < totalTakes) {
        prompts.push({
          takeNumber: prompts.length + 1,
          purpose: prompts.length === 0 ? 'hook' : prompts.length === totalTakes - 1 ? 'cta' : 'demo',
          klingPrompt: `${typeHint} ${styleDirective} ${scenarioHint}`.substring(0, 600),
        });
      }
      prompts = prompts.slice(0, totalTakes);
    }

    prompts = prompts.map((p, idx) => {
      const takeNumber = idx + 1;
      const purpose = ['hook', 'demo', 'cta'].includes(p.purpose)
        ? p.purpose
        : (idx === 0 ? 'hook' : idx === totalTakes - 1 ? 'cta' : 'demo');
      let klingPrompt = typeof p.klingPrompt === 'string' ? p.klingPrompt.trim() : '';
      if (!klingPrompt || klingPrompt.length < 30) {
        klingPrompt = `${typeHint} ${styleDirective} ${scenarioHint}`;
        errors.push(`take ${takeNumber} klingPrompt too short, rebuilt from hints`);
      }

      // 🆕 Solução B: GARANTIR prefixo de fidelidade no início de cada prompt.
      // Se Claude já incluiu (porque o system prompt pede), não duplica.
      // Detecção case-insensitive em "preserve the product".
      if (!/preserve the product/i.test(klingPrompt)) {
        klingPrompt = FIDELITY_PREFIX + klingPrompt;
      }

      return { takeNumber, purpose, klingPrompt };
    });

    const featuresActive = [
      finalImperfectionId ? `imp=${finalImperfectionId}` : null,
      naturalExtraActive ? 'nat+' : null,
      finalMotionIntensity ? `mi=${finalMotionIntensity}` : null,
      finalSecondaryObjects.length > 0 ? `sec=${finalSecondaryObjects.length}` : null,
    ].filter(Boolean).join(',');

    console.log(
      `[pov-kling-prompts v2.0] OK: takes=${totalTakes}, type=${typeId}, scenario=${scenarioId}, style=${styleId}, hands=${handsConfig.mode}${featuresActive ? `, ${featuresActive}` : ''}${errors.length ? `, warnings=${errors.length}` : ''}`
    );

    return res.status(200).json({
      prompts,
      source: errors.length === 0 ? 'claude' : 'claude_partial',
      validationWarnings: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[pov-kling-prompts v2.0] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
