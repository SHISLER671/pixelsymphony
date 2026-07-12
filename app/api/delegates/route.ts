import { NextRequest, NextResponse } from "next/server"
import { createPublicClient, getAddress, http, isAddress, type Address } from "viem"
import { mainnet } from "viem/chains"

import {
  DEFAULT_RPC_URL,
  DELEGATE_REGISTRY_V1,
  DELEGATE_REGISTRY_V1_ABI,
  DELEGATE_REGISTRY_V2,
  DELEGATE_REGISTRY_V2_ABI,
  DelegationTypeV2,
  NORMIES_API_BASE,
  NORMIES_NFT,
  ZERO_ADDRESS,
} from "@/lib/contracts"

export const runtime = "nodejs"

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC_URL),
})

async function fetchHolderIds(address: string): Promise<number[]> {
  try {
    const res = await fetch(`${NORMIES_API_BASE}/holders/${address}`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { tokenIds?: Array<number | string> }
    return (data.tokenIds ?? [])
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 9999)
  } catch {
    return []
  }
}

function isNormiesContract(addr: string): boolean {
  return addr?.toLowerCase() === NORMIES_NFT.toLowerCase()
}

function isZero(addr: string): boolean {
  return !addr || addr.toLowerCase() === ZERO_ADDRESS.toLowerCase()
}

async function fromV2(wallet: Address): Promise<{ ids: number[]; error?: string }> {
  try {
    const rows = (await publicClient.readContract({
      address: DELEGATE_REGISTRY_V2,
      abi: DELEGATE_REGISTRY_V2_ABI,
      functionName: "getIncomingDelegations",
      args: [wallet],
    })) as Array<{
      type_: number
      to: string
      from: string
      rights: string
      contract_: string
      tokenId: bigint
      amount: bigint
    }>

    const tokenIds = new Set<number>()
    const vaultsToExpand = new Set<string>()

    for (const d of rows) {
      const type = Number(d.type_)
      const from = d.from
      const contract_ = d.contract_

      if (type === DelegationTypeV2.ALL) {
        // Entire cold wallet → all Normies owned by vault
        vaultsToExpand.add(from)
      } else if (type === DelegationTypeV2.CONTRACT) {
        if (isNormiesContract(contract_)) {
          vaultsToExpand.add(from)
        }
      } else if (type === DelegationTypeV2.ERC721) {
        if (isNormiesContract(contract_)) {
          const id = Number(d.tokenId)
          if (Number.isFinite(id) && id >= 0 && id <= 9999) tokenIds.add(id)
        }
      }
      // ERC20 / ERC1155 ignored for Normies ERC721 gating
    }

    for (const vault of vaultsToExpand) {
      try {
        const ids = await fetchHolderIds(getAddress(vault))
        for (const id of ids) tokenIds.add(id)
      } catch {
        // skip vault
      }
    }

    return { ids: Array.from(tokenIds) }
  } catch (err) {
    return { ids: [], error: `v2: ${err instanceof Error ? err.message : String(err)}` }
  }
}

async function fromV1(wallet: Address): Promise<{ ids: number[]; error?: string }> {
  try {
    const rows = (await publicClient.readContract({
      address: DELEGATE_REGISTRY_V1,
      abi: DELEGATE_REGISTRY_V1_ABI,
      functionName: "getDelegationsByDelegate",
      args: [wallet],
    })) as Array<{
      vault: string
      delegate: string
      contract_: string
      tokenId: bigint
      rights: string
    }>

    const tokenIds = new Set<number>()
    const vaultsToExpand = new Set<string>()

    for (const d of rows) {
      const contract_ = d.contract_
      // v1: contract 0x0 + tokenId 0 = entire wallet
      // v1: contract set + tokenId 0 = entire collection
      // v1: contract + tokenId = single token
      if (isZero(contract_) && d.tokenId === BigInt(0)) {
        vaultsToExpand.add(d.vault)
      } else if (isNormiesContract(contract_) && d.tokenId === BigInt(0)) {
        vaultsToExpand.add(d.vault)
      } else if (isNormiesContract(contract_) && d.tokenId !== BigInt(0)) {
        const id = Number(d.tokenId)
        if (Number.isFinite(id) && id >= 0 && id <= 9999) tokenIds.add(id)
      }
    }

    for (const vault of vaultsToExpand) {
      try {
        const ids = await fetchHolderIds(getAddress(vault))
        for (const id of ids) tokenIds.add(id)
      } catch {
        // skip
      }
    }

    return { ids: Array.from(tokenIds) }
  } catch (err) {
    return { ids: [], error: `v1: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/**
 * GET /api/delegates?address=0x...
 * Returns owned + Delegate.xyz (v1+v2) accessible Normie token IDs.
 */
export async function GET(req: NextRequest) {
  const addressParam = req.nextUrl.searchParams.get("address")
  if (!addressParam || !isAddress(addressParam)) {
    return NextResponse.json(
      { error: "Valid address query param required" },
      { status: 400 },
    )
  }

  const wallet = getAddress(addressParam) as Address
  const errors: string[] = []

  const [owned, v2, v1] = await Promise.all([
    fetchHolderIds(wallet),
    fromV2(wallet),
    fromV1(wallet),
  ])

  if (v2.error) errors.push(v2.error)
  if (v1.error) errors.push(v1.error)

  const delegated = Array.from(new Set([...v2.ids, ...v1.ids])).sort(
    (a, b) => a - b,
  )
  const all = Array.from(new Set([...owned, ...delegated])).sort((a, b) => a - b)

  return NextResponse.json(
    {
      address: wallet,
      owned,
      delegated,
      all,
      errors,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  )
}
