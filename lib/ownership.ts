import { createPublicClient, getAddress, http, type Address } from "viem"
import { mainnet } from "viem/chains"

import {
  DELEGATE_REGISTRY,
  DELEGATE_REGISTRY_ABI,
  DEFAULT_RPC_URL,
  NORMIES_NFT,
} from "@/lib/contracts"
import { fetchOwnedIds } from "@/lib/normies"

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(
    process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC_URL,
  ),
})

async function fetchDelegateXyzTokenIds(
  wallet: Address,
): Promise<number[]> {
  const delegatedIds: number[] = []

  try {
    const delegations = (await publicClient.readContract({
      address: DELEGATE_REGISTRY,
      abi: DELEGATE_REGISTRY_ABI,
      functionName: "getDelegationsByDelegate",
      args: [wallet],
    })) as Array<{
      vault: string
      delegate: string
      contract_: string
      tokenId: bigint
      rights: string
    }>

    const fullCollectionVaults: string[] = []

    for (const d of delegations) {
      if (d.contract_?.toLowerCase() !== NORMIES_NFT.toLowerCase()) continue

      if (d.tokenId === BigInt(0)) {
        fullCollectionVaults.push(d.vault)
      } else {
        const id = Number(d.tokenId)
        if (Number.isFinite(id)) delegatedIds.push(id)
      }
    }

    for (const vault of fullCollectionVaults) {
      try {
        const vaultAddr = getAddress(vault)
        const holders = await fetchOwnedIds(vaultAddr)
        delegatedIds.push(...holders)
      } catch {
        // vault enumeration may fail
      }
    }
  } catch {
    // registry failures are common on public RPCs
  }

  return delegatedIds
}

/** Owned + Delegate.xyz-accessible Normie token IDs for a wallet. */
export async function resolveAccessibleNormies(
  wallet: string,
): Promise<number[]> {
  const address = getAddress(wallet) as Address
  const [owned, delegated] = await Promise.all([
    fetchOwnedIds(address).catch(() => [] as number[]),
    fetchDelegateXyzTokenIds(address),
  ])

  const set = new Set<number>()
  for (const id of [...owned, ...delegated]) {
    if (id >= 0 && id <= 9999) set.add(id)
  }
  return Array.from(set).sort((a, b) => a - b)
}
