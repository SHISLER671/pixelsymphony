"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { useAccount } from "wagmi"

import { ConnectWallet } from "@/components/ConnectWallet"
import { LoadingIcon } from "@/components/LoadingIcon"
import { Player } from "@/components/Player"
import { resolveAccessibleNormiesDetailed } from "@/lib/ownership"
import { SAMPLE_NORMIE_IDS } from "@/lib/types"

function PlayerPageInner() {
  const searchParams = useSearchParams()
  const sampleMode = searchParams.get("sample") === "1"
  const { address, isConnected, isConnecting } = useAccount()

  const [owned, setOwned] = useState<number[]>([])
  const [delegated, setDelegated] = useState<number[]>([])
  const [ids, setIds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [delegateHints, setDelegateHints] = useState<string[]>([])

  useEffect(() => {
    if (sampleMode) {
      setIds([...SAMPLE_NORMIE_IDS])
      setOwned([...SAMPLE_NORMIE_IDS])
      setDelegated([])
      setLoading(false)
      setError(null)
      setDelegateHints([])
      return
    }

    if (!isConnected || !address) {
      setIds([])
      setOwned([])
      setDelegated([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    resolveAccessibleNormiesDetailed(address)
      .then((result) => {
        if (cancelled) return
        setOwned(result.owned)
        setDelegated(result.delegated)
        setIds(result.all)
        setDelegateHints(result.errors)
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) {
          setError("Could not load your Normies")
          setIds([])
          setOwned([])
          setDelegated([])
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
            Token-gated for Normie holders and Delegate.xyz hot wallets (v1 +
            v2). Or try sample mode with live on-chain demo Normies.
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
            This wallet doesn&apos;t own Normies and no Delegate.xyz grants
            resolved (checked v1 + v2 registry for ALL / collection / token).
            Try sample mode to hear them sing.
          </p>
          {delegateHints.length > 0 && (
            <p className="text-[10px] text-muted-foreground/80">
              {delegateHints.join(" · ")}
            </p>
          )}
          <Link href="/player?sample=1" className="btn-retro btn-retro-active">
            Sample mode
          </Link>
        </div>
      ) : (
        <>
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Owned {owned.length} · Delegated {delegated.length} · Total{" "}
            {ids.length}
          </p>
          <Player
            availableIds={ids}
            initialSelected={ids.slice(0, 1)}
            sampleMode={false}
          />
        </>
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
