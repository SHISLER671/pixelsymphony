"use client"

import { Download, Share2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import * as audio from "@/lib/audio"
import {
  blobToWav,
  downloadBlob,
  extensionForMime,
  pickVideoMime,
  tryNativeShare,
} from "@/lib/blip-export"

const BLIP_SECONDS = 10

export function BlipShare({
  disabled,
  title = "PixelSymphony Blip",
  getCanvas,
  shareText,
}: {
  disabled?: boolean
  title?: string
  /** Visualizer canvas for video blips (shareable on social). */
  getCanvas?: () => HTMLCanvasElement | null
  shareText?: string
}) {
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)

  async function recordBlip() {
    if (disabled || busy) return
    setBusy(true)
    try {
      await audio.unlockAudio()
      await audio.play()

      const canvas = getCanvas?.() ?? null
      const videoMime = pickVideoMime()
      let recorded: Blob
      let filename: string

      await audio.ensureRecordingTap()

      if (canvas && videoMime) {
        toast.message("Recording Blip…", {
          description: `${BLIP_SECONDS}s video (easy to post)`,
        })
        setRecording(true)
        recorded = await recordVideoBlip(canvas, videoMime, BLIP_SECONDS)
        const ext = extensionForMime(videoMime)
        filename = `pixelsymphony-blip-${Date.now()}.${ext}`
      } else {
        toast.message("Recording Blip…", {
          description: `${BLIP_SECONDS}s audio → WAV (universal)`,
        })
        setRecording(true)
        await audio.startRecording()
        await sleep(BLIP_SECONDS * 1000)
        const raw = await audio.stopRecording()
        // Convert to WAV for Messages, Drive, desktop apps, TikTok audio tools
        try {
          recorded = await blobToWav(raw)
          filename = `pixelsymphony-blip-${Date.now()}.wav`
        } catch {
          recorded = raw
          filename = `pixelsymphony-blip-${Date.now()}.webm`
        }
      }

      setRecording(false)

      const file = new File([recorded], filename, { type: recorded.type })
      const caption =
        shareText ||
        `${title} — Your Normies are singing. Tune into the hive. #PixelSymphony #Normies`

      const shared = await tryNativeShare(file, title, caption)
      if (!shared) {
        downloadBlob(recorded, filename)
      }

      const kind = filename.endsWith(".wav")
        ? "WAV audio"
        : filename.endsWith(".mp4")
          ? "MP4 video"
          : "video file"

      toast.success(`Blip ready (${kind})`, {
        description: shared
          ? "Opened your share sheet"
          : "Downloaded — drop into X, TikTok, Messages, or Drive",
      })
    } catch (err) {
      console.error(err)
      toast.error("Could not record Blip", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
      setRecording(false)
    } finally {
      setBusy(false)
    }
  }

  function shareX() {
    const text = encodeURIComponent(
      shareText ||
        `${title} — Your Normies are singing. Tune into the hive. #PixelSymphony #Normies`,
    )
    const url = encodeURIComponent(
      typeof window !== "undefined"
        ? window.location.origin + "/player?sample=1"
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
      description:
        "Record a Blip (video or WAV), then upload that file in the TikTok app.",
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn-retro inline-flex items-center gap-2 ${recording ? "btn-retro-active" : ""}`}
          disabled={disabled || busy}
          onClick={recordBlip}
        >
          <Download className="size-3.5" />
          {recording ? "Recording…" : "Save Blip"}
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
        Saves a short{" "}
        <span className="text-foreground/80">MP4/WebM video</span> when possible
        (pixels + audio), otherwise a universal{" "}
        <span className="text-foreground/80">WAV</span> — both easier to post
        than raw WebM audio.
      </p>
    </div>
  )
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Composite visualizer canvas + Tone audio into one shareable video blob.
 */
async function recordVideoBlip(
  canvas: HTMLCanvasElement,
  mimeType: string,
  seconds: number,
): Promise<Blob> {
  const fps = 30
  // Draw loop so captureStream has fresh frames while Transport runs
  const stream = canvas.captureStream(fps)

  // Mix in audio from the engine when available
  const audioStream = audio.getRecordingStream?.()
  if (audioStream) {
    for (const track of audioStream.getAudioTracks()) {
      stream.addTrack(track)
    }
  } else {
    // Fallback: also start engine recorder path so we at least have audio file path
    await audio.startRecording()
  }

  const chunks: Blob[] = []
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 2_500_000,
  })

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType.split(";")[0] || mimeType }))
    }
    recorder.onerror = () => reject(new Error("Video recording failed"))
  })

  recorder.start(100)
  await sleep(seconds * 1000)
  recorder.stop()

  // Stop only the video tracks we created; don't kill engine audio graph
  for (const track of stream.getVideoTracks()) {
    track.stop()
  }

  if (!audioStream) {
    try {
      await audio.stopRecording()
    } catch {
      /* optional */
    }
  }

  return stopped
}
