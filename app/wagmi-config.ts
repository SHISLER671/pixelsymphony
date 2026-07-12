"use client"

import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { http } from "viem"
import { mainnet } from "wagmi/chains"

import { DEFAULT_RPC_URL } from "@/lib/contracts"

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "496bdf12e0267f014d4a8f92d305a9e8"

const appUrl =
  (typeof window !== "undefined" ? window.location.origin : undefined) ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000"

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC_URL

export const wagmiConfig = getDefaultConfig({
  appName: "PixelSymphony",
  appDescription: "Your Normies are singing — tune in.",
  appUrl,
  appIcon: `${appUrl}/normie-logo.svg`,
  projectId,
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(rpcUrl),
  },
  ssr: true,
})
