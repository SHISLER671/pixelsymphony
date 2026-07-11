"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { useAccount } from "wagmi"

import { ConnectWallet } from "@/components/ConnectWallet"
import { LoadingIcon } from "@/components/LoadingIcon"
import { Player } from "@/components/Player"
import { resolveAccessibleNormies } from "@/lib/ownership"
import { SAMPLE_NORMIE_IDS } from "@/lib/types"

function PlayerPageInner() {
  const searchParams = useSearchParams()
  const sampleMode = searchParams.get("sample") === "1"
  const { address, isConnected, isConnecting } = useAccount()

  const [ids, setIds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sampleMode) {
      setIds([...SAMPLE_NORMIE_IDS])
      setLoading(false)
      setError(null)
      return
    }

    if (!isConnected || !address) {
      setIds([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    resolveAccessibleNormies(address)
      .then((list) => {
        if (!cancelled) setIds(list)
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) {
          setError("Could not load your Normies")
          setIds([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [address, isConnected, sampleMode])

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/"
          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
        >
          ← PixelSymphony
        </Link>
        <div className="flex items-center gap-2">
          {!sampleMode && <ConnectWallet />}
          {sampleMode ? (
            <Link href="/player" className="btn-retro text-[10px]">
              Use wallet
            </Link>
          ) : (
            <Link href="/player?sample=1" className="btn-retro text-[10px]">
              Sample
            </Link>
          )}
        </div>
      </header>

      {sampleMode ? (
        <Player
          availableIds={[...SAMPLE_NORMIE_IDS]}
          initialSelected={[SAMPLE_NORMIE_IDS[0]]}
          sampleMode
        />
      ) : isConnecting || loading ? (
        <LoadingIcon label="Scanning wallet & delegates…" />
      ) : !isConnected ? (
        <div className="bevel space-y-4 p-6 text-center">
          <h2 className="text-sm uppercase tracking-[0.2em] text-primary">
            Connect to sing
          </h2>
          <p className="text-xs text-muted-foreground">
            Token-gated for Normie holders and Delegate.xyz hot wallets. Or try
            sample mode with live on-chain demo Normies.
          </p>
          <div className="flex flex-col items-center gap-3">
            <ConnectWallet />
            <Link href="/player?sample=1" className="btn-retro">
              Sample mode
            </Link>
          </div>
        </div>
      ) : error ? (
        <div className="bevel space-y-3 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Link href="/player?sample=1" className="btn-retro">
            Fall back to sample
          </Link>
        </div>
      ) : ids.length === 0 ? (
        <div className="bevel space-y-4 p-6 text-center">
          <h2 className="text-sm uppercase tracking-[0.2em] text-primary">
            No Normies found
          </h2>
          <p className="text-xs text-muted-foreground">
            This wallet doesn&apos;t own or control any Normies (including
            Delegate.xyz). Try sample mode to hear the hive.
          </p>
          <Link href="/player?sample=1" className="btn-retro btn-retro-active">
            Sample mode
          </Link>
        </div>
      ) : (
        <Player
          availableIds={ids}
          initialSelected={ids.slice(0, 1)}
          sampleMode={false}
        />
      )}
    </main>
  )
}

export default function PlayerPage() {
  return (
    <Suspense fallback={<LoadingIcon label="Loading player…" />}>
      <PlayerPageInner />
    </Suspense>
  )
}
