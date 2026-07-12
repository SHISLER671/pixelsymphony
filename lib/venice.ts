import type { InstrumentId, NormieVoiceInput, VoiceScore } from "@/lib/types"
import { VENICE_VOICE_CAP } from "@/lib/types"
import { buildFallbackScore } from "@/lib/fallback"

const INSTRUMENTS: InstrumentId[] = [
  "agent-pad",
  "human-lead",
  "cat-pluck",
  "alien-bell",
  "choir-ah",
  "bass-sub",
  "arp-pulse",
  "glass-keys",
  "noise-breath",
]

export function buildTranslatePrompt(voices: NormieVoiceInput[]): string {
  const compact = voices.slice(0, VENICE_VOICE_CAP).map((v) => {
    let on = 0
    for (let i = 0; i < v.pixels.length; i++) if (v.pixels[i] === "1") on++
    const grid: string[] = []
    for (let by = 0; by < 8; by++) {
      let row = ""
      for (let bx = 0; bx < 8; bx++) {
        let cell = 0
        for (let dy = 0; dy < 5; dy++) {
          for (let dx = 0; dx < 5; dx++) {
            const x = bx * 5 + dx
            const y = by * 5 + dy
            if (x < 40 && y < 40 && v.pixels[y * 40 + x] === "1") cell++
          }
        }
        row += cell > 6 ? "█" : cell > 2 ? "▒" : "·"
      }
      grid.push(row)
    }
    return {
      tokenId: v.tokenId,
      name: v.name,
      role: v.role,
      density: Math.round((on / 1600) * 100) / 100,
      traits: Object.fromEntries(
        v.traits.map((t) => [t.trait_type, t.value]),
      ),
      pixelSketch8x8: grid,
    }
  })

  return `You are PixelSymphony — forest synth songs from Normie NFTs.

INPUT (authentic on-chain data only):
${JSON.stringify(compact, null, 2)}

FEEL: one Normie = a full song (lead + pad + bass + harmony phrases). Multiple = same song bed with answering phrases, light stagger — NOT empty silence, NOT a wall of bees.

INSTRUMENTS: ${INSTRUMENTS.join(", ")}
- Type/Accessory pick instrument; Expression/Age/Eyes modulate envelope & filter.

HARD RULES:
1. MELODIC PHRASES (3–8 notes) with short breaths — never a single repeated beep, never long empty voids.
2. Cycle ~64 eighth notes, bpm 75–105. Solo must include pad, bass, lead, harmony.
3. Multi: primary full stack; others startOffset small (0–20% of loop) with answering phrases.
4. notes: C4 / D#3 / "rest". source "venice". synopsis one plain sentence.

Return ONLY JSON:
{
  "bpm": number,
  "root": string,
  "scale": "major"|"minor"|"pentatonic"|"phrygian"|"wholetone"|"dorian"|"mixolydian",
  "swing": number,
  "loopSeconds": number,
  "parts": [{
    "role": "primary"|"harmony"|"counter"|"pad"|"bass"|"arp",
    "instrument": string,
    "notes": string[],
    "durations": number[],
    "filterHz": number,
    "gain": number,
    "attack": number,
    "decay": number,
    "sustain": number,
    "release": number,
    "pan": number,
    "reverbSend": number,
    "delaySend": number,
    "startOffset": number,
    "tokenId": number
  }],
  "synopsis": string,
  "source": "venice"
}`
}

export function parseVoiceScore(raw: string): VoiceScore | null {
  try {
    let text = raw.trim()
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    }
    const data = JSON.parse(text) as VoiceScore
    if (
      typeof data.bpm !== "number" ||
      !data.root ||
      !data.scale ||
      !Array.isArray(data.parts) ||
      data.parts.length === 0
    ) {
      return null
    }
    for (const p of data.parts) {
      if (!Array.isArray(p.notes) || !Array.isArray(p.durations)) return null
      if (p.notes.length === 0) return null
      const n = Math.min(p.notes.length, p.durations.length)
      p.notes = p.notes.slice(0, n)
      p.durations = p.durations.slice(0, n)
      if (!p.instrument) {
        // map legacy synth field
        const s = (p as { synth?: string }).synth
        if (s === "triangle") p.instrument = "cat-pluck"
        else if (s === "square" || s === "pulse") p.instrument = "arp-pulse"
        else if (s === "sawtooth") p.instrument = "human-lead"
        else p.instrument = "human-lead"
      }
      if (!INSTRUMENTS.includes(p.instrument)) {
        p.instrument = "human-lead"
      }
    }
    data.source = "venice"
    return data
  } catch {
    return null
  }
}

/** Client memory cache — same selection won't re-hit the API this session. */
const clientScoreCache = new Map<string, VoiceScore>()

function clientCacheKey(voices: NormieVoiceInput[]): string {
  return voices
    .map((v) => {
      let on = 0
      for (let i = 0; i < v.pixels.length; i++) if (v.pixels[i] === "1") on++
      return `${v.tokenId}:${on}:${v.role}`
    })
    .join("|")
}

/**
 * Client: try Venice (budgeted + cached server-side); always-good fallback.
 * Large ensembles skip Venice entirely.
 */
export async function translateToScore(
  voices: NormieVoiceInput[],
): Promise<VoiceScore> {
  if (voices.length === 0) return buildFallbackScore(voices)

  // Large hive → deterministic mix only (fast + no Venice spend)
  if (voices.length > VENICE_VOICE_CAP) {
    return buildFallbackScore(voices)
  }

  const key = clientCacheKey(voices)
  const cached = clientScoreCache.get(key)
  if (cached) return cached

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voices }),
    })
    if (res.ok) {
      const data = (await res.json()) as {
        score?: VoiceScore
        reason?: string
      }
      if (data.score?.parts?.length) {
        // Only mark as venice when the server actually used AI
        const fromVenice =
          data.reason === "venice" || data.reason === "venice_cache"
        if (fromVenice) {
          const unique = new Set(
            data.score.parts.flatMap((p) =>
              p.notes.filter((n) => n && n !== "rest"),
            ),
          )
          if (unique.size >= 4) {
            const score = { ...data.score, source: "venice" as const }
            clientScoreCache.set(key, score)
            return score
          }
        }
        // Rate-limited / fallback path — still play, tag correctly
        const score = {
          ...data.score,
          source: data.score.source === "venice" ? "venice" as const : "fallback" as const,
        }
        // Cache fallbacks briefly so spam-clicking doesn't re-POST
        clientScoreCache.set(key, score)
        return score.source === "venice" ? score : buildFallbackScore(voices)
      }
    }
  } catch {
    // fallback
  }

  const score = buildFallbackScore(voices)
  clientScoreCache.set(key, score)
  return score
}
