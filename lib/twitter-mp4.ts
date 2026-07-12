/**
 * X/Twitter-compatible video pipeline.
 *
 * X requires MP4 or MOV with H.264 video + AAC audio (see help.x.com video tips).
 * Browser MediaRecorder usually emits WebM (VP8/VP9 + Opus) — X rejects that,
 * and labeling WebM as .mp4 causes "Incompatible audio codecs" / processing errors.
 *
 * Strategy:
 * 1. Upscale pixel art to ≥720p square (tiny canvases fail X processing)
 * 2. Record canvas + audio as WebM (reliable in Chrome)
 * 3. Transcode with ffmpeg.wasm → H.264 + AAC + yuv420p + faststart MP4
 */

import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

import { pickTwitterVideoProfile } from "@/lib/blip-export"

const SHARE_SIZE = 720 // even, ≥ common X-friendly floor
const X_VIDEO_MS = 12_000

let ffmpegInstance: FFmpeg | null = null
let ffmpegLoading: Promise<FFmpeg> | null = null

async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance
  if (ffmpegLoading) return ffmpegLoading

  ffmpegLoading = (async () => {
    const ffmpeg = new FFmpeg()
    ffmpeg.on("log", ({ message }) => onLog?.(message))

    // Load core from CDN as blob URLs (avoids CORS / COOP issues in many setups)
    const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm"
    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    })
    ffmpegInstance = ffmpeg
    return ffmpeg
  })()

  try {
    return await ffmpegLoading
  } finally {
    ffmpegLoading = null
  }
}

/** Draw source visualizer onto a 720×720 black canvas (nearest-neighbor pixels). */
export function createShareCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas")
  out.width = SHARE_SIZE
  out.height = SHARE_SIZE
  const ctx = out.getContext("2d")
  if (!ctx) throw new Error("Could not create share canvas")

  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, SHARE_SIZE, SHARE_SIZE)
  ctx.imageSmoothingEnabled = false

  const sw = source.width || 1
  const sh = source.height || 1
  const scale = Math.min(SHARE_SIZE / sw, SHARE_SIZE / sh) * 0.92
  const dw = Math.max(2, Math.floor(sw * scale))
  const dh = Math.max(2, Math.floor(sh * scale))
  // Ensure even dimensions for yuv420p
  const ew = dw - (dw % 2)
  const eh = dh - (dh % 2)
  const dx = Math.floor((SHARE_SIZE - ew) / 2)
  const dy = Math.floor((SHARE_SIZE - eh) / 2)

  ctx.drawImage(source, 0, 0, sw, sh, dx, dy, ew, eh)

  // Subtle brand strip
  ctx.fillStyle = "rgba(0,0,0,0.65)"
  ctx.fillRect(0, SHARE_SIZE - 36, SHARE_SIZE, 36)
  ctx.fillStyle = "#cccccc"
  ctx.font = "14px monospace"
  ctx.fillText("PixelSymphony · on-chain voice", 16, SHARE_SIZE - 14)

  return out
}

/**
 * Keep share canvas in sync with the live visualizer during recording.
 */
export function startShareCanvasMirror(
  source: HTMLCanvasElement,
  target: HTMLCanvasElement,
): () => void {
  let raf = 0
  const tick = () => {
    const ctx = target.getContext("2d")
    if (ctx && source.width > 0) {
      ctx.fillStyle = "#000000"
      ctx.fillRect(0, 0, target.width, target.height)
      ctx.imageSmoothingEnabled = false
      const sw = source.width
      const sh = source.height
      const scale = Math.min(target.width / sw, target.height / sh) * 0.92
      const dw = Math.max(2, Math.floor(sw * scale))
      const dh = Math.max(2, Math.floor(sh * scale))
      const ew = dw - (dw % 2)
      const eh = dh - (dh % 2)
      const dx = Math.floor((target.width - ew) / 2)
      const dy = Math.floor((target.height - eh) / 2)
      ctx.drawImage(source, 0, 0, sw, sh, dx, dy, ew, eh)
      ctx.fillStyle = "rgba(0,0,0,0.65)"
      ctx.fillRect(0, target.height - 36, target.width, 36)
      ctx.fillStyle = "#cccccc"
      ctx.font = "14px monospace"
      ctx.fillText("PixelSymphony · on-chain voice", 16, target.height - 14)
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

async function recordStreamToBlob(
  stream: MediaStream,
  mime: string,
  durationMs: number,
): Promise<Blob> {
  const chunks: Blob[] = []
  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 4_000_000,
      audioBitsPerSecond: 160_000,
    })
  } catch {
    recorder = new MediaRecorder(stream, { mimeType: mime })
  }

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Video recording failed"))
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mime.split(";")[0] || mime }))
    }
  })

  recorder.start(100)
  await new Promise((r) => setTimeout(r, durationMs))
  if (recorder.state !== "inactive") recorder.stop()
  return stopped
}

