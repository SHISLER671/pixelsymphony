# PixelSymphony

> Your Normies are singing — tune in.

Standalone web app where Normie NFTs sing from **live on-chain pixels and traits**. Monochrome 90s Windows Media Player UI, 80s synthwave audio (Tone.js), Venice AI translation with deterministic fallback.

## Stack

- Next.js 16 · TypeScript · Tailwind · shadcn/ui
- wagmi + RainbowKit (mainnet) · Delegate.xyz
- Tone.js · Venice AI · [api.normies.art](https://api.normies.art)

## Setup

```bash
npm install
cp .env.example .env.local
# set VENICE_API_KEY, VENICE_BASE_URL, VENICE_MODEL
# and NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
npm run dev
```

### Venice AI

OpenAI-compatible client (`lib/venice-client.ts`) pointed at `https://api.venice.ai/api/v1`.

| Env | Purpose |
|-----|---------|
| `VENICE_API_KEY` | Server-only API key (never `NEXT_PUBLIC_`) |
| `VENICE_BASE_URL` | Default `https://api.venice.ai/api/v1` |
| `VENICE_MODEL` | Default `zai-org-glm-5-2` |
| `VENICE_ENABLED` | `false` forces fallback-only (no inference) |
| `VENICE_LIMIT_PER_IP_HOUR` | Default `2` Venice calls / IP / hour |
| `VENICE_LIMIT_PER_IP_DAY` | Default `5` Venice calls / IP / day |
| `VENICE_LIMIT_GLOBAL_DAY` | Default `40` Venice calls / day (all users) |
| `VENICE_CACHE_HOURS` | Cache AI scores for the same selection (default `6`) |

When a limit is hit the player still works — deterministic on-chain fallback
composes the song. Venice is an optional boost, not a hard dependency.

Smoke test (loads `.env.local`, does not print the full key):

```bash
node scripts/venice-smoke.mjs
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
