import Link from "next/link"
import Image from "next/image"

import { ConnectWallet } from "@/components/ConnectWallet"

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="bevel w-full max-w-md space-y-8 p-6 text-center sm:p-8">
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
              Your Normies are singing — tune into the hive.
            </p>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Standalone monochrome player. Music from live on-chain 40×40 pixels and
          traits. Max three voices. Delegate signers welcome.
        </p>

        <div className="flex flex-col items-center gap-3">
          <ConnectWallet />
          <Link href="/player" className="btn-retro btn-retro-active w-full max-w-xs text-center">
            Enter Player
          </Link>
          <Link
            href="/player?sample=1"
            className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            Sample mode (no wallet)
          </Link>
        </div>

        <p className="text-[10px] text-muted-foreground/70">
          Authentic data only · Normies · Ethereum
        </p>
      </div>
    </main>
  )
}
