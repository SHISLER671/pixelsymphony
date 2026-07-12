/** Main Normies ERC-721 collection on Ethereum */
export const NORMIES_NFT =
  "0x9eb6e2025b64f340691e424b7fe7022ffde12438" as const

export const NORMIES_API_BASE = "https://api.normies.art"

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const

/**
 * Delegate.xyz Registry v1 (legacy).
 * Kept so older cold-wallet grants still resolve.
 */
export const DELEGATE_REGISTRY_V1 =
  "0x00000000000076A84feF008CDAbe6409d2FE638B" as const

/** @deprecated use DELEGATE_REGISTRY_V1 / V2 */
export const DELEGATE_REGISTRY = DELEGATE_REGISTRY_V1

/**
 * Delegate.xyz Registry v2 (current docs).
 * https://docs.delegate.xyz/technical-documentation/delegate-registry/contract-addresses
 */
export const DELEGATE_REGISTRY_V2 =
  "0x00000000000000447e69651d841bD8D104Bed493" as const

export const DELEGATE_REGISTRY_V1_ABI = [
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

/** @deprecated alias */
export const DELEGATE_REGISTRY_ABI = DELEGATE_REGISTRY_V1_ABI

/**
 * v2 DelegationType enum:
 * NONE=0, ALL=1, CONTRACT=2, ERC721=3, ERC20=4, ERC1155=5
 */
export const DELEGATE_REGISTRY_V2_ABI = [
  {
    inputs: [{ name: "to", type: "address" }],
    name: "getIncomingDelegations",
    outputs: [
      {
        components: [
          { name: "type_", type: "uint8" },
          { name: "to", type: "address" },
          { name: "from", type: "address" },
          { name: "rights", type: "bytes32" },
          { name: "contract_", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "amount", type: "uint256" },
        ],
        name: "delegations",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const

export const DelegationTypeV2 = {
  NONE: 0,
  ALL: 1,
  CONTRACT: 2,
  ERC721: 3,
  ERC20: 4,
  ERC1155: 5,
} as const

/** CORS-friendly public mainnet RPC for server reads */
export const DEFAULT_RPC_URL = "https://ethereum.publicnode.com"
