/**
 * X/Twitter-compatible video pipeline.
 *
 * X requires MP4 with H.264 + AAC. Browser MediaRecorder usually emits WebM/Opus
 * (X rejects it). We use WebCodecs (H.264 + AAC when available) + mp4-muxer.
 *
 * Also upscales the tiny visualizer to 720×720 so X's processor accepts the file.
 */

import { Muxer, ArrayBufferTarget } from "mp4-muxer"

const SHARE_SIZE = 720
const X_VIDEO_MS = 12_000
const FPS = 30
const FRAME_US = Math.round(1_000_000 / FPS)

export function createShareCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas")
  out.width = SHARE_SIZE
  out.height = SHARE_SIZE
  paintShareFrame(source, out)
  return out
}

function paintShareFrame(source: HTMLCanvasElement, target: HTMLCanvasElement) {
  const ctx = target.getContext("2d", { alpha: false })
  if (!ctx) return
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, target.width, target.height)
  ctx.imageSmoothingEnabled = false
  const sw = Math.max(1, source.width)
  const sh = Math.max(1, source.height)
  const scale = Math.min(target.width / sw, target.height / sh) * 0.9
  let dw = Math.max(2, Math.floor(sw * scale))
  let dh = Math.max(2, Math.floor(sh * scale))
  dw -= dw % 2
  dh -= dh % 2
  const dx = Math.floor((target.width - dw) / 2)
  const dy = Math.floor((target.height - dh) / 2 - 10)
  try {
    ctx.drawImage(source, 0, 0, sw, sh, dx, dy, dw, dh)
  } catch {
    /* source may be empty for a frame */
  }
  ctx.fillStyle = "rgba(0,0,0,0.75)"
  ctx.fillRect(0, target.height - 44, target.width, 44)
  ctx.fillStyle = "#e0e0e0"
  ctx.font = "bold 16px monospace"
  ctx.fillText("PixelSymphony", 20, target.height - 18)
  ctx.fillStyle = "#888"
  ctx.font = "12px monospace"
  ctx.fillText("on-chain voice", 160, target.height - 18)
}

export function startShareCanvasMirror(
  source: HTMLCanvasElement,
  target: HTMLCanvasElement,
): () => void {
  let raf = 0
  let alive = true
  const tick = () => {
    if (!alive) return
    paintShareFrame(source, target)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => {
    alive = false
    cancelAnimationFrame(raf)
  }
}

async function supportsWebCodecsAvc(): Promise<boolean> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
    return false
  }
  try {
    const res = await VideoEncoder.isConfigSupported({
      codec: "avc1.42001f",
      width: SHARE_SIZE,
      height: SHARE_SIZE,
      bitrate: 2_500_000,
      framerate: FPS,
    })
    return !!res.supported
  } catch {
    return false
  }
}

async function supportsWebCodecsAac(): Promise<boolean> {
  if (typeof AudioEncoder === "undefined" || typeof AudioData === "undefined") {
    return false
  }
  try {
    const res = await AudioEncoder.isConfigSupported({
      codec: "mp4a.40.2",
      numberOfChannels: 2,
      sampleRate: 44100,
      bitrate: 128_000,
    })
    return !!res.supported
  } catch {
    return false
  }
}

function waitForEncoder(encoder: VideoEncoder | AudioEncoder): Promise<void> {
  if (encoder.encodeQueueSize < 6) return Promise.resolve()
  return new Promise((resolve) => {
    const check = () => {
      if (encoder.encodeQueueSize < 4) resolve()
      else setTimeout(check, 8)
    }
    check()
  })
}

/**
 * WebCodecs → H.264 (+ AAC if available) MP4.
 */
