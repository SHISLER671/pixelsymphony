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

  return `You are PixelSymphony — mycelium forest music from Normie NFTs (not a buzzing hive).

INPUT (authentic on-chain data only):
${JSON.stringify(compact, null, 2)}

FEEL: live forest network. One organism pings; others answer later. Long silence between signals. Reverb connects them like soil.

INSTRUMENTS: ${INSTRUMENTS.join(", ")}
- Type/Accessory pick instrument; Expression/Age/Eyes modulate envelope & filter.

HARD RULES:
1. SPARSE mycelium pings — mostly "rest". NOT dense arps or bee-hive buzzing.
2. Long cycle: ~64 quarter-note steps (durations often 0.6–2.5s). bpm 55–85.
3. Each part needs startOffset (seconds) so voices enter staggered across the loop.
4. Soft pad + occasional bass from primary; other Normies = sparse answering pings.
5. notes: C4 / D#3 / "rest". source "venice". synopsis one plain sentence.

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

/** Client: Venice when small ensemble; always-good synthwave fallback otherwise */
export async function translateToScore(
  voices: NormieVoiceInput[],
): Promise<VoiceScore> {
  if (voices.length === 0) return buildFallbackScore(voices)

  // Large hive → deterministic mix only (fast + reliable)
  if (voices.length > VENICE_VOICE_CAP) {
    return buildFallbackScore(voices)
  }

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voices }),
    })
    if (res.ok) {
      const data = (await res.json()) as { score?: VoiceScore }
      if (data.score?.parts?.length) {
        const unique = new Set(
          data.score.parts.flatMap((p) =>
            p.notes.filter((n) => n && n !== "rest"),
          ),
        )
        // Prefer Venice if it has melodic variety; else fallback
        if (unique.size >= 4) {
          return { ...data.score, source: "venice" }
        }
      }
    }
  } catch {
    // fallback
  }

  return buildFallbackScore(voices)
}
