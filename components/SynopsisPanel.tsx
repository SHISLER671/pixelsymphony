"use client"

import type { NormieVoiceInput, VoiceScore } from "@/lib/types"
import { cn } from "@/lib/utils"

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
      <div className={cn("bevel-inset p-3 text-xs text-muted-foreground", className)}>
        Synopsis will appear once your Normies start singing.
      </div>
    )
  }

  return (
    <div className={cn("bevel-inset space-y-3 p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Synopsis
        </h3>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
            score.source === "venice"
              ? "bg-primary/20 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {score.source === "venice" ? "Venice" : "Fallback"}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{score.synopsis}</p>
      <div className="flex flex-wrap gap-1.5">
        <Chip>
          {score.bpm} BPM · {score.root} {score.scale}
        </Chip>
        {voices.flatMap((v) =>
          v.traits.slice(0, 6).map((t) => (
            <Chip key={`${v.tokenId}-${t.trait_type}`}>
              #{v.tokenId} {t.trait_type}: {String(t.value)}
            </Chip>
          )),
        )}
      </div>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bevel border-0 bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
      {children}
    </span>
  )
}
