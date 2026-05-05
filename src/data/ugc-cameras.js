// src/data/ugc-cameras.js
//
// 7 posicionamentos de câmera pra aba UGC Falante (v3.0).
//
// CRITÉRIO: todos os ângulos mantêm o ROSTO da influencer visível
// (UGC Falante precisa de lip-sync, então POV first-person, overhead
// pura e outros que escondem o rosto FORAM EXCLUÍDOS dessa lista).
//
// Cada câmera tem:
//   - id: slug em snake_case
//   - name: nome em PT-BR pra UI
//   - description: frase curta pra UI (1 linha)
//   - cameraPrompt: texto em INGLÊS pro bloco [CAMERA] do prompt Veo 3.
//                   Esse mesmo prompt vai gerar os previews no Veo Studio
//                   Ultra (pendente na arquitetura — Marcos gera depois).
//   - framing: 'close' | 'medium' | 'wide' (distância da câmera)
//   - vibe: palavra-chave curta (energia/sensação) pra UI
//   - bestFor: exemplos PT-BR de quando usar (texto livre)

export const UGC_CAMERAS = [
  {
    id: 'selfie_eye_level',
    name: 'Selfie (altura dos olhos)',
    description: 'Câmera de mão, frontal, vibe casual e pessoal.',
    cameraPrompt: 'Handheld smartphone camera at eye level, held at arm\'s length by the subject as in a selfie. Subtle micro-movements typical of handheld recording. Frame: medium close-up showing head and upper shoulders.',
    framing: 'close',
    vibe: 'pessoal',
    bestFor: 'Beleza, conversas íntimas, confissões, dia-a-dia.',
  },
  {
    id: 'tripod_full_body',
    name: 'Tripé (corpo inteiro)',
    description: 'Câmera fixa, plano aberto, mostra a peça vestida.',
    cameraPrompt: 'Stable tripod-mounted camera, wide shot. Full body visible from head to feet. Subject stands at conversational distance from the camera, no handheld movement, framing centered.',
    framing: 'wide',
    vibe: 'apresentação',
    bestFor: 'Moda, calçados, fitness — quando o produto inteiro precisa aparecer.',
  },
  {
    id: 'close_up_face',
    name: 'Close-up no rosto',
    description: 'Zoom facial, foco em pele/expressão.',
    cameraPrompt: 'Close-up shot focused on the face. Frame includes head and upper shoulders only. Steady camera, slight natural depth of field, soft focus on the background.',
    framing: 'close',
    vibe: 'íntimo',
    bestFor: 'Skincare, maquiagem, perfumes, expressões emocionais.',
  },
  {
    id: 'over_the_shoulder',
    name: 'Over-the-shoulder',
    description: 'Câmera sobre o ombro, mostra interação com o produto.',
    cameraPrompt: 'Camera positioned slightly behind and above the subject\'s shoulder, looking forward toward the product or scene. Subject\'s face visible in 3/4 profile, hands and product clearly in frame.',
    framing: 'medium',
    vibe: 'demonstrativo',
    bestFor: 'Cozinha, hacks, demonstrações de uso, tutoriais.',
  },
  {
    id: 'mirror_reflection',
    name: 'Espelho (reflexo)',
    description: 'Câmera filma o reflexo no espelho — vibe getting-ready.',
    cameraPrompt: 'Camera positioned in front of a vanity or full-length mirror, capturing the subject\'s reflection. Phone visible in the frame as a natural part of the scene. Soft indoor lighting.',
    framing: 'medium',
    vibe: 'getting-ready',
    bestFor: 'Maquiagem, cabelos, OOTD, rotina de beleza.',
  },
  {
    id: 'three_quarter',
    name: '3/4 lateral',
    description: 'Ângulo lateral cinematográfico, dinâmico.',
    cameraPrompt: 'Camera positioned at a 3/4 angle to the subject, slight side view. Cinematic framing with depth and dimension. Subject\'s face turned slightly toward the camera, body partially in profile.',
    framing: 'medium',
    vibe: 'cinemático',
    bestFor: 'Lifestyle, storytelling, vídeos com narrativa.',
  },
  {
    id: 'mid_distance',
    name: 'Distância média',
    description: 'Cintura pra cima, conversa frontal direta.',
    cameraPrompt: 'Camera at mid-distance, framing the subject from waist up. Stable, slight handheld feel. Subject faces the camera directly in a natural conversational position.',
    framing: 'medium',
    vibe: 'conversa',
    bestFor: 'Autoridade, comparação, uso geral pra qualquer estilo.',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

export function getCameraById(id) {
  return UGC_CAMERAS.find((c) => c.id === id) || null;
}

export function getCamerasByFraming(framing) {
  return UGC_CAMERAS.filter((c) => c.framing === framing);
}

// Câmera default sugerida quando o usuário ainda não escolheu nada.
// 'mid_distance' funciona pra praticamente qualquer estilo, é o mais neutro.
export const DEFAULT_CAMERA_ID = 'mid_distance';

export function getDefaultCamera() {
  return getCameraById(DEFAULT_CAMERA_ID);
}
