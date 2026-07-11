# PixelSymphony

> Your Normies are singing — tune into the hive.

Standalone web app where Normie NFTs sing from **live on-chain pixels and traits**. Monochrome 90s Windows Media Player UI, 80s synthwave audio (Tone.js), Venice AI translation with deterministic fallback.

## Stack

- Next.js 16 · TypeScript · Tailwind · shadcn/ui
- wagmi + RainbowKit (mainnet) · Delegate.xyz
- Tone.js · Venice AI · [api.normies.art](https://api.normies.art)

## Setup

```bash
npm install
cp .env.example .env.local
# set VENICE_API_KEY and NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Authentic data only** — 40×40 pixels + traits from the Normies API
- **Max 3 voices** — 1 primary + up to 2 harmony/counter
- **Token-gating** — holders + Delegate.xyz; sample mode for everyone
- **Skins** — Classic 90s, Minimal, CRT Scanline, Pixel Forest
- **Share Blip** — record audio + download; X intent; TikTok upload hint
- **Fallback score** — deterministic JS mapping if Venice is down

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npx vercel` | Deploy to Vercel |

Set `VENICE_API_KEY` and `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in the Vercel project env.

## License

Private / community project for Normies holders.
