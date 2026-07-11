"use client"

import { useEffect, useRef } from "react"

import type { NormieVoiceInput, SkinId } from "@/lib/types"
import { cn } from "@/lib/utils"

function skinColors(skin: SkinId): { on: string; off: string; glow: string } {
  switch (skin) {
    case "crt":
      return { on: "#39ff14", off: "#0a1a0a", glow: "rgba(57,255,20,0.5)" }
    case "pixel-forest":
      return { on: "#50c878", off: "#0d1f14", glow: "rgba(80,200,120,0.45)" }
    case "minimal":
      return { on: "#ffffff", off: "#1a1a1a", glow: "rgba(255,255,255,0.2)" }
    case "classic":
    default:
      return { on: "#c8c8c8", off: "#2a2a2a", glow: "rgba(255,255,255,0.35)" }
  }
}

export function Visualizer({
  voices,
  skin,
  progress = 0,
  className,
}: {
  voices: NormieVoiceInput[]
  skin: SkinId
  progress?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const colors = skinColors(skin)
    const cell = 4
    const gap = 1
    const pad = 8
    const gridW = 40 * (cell + gap)
    const n = Math.max(voices.length, 1)
    const gridH = 40 * (cell + gap)
    const totalW = pad * 2 + n * gridW + (n - 1) * 16
    const totalH = pad * 2 + gridH + 24

    canvas.width = totalW
    canvas.height = totalH

    ctx.fillStyle = "#000000"
    ctx.fillRect(0, 0, totalW, totalH)

    voices.forEach((voice, vi) => {
      const ox = pad + vi * (gridW + 16)
      const oy = pad

      // label
      ctx.fillStyle = "#777777"
      ctx.font = "10px monospace"
      ctx.fillText(
        `#${voice.tokenId} ${voice.role}`,
        ox,
        totalH - 8,
      )

      const pixels = voice.pixels
      const pulseRow = Math.floor(progress * 40) % 40

      for (let y = 0; y < 40; y++) {
        for (let x = 0; x < 40; x++) {
          const on = pixels[y * 40 + x] === "1"
          const px = ox + x * (cell + gap)
          const py = oy + y * (cell + gap)

          if (on) {
            const nearPulse = Math.abs(y - pulseRow) <= 1
            ctx.fillStyle = nearPulse ? colors.on : colors.on
            ctx.globalAlpha = nearPulse ? 1 : 0.85
            ctx.fillRect(px, py, cell, cell)
            if (nearPulse) {
              ctx.shadowColor = colors.glow
              ctx.shadowBlur = 4
              ctx.fillRect(px, py, cell, cell)
              ctx.shadowBlur = 0
            }
            ctx.globalAlpha = 1
          } else {
            ctx.fillStyle = colors.off
            ctx.fillRect(px, py, cell, cell)
          }
        }
      }

      // progress bar under grid
      ctx.fillStyle = "#222"
      ctx.fillRect(ox, oy + gridH + 4, gridW, 3)
      ctx.fillStyle = colors.on
      ctx.fillRect(ox, oy + gridH + 4, gridW * progress, 3)
    })

    if (voices.length === 0) {
      ctx.fillStyle = "#555"
      ctx.font = "12px monospace"
      ctx.fillText("Select a Normie to visualize", pad, totalH / 2)
    }
  }, [voices, skin, progress])

  return (
    <div
      className={cn(
        "bevel-inset relative overflow-hidden",
        skin === "crt" && "crt-scanlines",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        className="mx-auto block max-w-full"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  )
}
