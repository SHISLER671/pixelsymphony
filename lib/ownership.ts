import type { Address } from "viem"

export interface AccessibleNormiesResult {
  owned: number[]
  delegated: number[]
  all: number[]
  errors: string[]
}

/**
 * Client: resolve owned + Delegate.xyz-accessible Normies via server route
 * (on-chain registry reads happen server-side — no browser RPC CORS issues).
 */
export async function resolveAccessibleNormies(
  wallet: string,
): Promise<number[]> {
  const result = await resolveAccessibleNormiesDetailed(wallet)
  return result.all
}

export async function resolveAccessibleNormiesDetailed(
  wallet: string,
): Promise<AccessibleNormiesResult> {
  const res = await fetch(
    `/api/delegates?address=${encodeURIComponent(wallet)}`,
  )
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Delegate resolve failed (${res.status}): ${body.slice(0, 120)}`)
  }
  const data = (await res.json()) as {
    owned?: number[]
    delegated?: number[]
    all?: number[]
    errors?: string[]
  }
  const owned = data.owned ?? []
  const delegated = data.delegated ?? []
  const all =
    data.all ??
    Array.from(new Set([...owned, ...delegated])).sort((a, b) => a - b)
  return {
    owned,
    delegated,
    all,
    errors: data.errors ?? [],
  }
}

export type { Address }
