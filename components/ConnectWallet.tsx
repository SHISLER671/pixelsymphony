"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Wallet } from "lucide-react"

export function ConnectWallet() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted
        const connected = ready && account && chain

        return (
          <div
            aria-hidden={!ready}
            className={!ready ? "pointer-events-none opacity-0" : undefined}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className="btn-retro inline-flex items-center gap-2"
                  >
                    <Wallet className="size-4" />
                    Connect
                  </button>
                )
              }

              if (chain.unsupported) {
                return (
                  <button
                    type="button"
                    onClick={openChainModal}
                    className="btn-retro text-destructive"
                  >
                    Wrong network
                  </button>
                )
              }

              return (
                <button
                  type="button"
                  onClick={openAccountModal}
                  className="btn-retro btn-retro-active inline-flex items-center gap-2"
                >
                  <span
                    className="size-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--glow)]"
                    aria-hidden
                  />
                  {account.ensName || account.displayName}
                </button>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
