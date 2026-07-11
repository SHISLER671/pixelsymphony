"use client"

import { Download, Share2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import * as audio from "@/lib/audio"

export function BlipShare({
  disabled,
  title = "PixelSymphony Blip",
}: {
  disabled?: boolean
  title?: string
}) {
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)

  async function recordBlip() {
    if (disabled || busy) return
    setBusy(true)
    try {
      await audio.unlockAudio()
      await audio.play()
      await audio.startRecording()
      setRecording(true)
      toast.message("Recording Blip…", { description: "12 seconds of hive signal" })

      await new Promise((r) => setTimeout(r, 12_000))

      const blob = await audio.stopRecording()
      setRecording(false)

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `pixelsymphony-blip-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Blip saved", {
        description: "Upload to TikTok or attach on X",
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
      `${title} — Your Normies are singing. Tune into the hive. #PixelSymphony #Normies`,
    )
    const url = encodeURIComponent(
      typeof window !== "undefined" ? window.location.href : "https://pixelsymphony.app",
    )
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer",
    )
  }

  function shareTikTokHint() {
    toast.message("TikTok", {
      description: "Record a Blip, then upload the file in the TikTok app.",
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={`btn-retro inline-flex items-center gap-2 ${recording ? "btn-retro-active" : ""}`}
        disabled={disabled || busy}
        onClick={recordBlip}
      >
        <Download className="size-3.5" />
        {recording ? "Recording…" : "Record Blip"}
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
  )
}
