# Lígia UGC Studio v2.0

Painel completo de automação para criação de conteúdo UGC para TikTok Shop.

## ✨ Features

- **Influencers customizadas** — cadastre múltiplas modelos (Lígia vem pré-cadastrada)
- **System prompt v8.2 completo** — todas as regras sem cortar nada
- **Identidade dinâmica** — troca automaticamente conforme a influencer selecionada
- **Geração de imagem via fal.ai** (Nano Banana) — frontal + costas direto no app
- **Geração de vídeo via fal.ai** — escolha entre Kling 3.0, Veo 3 ou Grok Imagine
- **Conteúdo TikTok com 3 opções** — ganchos, detalhes, hashtags, descrição
- **Busca de tendências** — pesquisa hooks e hashtags trending antes de gerar textos
- **Prompt caching** — reduz custo do Claude em ~78%
- **Anti-repetição** — controla 3 vídeos por produto sem repetir conteúdo

## 🚀 Deploy no Vercel

### 1. API Keys necessárias

| Serviço | Onde pegar | Custo |
|---|---|---|
| Claude API | console.anthropic.com | ~$0.03/chamada (com cache) |
| fal.ai | fal.ai/dashboard | ~$0.02/imagem, $0.05-0.20/s vídeo |

### 2. Deploy

1. Suba para o GitHub
2. Acesse vercel.com → Add New Project
3. Em Environment Variables, adicione:
   - `ANTHROPIC_API_KEY` = sua chave Claude
   - `FAL_KEY` = sua chave fal.ai
4. Deploy

### 3. Rodar localmente

```bash
npm install
# Criar .env com suas chaves (copiar de .env.example)
npx vercel dev
```

## 📁 Estrutura

```
api/
  generate.js    — Claude proxy com prompt caching
  content.js     — Claude para textos TikTok (chamada separada)
  image.js       — fal.ai Nano Banana (geração de imagem)
  video.js       — fal.ai Kling/Veo3/Grok (geração de vídeo)
  video-status.js — polling de status do vídeo
  upload.js      — upload de imagem para fal.ai
  search.js      — busca de tendências TikTok
src/
  App.jsx         — App principal
  ProfileManager.jsx — Gestão de influencers
  systemPrompt.js — System prompt v8.2 completo + identidade dinâmica
  api.js          — Funções helper para todas as APIs
  styles.css      — Estilos
```

## 💰 Custo por vídeo

| Item | Custo |
|---|---|
| Claude (prompts visuais, com cache) | ~$0.03 |
| Claude (conteúdo TikTok) | ~$0.02 |
| Busca de tendências | ~$0.02 |
| 2x imagens Nano Banana | ~$0.04 |
| Vídeo (Kling 15s) | ~$0.84 |
| **Total** | **~$0.95** |

Com Grok Imagine (480p): ~$0.86/vídeo