async function encodeWithWebCodecs(
  shareCanvas: HTMLCanvasElement,
  audioStream: MediaStream | null,
  durationMs: number,
  onStatus?: (msg: string) => void,
): Promise<Blob> {
  const hasAac = await supportsWebCodecsAac()
  const sampleRate = 44100
  const numberOfChannels = 2
  const frameCount = Math.max(1, Math.round((durationMs / 1000) * FPS))

  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: {
      codec: "avc",
      width: SHARE_SIZE,
      height: SHARE_SIZE,
      frameRate: FPS,
    },
    audio: hasAac
      ? {
          codec: "aac",
          numberOfChannels,
          sampleRate,
        }
      : undefined,
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  })

  let fatal: Error | null = null

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      try {
        muxer.addVideoChunk(chunk, meta)
      } catch (e) {
        fatal = e instanceof Error ? e : new Error(String(e))
      }
    },
    error: (e) => {
      fatal = e
    },
  })

  videoEncoder.configure({
    codec: "avc1.42001f",
    width: SHARE_SIZE,
    height: SHARE_SIZE,
    bitrate: 2_500_000,
    framerate: FPS,
    latencyMode: "quality",
    avc: { format: "avc" },
  })

  // --- Audio capture (optional AAC) ---
  let audioEncoder: AudioEncoder | null = null
  let audioCtx: AudioContext | null = null
  let processor: ScriptProcessorNode | null = null

  if (hasAac && audioStream && audioStream.getAudioTracks().some((t) => t.readyState === "live")) {
    onStatus?.("Encoding H.264 + AAC…")
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        try {
          muxer.addAudioChunk(chunk, meta)
        } catch (e) {
          console.warn("[twitter-mp4] audio chunk", e)
        }
      },
      error: (e) => console.warn("[twitter-mp4] audio encoder", e),
    })
    audioEncoder.configure({
      codec: "mp4a.40.2",
      numberOfChannels,
      sampleRate,
      bitrate: 128_000,
    })

    audioCtx = new AudioContext({ sampleRate })
    if (audioCtx.state === "suspended") await audioCtx.resume()
    const source = audioCtx.createMediaStreamSource(audioStream)
    const bufferSize = 2048
    processor = audioCtx.createScriptProcessor(bufferSize, 1, 1)
    let audioTs = 0

    processor.onaudioprocess = (ev) => {
      if (!audioEncoder || audioEncoder.state !== "configured") return
      const input = ev.inputBuffer
      const frames = input.length
      const mono = input.getChannelData(0)
      // Duplicate mono → stereo planar
      const planar = new Float32Array(frames * 2)
      planar.set(mono, 0)
      planar.set(mono, frames)
      try {
        const data = new AudioData({
          format: "f32-planar",
          sampleRate: input.sampleRate || sampleRate,
          numberOfFrames: frames,
          numberOfChannels: 2,
          timestamp: audioTs,
          data: planar,
        })
        audioEncoder.encode(data)
        data.close()
        audioTs += Math.round((frames / (input.sampleRate || sampleRate)) * 1_000_000)
      } catch (e) {
        console.warn("[twitter-mp4] AudioData", e)
      }
    }
    source.connect(processor)
    const mute = audioCtx.createGain()
    mute.gain.value = 0
    processor.connect(mute)
    mute.connect(audioCtx.destination)
  } else {
    onStatus?.(
      hasAac
        ? "Encoding H.264 (no live audio bus — video only)"
        : "Encoding H.264 (AAC unavailable — video only)",
    )
  }

  // --- Video frames ---
  const t0 = performance.now()
  for (let i = 0; i < frameCount; i++) {
    if (fatal) throw fatal
    const due = t0 + i * (1000 / FPS)
    const delay = due - performance.now()
    if (delay > 2) await new Promise((r) => setTimeout(r, delay))

    await waitForEncoder(videoEncoder)

    const bitmap = await createImageBitmap(shareCanvas)
    const frame = new VideoFrame(bitmap, {
      timestamp: i * FRAME_US,
      duration: FRAME_US,
    })
    videoEncoder.encode(frame, { keyFrame: i % 30 === 0 || i === 0 })
    frame.close()
    bitmap.close()
  }

  await videoEncoder.flush()
  videoEncoder.close()

  if (audioEncoder) {
    await new Promise((r) => setTimeout(r, 150))
    try {
      await audioEncoder.flush()
      audioEncoder.close()
    } catch (e) {
      console.warn("[twitter-mp4] audio flush", e)
    }
  }
  try {
    processor?.disconnect()
  } catch {
    /* */
  }
  if (audioCtx) await audioCtx.close().catch(() => undefined)

  if (fatal) throw fatal

  muxer.finalize()
  const { buffer } = target
  return new Blob([buffer], { type: "video/mp4" })
}

/**
 * Last-resort: MediaRecorder WebM only (not X-safe) — used only if WebCodecs fails
 * so the user still gets *something*. Prefer throwing for X path.
 */
async function recordWebmFallback(
  shareCanvas: HTMLCanvasElement,
  audioStream: MediaStream | null,
  durationMs: number,
): Promise<Blob> {
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
    ? "video/webm;codecs=vp8,opus"
    : "video/webm"
  const canvasStream = shareCanvas.captureStream(FPS)
  const tracks = [...canvasStream.getVideoTracks()]
  if (audioStream) {
    for (const t of audioStream.getAudioTracks()) {
      if (t.readyState === "live") tracks.push(t)
    }
  }
  const stream = new MediaStream(tracks)
  const chunks: Blob[] = []
  const rec = new MediaRecorder(stream, { mimeType: mime })
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  const done = new Promise<Blob>((resolve, reject) => {
    rec.onerror = () => reject(new Error("MediaRecorder failed"))
    rec.onstop = () =>
      resolve(new Blob(chunks, { type: "video/webm" }))
  })
  rec.start(100)
  await new Promise((r) => setTimeout(r, durationMs))
  if (rec.state !== "inactive") rec.stop()
  for (const t of canvasStream.getVideoTracks()) t.stop()
  return done
}

export type XBlipResult = {
  blob: Blob
  filename: string
  twitterSafe: boolean
}

/**
 * Full Share-on-X pipeline.
 */
export async function createTwitterBlip(options: {
  sourceCanvas: HTMLCanvasElement
  audioStream: MediaStream | null
  durationMs?: number
  onStatus?: (msg: string) => void
}): Promise<XBlipResult> {
  const durationMs = options.durationMs ?? X_VIDEO_MS

  if (!options.sourceCanvas.width || !options.sourceCanvas.height) {
    throw new Error("Visualizer canvas is empty — wait for a Normie to load")
  }

  const shareCanvas = createShareCanvas(options.sourceCanvas)
  const stopMirror = startShareCanvasMirror(options.sourceCanvas, shareCanvas)

  try {
    // Warm a couple of frames so the first encoded frame isn't blank
    paintShareFrame(options.sourceCanvas, shareCanvas)
    await new Promise((r) => requestAnimationFrame(() => r(null)))

    const canAvc = await supportsWebCodecsAvc()
    if (!canAvc) {
      throw new Error(
        "This browser cannot encode H.264 (needed for X). Try Chrome or Edge, or Save Blip as WAV.",
      )
    }

    options.onStatus?.("Encoding X-ready MP4 (H.264)…")
    const blob = await encodeWithWebCodecs(
      shareCanvas,
      options.audioStream,
      durationMs,
      options.onStatus,
    )

    if (!blob || blob.size < 2500) {
      throw new Error("Encoded MP4 was empty")
    }

    return {
      blob,
      filename: `pixelsymphony-blip-${Date.now()}.mp4`,
      twitterSafe: true,
    }
  } finally {
    stopMirror()
  }
}

export { X_VIDEO_MS, recordWebmFallback }
