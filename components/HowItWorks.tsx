"use client"

import { cn } from "@/lib/utils"

/**
 * Explains that humans hear a Normie via deterministic mapping —
 * live on-chain pixels + traits → music engine. No AI interpretation.
 */
export function HowItWorks({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "space-y-3 border border-[#333] bg-[#0d0d0d] p-4 font-mono text-xs leading-relaxed text-[#aaa]",
        className,
      )}
    >
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-white">
        How you hear a Normie
      </h3>
      <p>
        The NFT isn&apos;t running a model in your browser.{" "}
        <span className="text-[#ccc]">
          PixelSymphony reads the same live data you see on-chain
        </span>{" "}
        — the 40×40 pixel bitmap and trait labels from the Normies API — then
        maps that data into sound with fixed rules (Tone.js). Same Normie → same
        rules → a voice you can trust.
      </p>

      <ul className="space-y-2 border-l border-[#333] pl-3">
        <li>
          <span className="text-white">Pixels</span> — density sets tempo;
          row energy drives when notes fire; shape/contour moves pitch. Canvas
          edits change the bitmap → the song changes even if traits stay the
          same.
        </li>
        <li>
          <span className="text-white">Traits</span> — Type / Accessory pick
          the instrument family; Expression, Age, Eyes, Hair, Facial shape
          phrasing, filter, and feel (how it sounds, not a random AI mood).
        </li>
        <li>
          <span className="text-white">Arrangement</span> — one Normie is a
          full mini-band (lead, pad, bass, harmony). More Normies layer as
          answering voices in a shared loop — a forest network, not a canned
          track.
        </li>
      </ul>

      <p className="text-[10px] uppercase tracking-wide text-[#666]">
        No AI interpretation · authentic on-chain data only
      </p>
    </div>
  )
}
