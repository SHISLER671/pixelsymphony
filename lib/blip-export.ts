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
  if (typeof MediaRecorder === "undefined") return null
  const candidates = [
    "video/mp4",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ]
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m
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
