import type { NormieVoiceInput, VoiceScore } from "@/lib/types"
import { buildFallbackScore } from "@/lib/fallback"

export function buildTranslatePrompt(voices: NormieVoiceInput[]): string {
  const compact = voices.map((v) => {
    // Compress pixels: density + 8x8 downsample for prompt size
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

  return `You are PixelSymphony, a translator of on-chain Normie bitmap art into synthwave scores.

INPUT (authentic on-chain data only — never invent traits or pixels):
${JSON.stringify(compact, null, 2)}

RULES:
1. Music MUST derive from pixel density, spatial structure (sketch), and trait labels.
2. Solo voice is complete — one Normie needs a finished loopable melody.
3. Up to 3 voices: primary, harmony, counter with distinct registers.
4. Keep patterns loopable ~4–8 bars (32 note slots).
5. notes use scientific pitch (C4, D#3) or "rest". durations are seconds (0.125, 0.25, 0.5, 1).
6. synth is one of: square, sawtooth, triangle, pulse.
7. scale is one of: major, minor, pentatonic, phrygian, wholetone.
8. synopsis: 1–2 sentences explaining the mapping in plain language.
9. source must be exactly "venice".

Return ONLY valid JSON matching this schema (no markdown):
{
  "bpm": number,
  "root": string,
  "scale": "major"|"minor"|"pentatonic"|"phrygian"|"wholetone",
  "parts": [{
    "role": "primary"|"harmony"|"counter",
    "synth": "square"|"sawtooth"|"triangle"|"pulse",
    "notes": string[],
    "durations": number[],
    "filterHz": number,
    "gain": number
  }],
  "synopsis": string,
  "source": "venice"
}`
}

export function parseVoiceScore(raw: string): VoiceScore | null {
  try {
    let text = raw.trim()
    // Strip markdown fences if present
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
      // Align lengths
      const n = Math.min(p.notes.length, p.durations.length)
      p.notes = p.notes.slice(0, n)
      p.durations = p.durations.slice(0, n)
    }
    data.source = "venice"
    return data
  } catch {
    return null
  }
}

/** Client: ask server for Venice translation, fall back locally */
export async function translateToScore(
  voices: NormieVoiceInput[],
): Promise<VoiceScore> {
  if (voices.length === 0) return buildFallbackScore(voices)

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voices }),
    })
    if (res.ok) {
      const data = (await res.json()) as { score?: VoiceScore; error?: string }
      if (data.score?.parts?.length) {
        return { ...data.score, source: "venice" }
      }
    }
  } catch {
    // network / timeout → fallback
  }

  return buildFallbackScore(voices)
}
