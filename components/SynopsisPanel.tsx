"use client"

import type { NormieVoiceInput, VoiceScore } from "@/lib/types"
import { cn } from "@/lib/utils"

function roleLabel(index: number): string {
  if (index === 0) return "Lead"
  if (index === 1) return "Harmony"
  if (index === 2) return "Counter"
  if (index % 3 === 0) return "Lead"
  if (index % 3 === 1) return "Harmony"
  return "Counter"
}

function traitLabels(voice: NormieVoiceInput): string[] {
  return voice.traits
    .filter((t) => !["Level", "Pixel Count", "Action Points", "Customized"].includes(t.trait_type))
    .slice(0, 6)
    .map((t) => `${t.trait_type}: ${t.value}`)
}

export function SynopsisPanel({
  score,
  voices,
  className,
}: {
  score: VoiceScore | null
  voices: NormieVoiceInput[]
  className?: string
}) {
  if (!score) {
    return (
      <div
        className={cn(
          "synopsis p-4 bg-[#111] border border-[#333] font-mono text-sm text-[#777]",
          className,
        )}
      >
        Select Normies and press Play — the forest will write itself here.
      </div>
    )
  }

  const key = `${score.root} ${score.scale}`
  const tempo = score.bpm
  const badge =
    score.source === "venice" ? "VENICE" : "ON-CHAIN"

  return (
    <div
      className={cn(
        "synopsis p-4 bg-[#111] border border-[#333] font-mono text-sm",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-white tracking-[0.2em]">SYNOPSIS</h3>
        <span
          className={cn(
            "px-2 py-1 text-xs",
            score.source === "venice"
              ? "bg-[#222] text-[#0f0]"
              : "bg-[#222] text-[#aaa]",
          )}
        >
          {badge}
        </span>
      </div>

      <p className="mb-4 text-[#aaa]">
        {voices.length === 0
          ? "Silence in the forest."
          : voices.length === 1
            ? `1 Normie singing in ${key} at ${tempo} BPM.`
            : `${voices.length} Normies singing together in ${key} at ${tempo} BPM.`}
      </p>

      <div className="space-y-6">
        {voices.map((normie, index) => {
          const type =
            normie.traits.find((t) => t.trait_type === "Type")?.value ??
            "Normie"
          const traits = traitLabels(normie)
          return (
            <div
              key={normie.tokenId}
              className="border-l-2 border-[#0f0]/50 pl-4"
            >
              <div className="mb-2 font-medium text-white">
                #{normie.tokenId} {String(type)} — {roleLabel(index)}
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {traits.map((trait, i) => (
                  <span
                    key={`${normie.tokenId}-${i}`}
                    className="rounded border border-[#444] bg-[#1a1a1a] px-3 py-1 text-[#ccc]"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
