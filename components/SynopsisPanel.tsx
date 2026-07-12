"use client"

import { useMemo } from "react"

import type { NormieVoiceInput, VoiceScore } from "@/lib/types"
import { buildSynopsisStory } from "@/lib/synopsis"
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
  const story = useMemo(
    () => (score ? buildSynopsisStory(score, voices) : null),
    [score, voices],
  )

  if (!score || !story) {
    return (
      <div
        className={cn(
          "bevel-inset p-4 text-xs text-muted-foreground",
          className,
        )}
      >
        Play a Normie and the synopsis will explain — in plain language — how
        its pixels and traits became this song.
      </div>
    )
  }

  return (
    <div className={cn("bevel-inset space-y-4 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Synopsis
          </h3>
          <p className="text-base font-medium leading-snug text-primary">
            {story.headline}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {story.vibe}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
            score.source === "venice"
              ? "bg-primary/20 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {score.source === "venice" ? "Venice" : "On-chain mix"}
        </span>
      </div>

      {/* Meta strip */}
      <div className="flex flex-wrap gap-2">
        <MetaChip>{story.meta.bpm} BPM</MetaChip>
        <MetaChip>
          {story.meta.key} {story.meta.scale}
        </MetaChip>
        <MetaChip>
          {voices.length} {voices.length === 1 ? "Normie" : "Normies"}
        </MetaChip>
      </div>

      {/* Natural prose */}
      <div className="space-y-2.5 border-t border-border/60 pt-3">
        {story.paragraphs.map((p, i) => (
          <p
            key={i}
            className="text-sm leading-relaxed text-foreground/90"
          >
            {p}
          </p>
        ))}
      </div>

      {/* Cast / instruments */}
      {story.cast.length > 0 && (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Who&apos;s playing
          </h4>
          <ul className="space-y-1.5">
            {story.cast.map((c, i) => (
              <li
                key={`${c.name}-${c.role}-${i}`}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
              >
                <span className="text-primary">{c.role}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-foreground/90">{c.instrument}</span>
                <span className="text-[11px] text-muted-foreground">
                  ({c.name})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Trait influences */}
      {story.influences.length > 0 && (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            How traits shape the sound
          </h4>
          <dl className="space-y-2">
            {story.influences.map((inf) => (
              <div key={`${inf.trait}-${inf.value}`} className="text-sm">
                <dt className="inline font-medium text-primary">
                  {inf.trait}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {inf.value}
                  </span>
                </dt>
                <dd className="mt-0.5 text-foreground/85 leading-relaxed">
                  {inf.effect}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bevel border-0 bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary-foreground">
      {children}
    </span>
  )
}
