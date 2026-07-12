# PixelSymphony

> Your Normies are singing — tune in.

Standalone web app where Normie NFTs sing from **live on-chain pixels and traits**. Monochrome 90s Windows Media Player UI, forest-style synth arrangements via Tone.js — **no AI interpretation**.

## Stack

- Next.js 16 · TypeScript · Tailwind · shadcn/ui
- wagmi + RainbowKit (mainnet) · Delegate.xyz
- Tone.js · [api.normies.art](https://api.normies.art)

## How the voice works

Humans hear a Normie through a **deterministic map** we built in the browser:

1. Fetch the NFT’s **40×40 pixel bitmap** and **traits** (live API / on-chain data).
2. **Pixels** drive tempo, rhythm density, and pitch contour.
3. **Traits** pick instrument family and shape articulation/filter (Type, Expression, Age, Eyes, etc.).
4. Tone.js plays the arrangement. Canvas edits change pixels → the song changes.

Same input → same rules → no model “deciding” what the NFT means.

## Setup

```bash
npm install
cp .env.example .env.local
# set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- Authentic data only — live Normies pixels + traits
- Solo = full mini-band; multi = forest network layers
- Token-gating + Delegate.xyz; sample mode for everyone
- Skins, Share Blip, monochrome WMP chrome

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npx vercel` | Deploy to Vercel |
