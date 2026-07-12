import Link from "next/link"
import Image from "next/image"

import { ConnectWallet } from "@/components/ConnectWallet"

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="bevel w-full max-w-lg space-y-7 p-6 text-center sm:p-8">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/normie-logo.svg"
            alt="PixelSymphony"
            width={80}
            height={80}
            className="normie-pulse"
            style={{ imageRendering: "pixelated" }}
            priority
          />
          <div>
            <h1 className="text-lg font-bold uppercase tracking-[0.3em] text-primary sm:text-xl">
              PixelSymphony
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">
              Your Normies are singing — one voice is a song, the forest is a
              network.
            </p>
          </div>
        </div>

        <div className="space-y-3 text-left text-xs leading-relaxed text-muted-foreground">
          <p>
            A monochrome 90s media player for{" "}
            <span className="text-foreground/85">Normies</span> on Ethereum.
            Every loop is composed from live on-chain pixels and traits — no
            canned tracks, no fake data.
          </p>
          <p>
            Drop in a single Normie and hear a full arrangement: lead, pad,
            bass, and harmony from that one face. Add more and they answer each
            other like mycelium — signals across the soil, not a wall of noise.
          </p>
          <p>
            Holders and Delegate.xyz hot wallets welcome. Not a holder? Sample
            mode still plays real on-chain Normies.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <ConnectWallet />
          <Link
            href="/player"
            className="btn-retro btn-retro-active w-full max-w-xs text-center"
          >
            Enter Player
          </Link>
          <Link
            href="/player?sample=1"
            className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            Sample mode · no wallet needed
          </Link>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground/70">
          Authentic pixels only · skins · share a Blip · tune into the hive
        </p>
      </div>
    </main>
  )
}
