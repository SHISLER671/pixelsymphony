/**
 * Share-friendly Blip export helpers (WAV + video container detection).
 */

/** Encode an AudioBuffer as a standard 16-bit PCM WAV (plays everywhere). */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const samples = buffer.length
  const dataSize = samples * blockAlign
  const headerSize = 44
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(arrayBuffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeStr(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, "WAVE")
  writeStr(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeStr(36, "data")
  view.setUint32(40, dataSize, true)

  // Interleave channels
  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c))
  }

  let offset = 44
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i] ?? 0))
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, int16, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" })
}

/** Decode a MediaRecorder blob (webm/ogg/mp4) into an AudioBuffer. */
export async function blobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
  const ctx = new AudioContext()
  try {
    const ab = await blob.arrayBuffer()
    return await ctx.decodeAudioData(ab.slice(0))
  } finally {
    await ctx.close().catch(() => undefined)
  }
}

export async function blobToWav(blob: Blob): Promise<Blob> {
  const buffer = await blobToAudioBuffer(blob)
  return audioBufferToWav(buffer)
}

/** Best video mime the browser can record for social upload. */
export function pickVideoMime(): string | null {
  return pickTwitterVideoProfile()?.mime ?? null
}

export type TwitterVideoProfile = {
  mime: string
  ext: "mp4" | "webm"
  /** True only when codecs are likely H.264 + AAC (X-friendly). */
  twitterSafe: boolean
}

/**
 * Pick a recorder profile for X/Twitter.
 * Never label a file .mp4 unless we have a real MP4/AAC path —
 * wrong extensions cause X "Incompatible audio codecs".
 */
export function pickTwitterVideoProfile(): TwitterVideoProfile | null {
  if (typeof MediaRecorder === "undefined") return null

  // Explicit AVC + AAC — best for X when the browser supports it (often Safari)
  const mp4Safe = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    "video/mp4;codecs=avc1.4D401E,mp4a.40.2",
    "video/mp4;codecs=avc1.64001F,mp4a.40.2",
  ]
  for (const m of mp4Safe) {
    if (MediaRecorder.isTypeSupported(m)) {
      return { mime: m, ext: "mp4", twitterSafe: true }
    }
  }

  // Safari / Apple WebKit bare video/mp4 is usually H.264 + AAC
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
  const isAppleWebKit =
    /AppleWebKit/i.test(ua) &&
    !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua)
  if (isAppleWebKit && MediaRecorder.isTypeSupported("video/mp4")) {
    return { mime: "video/mp4", ext: "mp4", twitterSafe: true }
  }

  // Chrome/Firefox: WebM is reliable. Do NOT rename to .mp4 (breaks X audio).
  const webm = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8",
    "video/webm",
  ]
  for (const m of webm) {
    if (MediaRecorder.isTypeSupported(m)) {
      return { mime: m, ext: "webm", twitterSafe: false }
    }
  }

  // Last resort: bare video/mp4 on non-Apple (may still fail X audio check)
  if (MediaRecorder.isTypeSupported("video/mp4")) {
    return { mime: "video/mp4", ext: "mp4", twitterSafe: false }
  }
  return null
}

export function extensionForMime(mime: string): string {
  if (mime.includes("mp4")) return "mp4"
  if (mime.includes("wav")) return "wav"
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3"
  if (mime.includes("webm")) return "webm"
  return "bin"
}

/**
 * Record canvas (Normie pixels) + live audio bus into a short video blob.
 * Plays alongside whatever is already scheduled on the audio engine.
 */
export async function recordPixelVideoBlip(options: {
  canvas: HTMLCanvasElement
  /** Live audio MediaStream (e.g. Tone destination tap) */
  audioStream: MediaStream | null
  durationMs?: number
  fps?: number
}): Promise<{ blob: Blob; filename: string; twitterSafe: boolean; mime: string }> {
  const profile = pickTwitterVideoProfile()
  if (!profile) {
    throw new Error("This browser cannot record video")
  }

  const durationMs = options.durationMs ?? 12_000
  const fps = options.fps ?? 30
  const canvasStream = options.canvas.captureStream(fps)

  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()]
  if (options.audioStream) {
    for (const t of options.audioStream.getAudioTracks()) {
      if (t.readyState === "live") tracks.push(t)
    }
  }
  const combined = new MediaStream(tracks)

  const chunks: Blob[] = []
  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(combined, {
      mimeType: profile.mime,
      videoBitsPerSecond: 2_500_000,
      audioBitsPerSecond: 128_000,
    })
  } catch {
    // Some browsers reject bitsPerSecond or exact mime — retry bare
    recorder = new MediaRecorder(combined, { mimeType: profile.mime })
  }

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Video recording failed"))
    recorder.onstop = () => {
      const type = profile.mime.split(";")[0] || profile.mime
      resolve(new Blob(chunks, { type }))
    }
  })

  recorder.start(100)
  await new Promise((r) => setTimeout(r, durationMs))
  if (recorder.state !== "inactive") recorder.stop()

  // Only stop canvas video tracks we created
  for (const t of canvasStream.getVideoTracks()) t.stop()

  const blob = await done
  if (blob.size < 1000) {
    throw new Error("Recording was empty — try Play first, then Share on X")
  }

  const filename = `pixelsymphony-blip-${Date.now()}.${profile.ext}`
  return {
    blob,
    filename,
    twitterSafe: profile.twitterSafe && profile.ext === "mp4",
    mime: profile.mime,
  }
}

/** Open X/Twitter compose with pre-filled text (web cannot auto-attach files). */
export function openXCompose(text: string, pageUrl?: string) {
  const params = new URLSearchParams()
  params.set("text", text)
  if (pageUrl) params.set("url", pageUrl)
  window.open(
    `https://twitter.com/intent/tweet?${params.toString()}`,
    "_blank",
    "noopener,noreferrer",
  )
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  // revoke after click settles
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Prefer native share sheet when the OS accepts the file (mobile-friendly). */
export async function tryNativeShare(file: File, title: string, text: string) {
  if (typeof navigator === "undefined" || !navigator.share) return false
  try {
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return false
    }
    await navigator.share({ files: [file], title, text })
    return true
  } catch {
    return false
  }
}
