"use client"

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { WagmiProvider } from "wagmi"

import { wagmiConfig } from "@/app/wagmi-config"
import { Toaster } from "@/components/ui/sonner"

import "@rainbow-me/rainbowkit/styles.css"

const monoTheme = darkTheme({
  accentColor: "#AAAAAA",
  accentColorForeground: "#000000",
  borderRadius: "small",
  fontStack: "system",
  overlayBlur: "small",
})

monoTheme.colors.modalBackground = "#111111"
monoTheme.colors.modalBorder = "#333333"
monoTheme.colors.profileForeground = "#111111"
monoTheme.colors.closeButtonBackground = "#222222"

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={monoTheme} modalSize="compact">
          {children}
          <Toaster theme="dark" position="bottom-center" richColors />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
