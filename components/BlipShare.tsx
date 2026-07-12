"use client"

import { Download, Share2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import * as audio from "@/lib/audio"
import {
  downloadBlob,
  openXCompose,
  recordPixelVideoBlip,
  tryNativeShare,
} from "@/lib/blip-export"

/** Offline WAV render length (Save Blip) */
const WAV_DURATION_MS = 20_000
/** Short video for X attach */
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

  /** Save Blip — universal offline WAV (unchanged quality path). */
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
   * 1) Capture short video (pixel canvas + live audio)
   * 2) Download with correct extension (mp4 only when H.264+AAC)
   * 3) Open X compose with pre-filled text (web cannot auto-attach files)
   */
  async function shareOnX() {
    if (disabled || busy) return
    setBusy(true)
    setBusyKind("x")
    try {
      const canvas = getCanvas?.() ?? null
      if (!canvas) {
        toast.error("Visualizer not ready", {
          description: "Load a Normie first, then try Share on X again.",
        })
        openXCompose(defaultShareText, window.location.href)
        return
      }

      await audio.unlockAudio()
      await audio.ensureRecordingTap()
      // Ensure music is audible on the bus while we capture
      await audio.play()

      toast.message("Creating video Blip…", {
        description: `${X_VIDEO_MS / 1000}s pixel art + audio`,
      })

      const audioStream = audio.getRecordingStream()
      const { blob, filename, twitterSafe } = await recordPixelVideoBlip({
        canvas,
        audioStream,
        durationMs: X_VIDEO_MS,
        fps: 30,
      })

      // Always save locally so the user can attach on X
      downloadBlob(blob, filename)

      const file = new File([blob], filename, {
        type: blob.type || (filename.endsWith(".mp4") ? "video/mp4" : "video/webm"),
      })

      // Mobile: native share can open the X app with the file
      const shared = await tryNativeShare(file, title, defaultShareText)

      // Web compose (text + link). Attach the downloaded video in the UI.
      openXCompose(defaultShareText, window.location.href)

      if (twitterSafe) {
        toast.success("MP4 ready for X", {
          description: shared
            ? "Share sheet opened — pick X if listed"
            : "Attach the downloaded .mp4 to your post",
        })
      } else {
        toast.message("Video saved", {
          description:
            "This browser exports WebM (correct codecs). X desktop prefers MP4 — use Safari/iPhone for H.264+AAC, or convert the WebM. Attach the file to your post.",
        })
      }
    } catch (e) {
      console.error(e)
      toast.error("Could not create video Blip", {
        description:
          e instanceof Error ? e.message : "Opening X with text only",
      })
      openXCompose(defaultShareText, window.location.href)
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
        <span className="text-foreground/80">Save Blip</span> = universal WAV.{" "}
        <span className="text-foreground/80">Share on X</span> = short video
        (MP4 when the browser can do H.264+AAC; otherwise WebM with the correct
        extension so X doesn&apos;t choke on audio codecs).
      </p>
    </div>
  )
}
