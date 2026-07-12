/**
 * Mobile-friendly share helpers.
 * Prefers OS share sheet (X / Messages / TikTok / Files) over web intents.
 */

export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false
  }
  const ua = navigator.userAgent || ""
  if (/Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true
  }
  // iPadOS desktop UA
  if (navigator.maxTouchPoints > 1 && /MacIntel/.test(navigator.platform || "")) {
    return true
  }
  // Coarse pointer + narrow viewport as soft signal
  try {
    if (
      window.matchMedia("(pointer: coarse)").matches &&
      window.matchMedia("(max-width: 900px)").matches
    ) {
      return true
    }
  } catch {
    /* */
  }
  return false
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function"
}

export function canNativeShareFiles(): boolean {
  if (!canNativeShare() || typeof File === "undefined") return false
  try {
    const probe = new File([new Uint8Array([0])], "probe.txt", {
      type: "text/plain",
    })
    if (navigator.canShare) {
      return navigator.canShare({ files: [probe] })
    }
    // Older Safari: share exists but canShare may not — attempt files later
    return true
  } catch {
    return false
  }
}

export type NativeShareResult =
  | "shared-file"
  | "shared-text"
  | "cancelled"
  | "unsupported"

/**
 * Share a file and/or text via the OS sheet.
 * Never throws on user cancel.
 */
export async function nativeShare(options: {
  title: string
  text: string
  url?: string
  file?: File | null
}): Promise<NativeShareResult> {
  if (!canNativeShare()) return "unsupported"

  const { title, text, url, file } = options
  const pageUrl = url || (typeof window !== "undefined" ? window.location.href : "")

  // 1) File share (best for X / TikTok / Messages)
  if (file) {
    try {
      const payload: ShareData = {
        files: [file],
        title,
        text: `${text}${pageUrl ? `\n${pageUrl}` : ""}`,
      }
      if (!navigator.canShare || navigator.canShare(payload)) {
        await navigator.share(payload)
        return "shared-file"
      }
    } catch (e) {
      const name = e instanceof Error ? e.name : ""
      if (name === "AbortError") return "cancelled"
      // fall through to text share
    }
  }

  // 2) Text + URL only
  try {
    const payload: ShareData = {
      title,
      text,
      url: pageUrl || undefined,
    }
    if (!navigator.canShare || navigator.canShare(payload)) {
      await navigator.share(payload)
      return "shared-text"
    }
  } catch (e) {
    const name = e instanceof Error ? e.name : ""
    if (name === "AbortError") return "cancelled"
  }

  return "unsupported"
}

/** Snapshot visualizer to a shareable PNG (always works on iOS). */
export async function canvasToPngFile(
  canvas: HTMLCanvasElement,
  name = `pixelsymphony-${Date.now()}.png`,
): Promise<File> {
  // Upscale for nicer share cards
  const size = 720
  const out = document.createElement("canvas")
  out.width = size
  out.height = size
  const ctx = out.getContext("2d")
  if (!ctx) throw new Error("Could not create image")
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, size, size)
  ctx.imageSmoothingEnabled = false
  const sw = Math.max(1, canvas.width)
  const sh = Math.max(1, canvas.height)
  const scale = Math.min(size / sw, size / sh) * 0.9
  const dw = Math.floor(sw * scale)
  const dh = Math.floor(sh * scale)
  const dx = Math.floor((size - dw) / 2)
  const dy = Math.floor((size - dh) / 2 - 12)
  ctx.drawImage(canvas, 0, 0, sw, sh, dx, dy, dw, dh)
  ctx.fillStyle = "rgba(0,0,0,0.75)"
  ctx.fillRect(0, size - 48, size, 48)
  ctx.fillStyle = "#eee"
  ctx.font = "bold 18px monospace"
  ctx.fillText("PixelSymphony", 20, size - 18)

  const blob = await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))),
      "image/png",
    )
  })
  return new File([blob], name, { type: "image/png" })
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* */
  }
  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.position = "fixed"
    ta.style.left = "-9999px"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    ta.remove()
    return ok
  } catch {
    return false
  }
}
