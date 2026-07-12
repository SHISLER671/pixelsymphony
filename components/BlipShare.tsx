"use client"

import { Download, Share2, Smartphone } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import * as audio from "@/lib/audio"
import {
  downloadBlob,
  openBlankTabForShare,
  openFacebookShare,
  openXCompose,
} from "@/lib/blip-export"
import {
  canvasToPngFile,
  canNativeShare,
  copyText,
  isMobileDevice,
  nativeShare,
} from "@/lib/mobile-share"
import { createTwitterBlip, X_VIDEO_MS } from "@/lib/twitter-mp4"

/** Offline WAV — slightly shorter on mobile for battery/time */
const WAV_DESKTOP_MS = 20_000
const WAV_MOBILE_MS = 12_000
/** Video clip length — shorter on mobile */
const VIDEO_DESKTOP_MS = X_VIDEO_MS
const VIDEO_MOBILE_MS = 8_000

type BusyKind = "wav" | "x" | "mobile" | null

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
  const [busyKind, setBusyKind] = useState<BusyKind>(null)
  const [mobile, setMobile] = useState(false)
  const [hasShareApi, setHasShareApi] = useState(false)

  useEffect(() => {
    setMobile(isMobileDevice())
    setHasShareApi(canNativeShare())
  }, [])

  const defaultShareText = useMemo(
    () =>
      shareText ||
      "Listen to my Normie singing in PixelSymphony! #PixelSymphony #Normies",
    [shareText],
  )

  const pageUrl =
    typeof window !== "undefined" ? window.location.href : "https://pixelsymphony.vercel.app"

  // ---------- Save Blip (.wav) ----------
  async function saveWav() {
    if (disabled || busy) return
    setBusy(true)
    setBusyKind("wav")
    try {
      await audio.unlockAudio()
      toast.message("Rendering Blip…", {
        description: "Offline → WAV",
      })

      const ms = mobile ? WAV_MOBILE_MS : WAV_DESKTOP_MS
      const blob = await audio.captureAsWAV(ms)
      const filename = `pixelsymphony-blip-${Date.now()}.wav`
      const file = new File([blob], filename, { type: "audio/wav" })

      if (mobile && hasShareApi) {
        const result = await nativeShare({
          title,
          text: defaultShareText,
          url: pageUrl,
          file,
        })
        if (result === "shared-file" || result === "shared-text") {
          toast.success("Shared!", {
            description:
              result === "shared-file"
                ? "Pick X, Messages, Files, TikTok…"
                : "Link shared — open Save Blip again to attach audio",
          })
          return
        }
        if (result === "cancelled") return
      }

      downloadBlob(blob, filename)
      toast.success("Blip saved as WAV", {
        description: "Universal audio file",
      })
    } catch (e) {
      console.error(e)
      toast.error("Could not save Blip", {
        description: e instanceof Error ? e.message : "Try after Play loads a Normie",
      })
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  // ---------- Mobile primary: Share ----------
  /**
   * Mobile-first cascade:
   * 1) Try short MP4 → OS share sheet (X / Messages / etc.)
   * 2) Else WAV → OS share sheet
   * 3) Else PNG of Normie + text → OS share sheet
   * 4) Else download best file + copy caption
   */
  async function shareMobile() {
    if (disabled || busy) return
    setBusy(true)
    setBusyKind("mobile")

    const canvas = getCanvas?.() ?? null

    try {
      await audio.unlockAudio()
      await audio.ensureRecordingTap()
      await audio.play()

      // --- Try video ---
      if (canvas && canvas.width > 0) {
        try {
          toast.message("Making a share clip…", {
            description: "Short video for X / Messages",
          })
          const audioStream =
            (await audio.ensureRecordingTap()) || audio.getRecordingStream()
          const { blob, filename } = await createTwitterBlip({
            sourceCanvas: canvas,
            audioStream,
            durationMs: VIDEO_MOBILE_MS,
            onStatus: (msg) =>
              toast.message("Making a share clip…", { description: msg }),
          })
          const file = new File([blob], filename, { type: "video/mp4" })
          const result = await nativeShare({
            title,
            text: defaultShareText,
            url: pageUrl,
            file,
          })
          if (result === "shared-file") {
            toast.success("Share sheet ready", {
              description: "Choose X, Messages, TikTok, or Save Video",
            })
            return
          }
          if (result === "shared-text") {
            downloadBlob(blob, filename)
            toast.success("Video saved + text shared", {
              description: "Open Files / Photos and attach the Blip if needed",
            })
            return
          }
          if (result === "cancelled") return
          // unsupported file share → download and continue cascade
          downloadBlob(blob, filename)
        } catch (vidErr) {
          console.warn("[mobile share] video failed", vidErr)
          // fall through to audio / image
        }
      }

      // --- Try WAV ---
      try {
        toast.message("Sharing audio Blip…", {
          description: "WAV — works everywhere",
        })
        const blob = await audio.captureAsWAV(WAV_MOBILE_MS)
        const filename = `pixelsymphony-blip-${Date.now()}.wav`
        const file = new File([blob], filename, { type: "audio/wav" })
        const result = await nativeShare({
          title,
          text: defaultShareText,
          url: pageUrl,
          file,
        })
        if (result === "shared-file") {
          toast.success("Share sheet ready", {
            description: "Send the audio or open in X / Files",
          })
          return
        }
        if (result === "cancelled") return
        downloadBlob(blob, filename)
      } catch (wavErr) {
        console.warn("[mobile share] wav failed", wavErr)
      }

      // --- PNG + text (always works on iOS) ---
      if (canvas && canvas.width > 0) {
        try {
          const png = await canvasToPngFile(canvas)
          const result = await nativeShare({
            title,
            text: `${defaultShareText}\n${pageUrl}`,
            url: pageUrl,
            file: png,
          })
          if (result === "shared-file" || result === "shared-text") {
            toast.success("Shared Normie card", {
              description: "Add the WAV Blip from Files if you want sound",
            })
            return
          }
          if (result === "cancelled") return
          downloadBlob(png, png.name)
        } catch (imgErr) {
          console.warn("[mobile share] png failed", imgErr)
        }
      }

      // --- Text only ---
      const textResult = await nativeShare({
        title,
        text: defaultShareText,
        url: pageUrl,
      })
      if (textResult === "shared-text") {
        toast.success("Link shared")
        return
      }
      if (textResult === "cancelled") return

      await copyText(`${defaultShareText}\n${pageUrl}`)
      toast.message("Caption copied", {
        description: "Paste into X — use Save Blip for audio",
      })
    } catch (e) {
      console.error(e)
      toast.error("Share failed", {
        description:
          e instanceof Error ? e.message : "Try Save Blip (.wav) instead",
      })
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  // ---------- Desktop Share on X ----------
  async function shareOnXDesktop() {
    if (disabled || busy) return

    const xTab = openBlankTabForShare()
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
        description: `${VIDEO_DESKTOP_MS / 1000}s · H.264 MP4`,
      })

      const audioStream =
        (await audio.ensureRecordingTap()) || audio.getRecordingStream()

      const { blob, filename } = await createTwitterBlip({
        sourceCanvas: canvas,
        audioStream,
        durationMs: VIDEO_DESKTOP_MS,
        onStatus: (msg) =>
          toast.message("Building X video…", { description: msg }),
      })

      downloadBlob(blob, filename)
      openXCompose(defaultShareText, pageUrl, xTab)

      toast.success("X-ready MP4 downloaded", {
        description: "Compose is open — attach the .mp4 file",
      })
    } catch (e) {
      console.error(e)
      openXCompose(defaultShareText, pageUrl, xTab)
      const msg = e instanceof Error ? e.message : "Unknown encode error"
      toast.error("Video encode failed", {
        description: `${msg} Text is ready on X — use Save Blip for audio.`,
      })
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  // On mobile, "Share on X" uses the mobile cascade so the user can pick the X app.
  async function shareOnX() {
    if (mobile) {
      await shareMobile()
      return
    }
    await shareOnXDesktop()
  }

  /** Instagram has no web upload — mobile share sheet or save files for the app. */
  async function shareInstagram() {
    if (disabled || busy) return
    if (mobile && hasShareApi) {
      toast.message("Instagram", {
        description:
          "Use Share → pick Instagram (Stories/Reels/Feed) or Save Video / Files, then open IG.",
      })
      await shareMobile()
      return
    }
    // Desktop: prepare assets then instruct
    setBusy(true)
    setBusyKind("wav")
    try {
      await audio.unlockAudio()
      toast.message("Preparing Instagram assets…", {
        description: "WAV + optional video for the IG app",
      })
      const blob = await audio.captureAsWAV(WAV_DESKTOP_MS)
      downloadBlob(blob, `pixelsymphony-blip-${Date.now()}.wav`)
      const canvas = getCanvas?.() ?? null
      if (canvas) {
        try {
          await audio.ensureRecordingTap()
          await audio.play()
          const audioStream =
            (await audio.ensureRecordingTap()) || audio.getRecordingStream()
          const { blob: vid, filename } = await createTwitterBlip({
            sourceCanvas: canvas,
            audioStream,
            durationMs: VIDEO_DESKTOP_MS,
          })
          downloadBlob(vid, filename)
          toast.success("Saved MP4 + WAV for Instagram", {
            description:
              "Open the Instagram app → create Reel/Story → add from Camera Roll / Files",
          })
        } catch {
          toast.success("WAV saved for Instagram", {
            description:
              "IG has no desktop upload. Open the app on your phone and add the file, or use Share on mobile.",
          })
        }
      } else {
        toast.success("WAV saved", {
          description: "Open Instagram on your phone and upload from Files",
        })
      }
    } catch (e) {
      toast.error("Could not prepare IG assets", {
        description: e instanceof Error ? e.message : "Try Save Blip",
      })
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  function shareFacebook() {
    if (disabled) return
    if (mobile && hasShareApi) {
      // File share sheet can target Facebook app when video/wav ready
      toast.message("Facebook", {
        description:
          "Share sheet → Facebook. Or post the link; video must be added in the FB app.",
      })
      void shareMobile()
      return
    }
    // Web: Facebook only accepts a URL (not a local video file)
    openFacebookShare(pageUrl)
    toast.message("Facebook link share opened", {
      description:
        "FB web only shares a link. For video: Save Blip / Share on X MP4, then upload in the Facebook app or facebook.com create post.",
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* Mobile primary CTA — X, IG, FB, TikTok all live here */}
        {mobile && hasShareApi && (
          <button
            type="button"
            className={`btn-retro btn-retro-active inline-flex items-center gap-2 ${busyKind === "mobile" ? "opacity-90" : ""}`}
            disabled={disabled || busy}
            onClick={shareMobile}
          >
            <Smartphone className="size-3.5" />
            {busyKind === "mobile" ? "Preparing…" : "Share"}
          </button>
        )}

        <button
          type="button"
          className={`btn-retro inline-flex items-center gap-2 ${busyKind === "wav" ? "btn-retro-active" : ""}`}
          disabled={disabled || busy}
          onClick={saveWav}
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
          {busyKind === "x"
            ? "Encoding…"
            : mobile
              ? "→ X"
              : "Share on X"}
        </button>

        <button
          type="button"
          className="btn-retro inline-flex items-center gap-2"
          disabled={disabled || busy}
          onClick={shareInstagram}
        >
          IG
        </button>

        <button
          type="button"
          className="btn-retro inline-flex items-center gap-2"
          disabled={disabled || busy}
          onClick={shareFacebook}
        >
          FB
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {mobile ? (
          <>
            <span className="text-foreground/80">Share</span> opens your phone’s
            sheet — pick{" "}
            <span className="text-foreground/80">X, Instagram, Facebook, TikTok</span>
            , Messages, or Files. Tries video → WAV → image.{" "}
            <span className="text-foreground/80">Save Blip</span> keeps audio.
          </>
        ) : (
          <>
            <span className="text-foreground/80">Share on X</span> = pretfill +
            MP4 download.{" "}
            <span className="text-foreground/80">IG</span> prepares MP4/WAV for
            the Instagram app (no web upload).{" "}
            <span className="text-foreground/80">FB</span> opens a link share;
            upload video in the Facebook app.{" "}
            <span className="text-foreground/80">Save Blip</span> = WAV.
          </>
        )}
      </p>
    </div>
  )
}
