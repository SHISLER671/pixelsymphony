"use client"

import { Download, Share2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import * as audio from "@/lib/audio"
import {
  downloadBlob,
  openBlankTabForShare,
  openXCompose,
  recordPixelVideoBlip,
  tryNativeShare,
} from "@/lib/blip-export"

/** Offline WAV render length (Save Blip) */
const WAV_DURATION_MS = 20_000
/**
 * X video guidance: short clips work best; keep under common 2:20 / size limits.
 * 12s is a snappy Blip within help.x.com video norms (MP4/H.264 preferred).
 */
const X_VIDEO_MS = 12_000

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
   * 1) Immediately open a tab (user gesture) → prefilled compose (like before)
   * 2) Record short pixel+audio video in the background
   * 3) Download the file so the user can attach it on X
   *
   * X web intent cannot auto-attach media — only text/url.
   * Native share is optional on mobile after the tab is opened.
   */
  async function shareOnX() {
    if (disabled || busy) return

    // Synchronous with the click → avoids popup blockers after 12s capture
    const xTab = openBlankTabForShare()
    const pageUrl =
      typeof window !== "undefined" ? window.location.href : undefined

    // Navigate the reserved tab to compose ASAP with prefilled text
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

      toast.message("Recording video Blip…", {
        description: `${X_VIDEO_MS / 1000}s · will download so you can attach on X`,
      })

      const audioStream = audio.getRecordingStream()
      const { blob, filename, twitterSafe } = await recordPixelVideoBlip({
        canvas,
        audioStream,
        durationMs: X_VIDEO_MS,
        fps: 30,
      })

      downloadBlob(blob, filename)

      // Mobile only: offer OS share sheet as an extra path (does not replace the tab)
      const isCoarse =
        typeof window !== "undefined" &&
        window.matchMedia?.("(pointer: coarse)").matches
      if (isCoarse) {
        const file = new File([blob], filename, {
          type:
            blob.type ||
            (filename.endsWith(".mp4") ? "video/mp4" : "video/webm"),
        })
        void tryNativeShare(file, title, defaultShareText)
      }

      // Keep compose tab focused if still open
      openXCompose(defaultShareText, pageUrl, xTab)

      toast.success(
        twitterSafe ? "MP4 downloaded — attach it on X" : "Video downloaded — attach it on X",
        {
          description: twitterSafe
            ? "X compose is open with your text. Use media → pick the Blip file."
            : "Compose is open. This browser saved WebM (not fake MP4). Prefer Safari for H.264+AAC MP4.",
        },
      )
    } catch (e) {
      console.error(e)
      openXCompose(defaultShareText, pageUrl, xTab)
      toast.error("Video Blip failed", {
        description:
          e instanceof Error
            ? `${e.message} — X compose still opened with your text.`
            : "X compose still opened with your text.",
      })
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  function shareTikTokHint() {
    toast.message("TikTok", {
      description:
        "Save Blip (.wav) or Share on X (video), then upload the file in the TikTok app.",
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
          {busyKind === "x" ? "Recording…" : "Share on X"}
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
        with your text right away, then downloads a short video to attach (X web
        cannot auto-attach files).{" "}
        <span className="text-foreground/80">Save Blip</span> = WAV only.
      </p>
    </div>
  )
}
