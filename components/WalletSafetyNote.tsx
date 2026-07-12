import { cn } from "@/lib/utils"

/**
 * Plain-language reassurance: connection is for ownership reads only.
 * PixelSymphony does not request transfers, approvals, or spends.
 */
export function WalletSafetyNote({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border border-[#333] bg-[#0a0a0a] px-3 py-2.5 text-left font-mono text-[10px] leading-relaxed text-[#888]",
        className,
      )}
      role="note"
    >
      <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-[#aaa]">
        Wallet check · read-only
      </p>
      <p>
        Connecting only lets us{" "}
        <span className="text-[#ccc]">see which Normies you own or control</span>{" "}
        (including Delegate.xyz). We don&apos;t ask you to approve spends,
        transfers, or contract writes — if a wallet prompt looks like a
        transaction, cancel it. Prefer sample mode if you just want to listen.
      </p>
    </div>
  )
}
