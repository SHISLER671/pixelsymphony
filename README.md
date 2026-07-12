# PixelSymphony

> Your Normies are singing — tune in.

**Live:** [pixelsymphony.vercel.app](https://pixelsymphony.vercel.app)

Standalone web app where [Normies](https://www.normies.art/) NFTs **sing from live on-chain pixels and traits**. Monochrome 90s Windows Media Player UI, forest-style synth via [Tone.js](https://tonejs.github.io/) — **no AI interpretation**.

---

## What it does

| | |
|--|--|
| **Voice** | Deterministic map: 40×40 bitmap + traits → arrangement |
| **Wallet** | Optional. Read-only ownership + [Delegate.xyz](https://delegate.xyz/) (no spends / transfers) |
| **Sample** | Listen without a wallet (`/player?sample=1`) |
| **Share** | Save Blip as WAV; Share on X (H.264 MP4); mobile share sheet (X / IG / FB / TikTok) |

---

## How the voice works

Humans hear a Normie through fixed rules in the browser — not a model “deciding” meaning:

1. Fetch the NFT’s **40×40 pixel string** and **traits** from [api.normies.art](https://api.normies.art).
2. **Pixels** → tempo, rhythm density, pitch contour (Canvas edits change the song).
3. **Traits** → instrument family + phrasing / filter (Type, Expression, Age, Eyes, etc.).
4. **Tone.js** plays the loop. One Normie = full mini-band; more = layered forest mix.

Same on-chain input → same composition rules.

---

## Stack

- **Next.js 16** · TypeScript · Tailwind · shadcn/ui  
- **wagmi** + **RainbowKit** (Ethereum mainnet)  
- **Tone.js** · **viem**  
- Normies API proxy · Delegate.xyz registry (v1 + v2)

---

## Setup

```bash
git clone https://github.com/SHISLER671/pixelsymphony.git
cd pixelsymphony
npm install
cp .env.example .env.local
```

Edit `.env.local`:

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | For connect | [cloud.walletconnect.com](https://cloud.walletconnect.com) |
| `NEXT_PUBLIC_APP_URL` | Recommended | e.g. `http://localhost:3000` or prod URL |
| `NEXT_PUBLIC_RPC_URL` | Optional | CORS-friendly mainnet RPC |

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Wallet safety:** Connecting only discovers Normies you own or control. The app does not request approvals, transfers, or writes. Sample mode needs no wallet.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npx vercel` | Deploy / link Vercel |

---

## Project map

```
app/
  page.tsx              # Landing
  player/page.tsx       # Token gate + sample mode
  api/normies/          # Proxy → api.normies.art
  api/delegates/        # Ownership + Delegate.xyz
components/
  Player.tsx            # Stage UI, drawers, transport
  Visualizer.tsx        # Pixel stage
  BlipShare.tsx         # WAV / X / mobile share
  WalletSafetyNote.tsx  # Read-only connect copy
lib/
  compose.ts / fallback.ts   # Pixel+trait → score
  audio.ts                   # Tone.js engine + offline WAV
  twitter-mp4.ts             # H.264 share video
  ownership.ts / normies.ts  # Data layer
```

---

## Features (quick list)

- Stage-centered 90s WMP chrome (clickable drawers, CRT stage)
- Skins: Classic 90s, Minimal, CRT Scanline, Pixel Forest
- ALL voices / multi-Normie forest mix
- Share Blip (WAV) · Share on X (MP4) · mobile OS share sheet
- Synopsis + “how you hear them” signal path

---

## Repo

- **GitHub:** [SHISLER671/pixelsymphony](https://github.com/SHISLER671/pixelsymphony)
- **Production:** [pixelsymphony.vercel.app](https://pixelsymphony.vercel.app)

Built for Normies holders and the curious. Tune in.