/**
 * Transcode any browser recording to X-safe MP4 (H.264 + AAC).
 */
export async function transcodeToTwitterMp4(
  input: Blob,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const ffmpeg = await getFFmpeg()
  const inName = input.type.includes("mp4") ? "input.mp4" : "input.webm"
  await ffmpeg.writeFile(inName, await fetchFile(input))

  ffmpeg.on("progress", ({ progress }) => {
    onProgress?.(Math.min(1, Math.max(0, progress)))
  })

  // X-friendly encode profile
  const code = await ffmpeg.exec([
    "-i",
    inName,
    "-vf",
    `scale=${SHARE_SIZE}:${SHARE_SIZE}:force_original_aspect_ratio=decrease,pad=${SHARE_SIZE}:${SHARE_SIZE}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "baseline",
    "-level",
    "3.1",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "-t",
    String(X_VIDEO_MS / 1000),
    "output.mp4",
  ])

  if (code !== 0) {
    // Retry without audio re-encode issues / missing audio track
    const code2 = await ffmpeg.exec([
      "-i",
      inName,
      "-vf",
      `scale=${SHARE_SIZE}:${SHARE_SIZE}:force_original_aspect_ratio=decrease,pad=${SHARE_SIZE}:${SHARE_SIZE}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-an",
      "-movflags",
      "+faststart",
      "-t",
      String(X_VIDEO_MS / 1000),
      "output.mp4",
    ])
    if (code2 !== 0) {
      throw new Error("MP4 encode failed — try Safari or Save Blip (.wav)")
    }
  }

  const data = await ffmpeg.readFile("output.mp4")
  const bytes =
    data instanceof Uint8Array
      ? data
      : new TextEncoder().encode(String(data))
  // Copy into a plain ArrayBuffer-backed Uint8Array for BlobPart typing
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy], { type: "video/mp4" })
}

export type XBlipResult = {
  blob: Blob
  filename: string
  /** Always true when we successfully ran ffmpeg H.264+AAC */
  twitterSafe: boolean
}

/**
 * Full pipeline: upscale canvas → record with audio → H.264/AAC MP4 for X.
 */
export async function createTwitterBlip(options: {
  sourceCanvas: HTMLCanvasElement
  audioStream: MediaStream | null
  durationMs?: number
  onStatus?: (msg: string) => void
}): Promise<XBlipResult> {
  const durationMs = options.durationMs ?? X_VIDEO_MS
  const shareCanvas = createShareCanvas(options.sourceCanvas)
  const stopMirror = startShareCanvasMirror(options.sourceCanvas, shareCanvas)

  try {
    options.onStatus?.("Recording pixel + audio…")
    const profile = pickTwitterVideoProfile()
    const recordMime =
      profile?.mime ??
      (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm")

    const canvasStream = shareCanvas.captureStream(30)
    const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()]
    if (options.audioStream) {
      for (const t of options.audioStream.getAudioTracks()) {
        if (t.readyState === "live") tracks.push(t)
      }
    }
    const combined = new MediaStream(tracks)
    const raw = await recordStreamToBlob(combined, recordMime, durationMs)
    for (const t of canvasStream.getVideoTracks()) t.stop()

    if (raw.size < 500) {
      throw new Error("Recording empty — press Play first, then Share on X")
    }

    options.onStatus?.("Encoding X-compatible MP4 (H.264 + AAC)…")
    // Always transcode so Chrome WebM becomes real MP4 for X
    const mp4 = await transcodeToTwitterMp4(raw, () => {
      /* progress optional */
    })

    if (mp4.size < 1000) {
      throw new Error("Encoded MP4 was empty")
    }

    return {
      blob: mp4,
      filename: `pixelsymphony-blip-${Date.now()}.mp4`,
      twitterSafe: true,
    }
  } finally {
    stopMirror()
  }
}

export { X_VIDEO_MS }
