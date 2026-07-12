"use client"

import { Download, Share2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import * as audio from "@/lib/audio"
import { downloadBlob, tryNativeShare } from "@/lib/blip-export"

/** Offline render length — universal WAV, no real-time wait of 30s wall clock
 *  (Tone.Offline renders as fast as the CPU allows). */
const BLIP_DURATION_MS = 20_000

export function BlipShare({
  disabled,
  title = "PixelSymphony Blip",
  shareText,
}: {
  disabled?: boolean
  title?: string
  /** Unused (kept for call-site compat). WAV is audio-only. */
  getCanvas?: () => HTMLCanvasElement | null
  shareText?: string
}) {
  const [busy, setBusy] = useState(false)

  async function recordAndShareBlip() {
    if (disabled || busy) return
    setBusy(true)
    try {
      await audio.unlockAudio()

      toast.message("Rendering Blip…", {
        description: "Offline → WAV (universal, high quality)",
      })

      const blob = await audio.captureAsWAV(BLIP_DURATION_MS)
      const filename = `pixelsymphony-blip-${Date.now()}.wav`

      // Always download .wav
      downloadBlob(blob, filename)

      // Share text / native sheet (file share when supported)
      const text =
        shareText ||
        "Listen to my Normie singing in PixelSymphony! #PixelSymphony #Normies"
      const file = new File([blob], filename, { type: "audio/wav" })
      const shared = await tryNativeShare(file, title, text)

      if (!shared) {
        // Desktop: also open X intent (download already saved)
        if (typeof navigator !== "undefined" && !navigator.share) {
          // no-op — download already done; Share X button still available
        }
      }

      toast.success("Blip saved as WAV", {
        description: shared
          ? "Share sheet opened"
          : "Universal audio — drop into X, TikTok, Messages, or Drive",
      })
    } catch (e) {
      console.error(e)
      toast.error("Could not record Blip", {
        description: e instanceof Error ? e.message : "Try again after Play loads a Normie",
      })
    } finally {
      setBusy(false)
    }
  }

  function shareX() {
    const text = encodeURIComponent(
      shareText ||
        "Listen to my Normie singing in PixelSymphony! #PixelSymphony #Normies",
    )
    const url = encodeURIComponent(
      typeof window !== "undefined"
        ? window.location.href
        : "https://pixelsymphony.vercel.app",
    )
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer",
    )
  }

  function shareTikTokHint() {
    toast.message("TikTok", {
      description: "Save the .wav Blip, then upload that file in the TikTok app.",
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn-retro inline-flex items-center gap-2 ${busy ? "btn-retro-active" : ""}`}
          disabled={disabled || busy}
          onClick={recordAndShareBlip}
        >
          <Download className="size-3.5" />
          {busy ? "Rendering…" : "Save Blip (.wav)"}
        </button>
        <button
          type="button"
          className="btn-retro inline-flex items-center gap-2"
          onClick={shareX}
        >
          <Share2 className="size-3.5" />
          Share X
        </button>
        <button
          type="button"
          className="btn-retro inline-flex items-center gap-2"
          onClick={shareTikTokHint}
        >
          TikTok
        </button>
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Exports a{" "}
        <span className="text-foreground/80">.wav</span> file offline (no
        codec issues) — works on phones, desktops, and editors.
      </p>
    </div>
  )
}
