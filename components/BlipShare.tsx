"use client"

import { Download, Share2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import * as audio from "@/lib/audio"
import {
  downloadBlob,
  openBlankTabForShare,
  openXCompose,
  tryNativeShare,
} from "@/lib/blip-export"
import { createTwitterBlip, X_VIDEO_MS } from "@/lib/twitter-mp4"

/** Offline WAV render length (Save Blip) */
const WAV_DURATION_MS = 20_000

export function BlipShare({
  disabled,
  title = "PixelSymphony Blip",
  getCanvas,
  shareText,
}: {
  disabled?: boolean
  title?: string
  getCanvas?: () => HTMLCanvasElement | null
  shareText?: string
}) {
  const [busy, setBusy] = useState(false)
  const [busyKind, setBusyKind] = useState<"wav" | "x" | null>(null)

  const defaultShareText =
    shareText ||
    "Listen to my Normie singing in PixelSymphony! #PixelSymphony #Normies"

  /** Save Blip — universal offline WAV. */
  async function recordAndShareBlip() {
    if (disabled || busy) return
    setBusy(true)
    setBusyKind("wav")
    try {
      await audio.unlockAudio()
      toast.message("Rendering Blip…", {
        description: "Offline → WAV (universal, high quality)",
      })

      const blob = await audio.captureAsWAV(WAV_DURATION_MS)
      const filename = `pixelsymphony-blip-${Date.now()}.wav`
      downloadBlob(blob, filename)

      const file = new File([blob], filename, { type: "audio/wav" })
      const shared = await tryNativeShare(file, title, defaultShareText)

      toast.success("Blip saved as WAV", {
        description: shared
          ? "Share sheet opened"
          : "Universal audio — drop into X, TikTok, Messages, or Drive",
      })
    } catch (e) {
      console.error(e)
      toast.error("Could not record Blip", {
        description:
          e instanceof Error
            ? e.message
            : "Try again after Play loads a Normie",
      })
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  /**
   * Share on X:
   * 1) Open prefilled compose immediately (user gesture / popup-safe)
   * 2) Record upscaled pixel canvas + audio
   * 3) Transcode to real H.264+AAC MP4 (what X accepts)
   * 4) Download MP4 for attach on the open compose tab
   */
  async function shareOnX() {
    if (disabled || busy) return

    const xTab = openBlankTabForShare()
    const pageUrl =
      typeof window !== "undefined" ? window.location.href : undefined
    openXCompose(defaultShareText, pageUrl, xTab)

    setBusy(true)
    setBusyKind("x")
    try {
      const canvas = getCanvas?.() ?? null
      if (!canvas) {
        toast.message("X compose opened", {
          description: "Load a Normie for a video Blip next time.",
        })
        return
      }

      await audio.unlockAudio()
      await audio.ensureRecordingTap()
      await audio.play()

      toast.message("Building X video…", {
        description: `Recording ${X_VIDEO_MS / 1000}s, then encoding H.264 + AAC MP4`,
      })

      const audioStream = audio.getRecordingStream()
      const { blob, filename } = await createTwitterBlip({
        sourceCanvas: canvas,
        audioStream,
        durationMs: X_VIDEO_MS,
        onStatus: (msg) => {
          toast.message("Building X video…", { description: msg })
        },
      })

      downloadBlob(blob, filename)

      const isCoarse =
        typeof window !== "undefined" &&
        window.matchMedia?.("(pointer: coarse)").matches
      if (isCoarse) {
        const file = new File([blob], filename, { type: "video/mp4" })
        void tryNativeShare(file, title, defaultShareText)
      }

      openXCompose(defaultShareText, pageUrl, xTab)

      toast.success("X-ready MP4 downloaded", {
        description:
          "Compose is open with your text — attach the .mp4 (H.264 + AAC).",
      })
    } catch (e) {
      console.error(e)
      openXCompose(defaultShareText, pageUrl, xTab)
      toast.error("Video encode failed", {
        description:
          e instanceof Error
            ? `${e.message} — X is open with text; try Save Blip (.wav) or Safari.`
            : "X is open with text only.",
      })
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  function shareTikTokHint() {
    toast.message("TikTok", {
      description:
        "Use Share on X to get an MP4, or Save Blip for WAV, then upload in TikTok.",
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn-retro inline-flex items-center gap-2 ${busyKind === "wav" ? "btn-retro-active" : ""}`}
          disabled={disabled || busy}
          onClick={recordAndShareBlip}
        >
          <Download className="size-3.5" />
          {busyKind === "wav" ? "Rendering…" : "Save Blip (.wav)"}
        </button>
        <button
          type="button"
          className={`btn-retro inline-flex items-center gap-2 ${busyKind === "x" ? "btn-retro-active" : ""}`}
          disabled={disabled || busy}
          onClick={shareOnX}
        >
          <Share2 className="size-3.5" />
          {busyKind === "x" ? "Encoding…" : "Share on X"}
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
        <span className="text-foreground/80">Share on X</span> opens compose
        with your text, then downloads a real{" "}
        <span className="text-foreground/80">H.264 + AAC MP4</span> (720p) so X
        can process it. First encode may download a small encoder (~30s).
      </p>
    </div>
  )
}
