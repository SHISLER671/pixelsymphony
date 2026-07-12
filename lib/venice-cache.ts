/**
 * Short-lived server cache of Venice scores so the same Normie selection
 * does not re-burn inference credits.
 */

import type { NormieVoiceInput, VoiceScore } from "@/lib/types"

type Entry = {
  score: VoiceScore
  expires: number
}

const store = new Map<string, Entry>()
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

function envTtl(): number {
  const h = Number(process.env.VENICE_CACHE_HOURS ?? "6")
  if (!Number.isFinite(h) || h <= 0) return DEFAULT_TTL_MS
  return Math.min(48, h) * 60 * 60 * 1000
}

/** Stable fingerprint of selected voices (ids + pixel density + key traits). */
export function voiceFingerprint(voices: NormieVoiceInput[]): string {
  return voices
    .map((v) => {
      let on = 0
      for (let i = 0; i < v.pixels.length; i++) if (v.pixels[i] === "1") on++
      const type =
        v.traits.find((t) => t.trait_type === "Type")?.value ?? ""
      const expr =
        v.traits.find((t) => t.trait_type === "Expression")?.value ?? ""
      // sample pixels so canvas edits change the key without shipping 1600 chars twice
      const sample = `${v.pixels.slice(0, 40)}:${v.pixels.slice(780, 820)}:${v.pixels.slice(-40)}`
      return `${v.tokenId}:${on}:${type}:${expr}:${sample}`
    })
    .join("|")
}

export function getCachedVeniceScore(
  voices: NormieVoiceInput[],
): VoiceScore | null {
  const key = voiceFingerprint(voices)
  const hit = store.get(key)
  if (!hit) return null
  if (Date.now() > hit.expires) {
    store.delete(key)
    return null
  }
  return { ...hit.score, source: "venice" }
}

export function setCachedVeniceScore(
  voices: NormieVoiceInput[],
  score: VoiceScore,
): void {
  const key = voiceFingerprint(voices)
  store.set(key, {
    score: { ...score, source: "venice" },
    expires: Date.now() + envTtl(),
  })
  // Cap entries
  if (store.size > 200) {
    const first = store.keys().next().value
    if (first) store.delete(first)
  }
}
