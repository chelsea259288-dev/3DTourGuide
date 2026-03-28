# 3DTourGuide

Interactive 3D tours with **React**, **Three.js**, optional **Google Photorealistic 3D Tiles**, and local **glTF** scenes.

## Develop

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in keys as needed (see comments in `.env.example`).

## Deploy

Configured for [Vercel](https://vercel.com): production URL is tied to the linked project. Large models under `public/models` are excluded from the default cloud build; use `VITE_MODEL_CDN_BASE` or rely on Google Tiles when `VITE_GOOGLE_MAPS_API_KEY` is set.
