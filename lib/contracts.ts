/** Main Normies ERC-721 collection on Ethereum */
export const NORMIES_NFT =
  "0x9eb6e2025b64f340691e424b7fe7022ffde12438" as const

export const NORMIES_API_BASE = "https://api.normies.art"

/**
 * Delegate.xyz Registry (v1)
 * Used to discover tokens delegated to the connected wallet (hot wallet pattern).
 */
export const DELEGATE_REGISTRY =
  "0x00000000000076A84feF008CDAbe6409d2FE638B" as const

export const DELEGATE_REGISTRY_ABI = [
  {
    inputs: [{ name: "to", type: "address" }],
    name: "getDelegationsByDelegate",
    outputs: [
      {
        components: [
          { name: "vault", type: "address" },
          { name: "delegate", type: "address" },
          { name: "contract_", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "rights", type: "bytes32" },
        ],
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const

/** CORS-friendly public mainnet RPC for browser + server reads */
export const DEFAULT_RPC_URL = "https://ethereum.publicnode.com"
