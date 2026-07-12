import type { NormieVoiceInput, VoiceScore } from "@/lib/types"
import { buildFallbackScore } from "@/lib/fallback"

export function buildTranslatePrompt(voices: NormieVoiceInput[]): string {
  const compact = voices.map((v) => {
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

  return `You are PixelSymphony, a translator of on-chain Normie bitmap art into 80s chiptune / synthwave LOOPS (not drones).

INPUT (authentic on-chain data only — never invent traits or pixels):
${JSON.stringify(compact, null, 2)}

HARD RULES:
1. This must sound like a SHORT SONG phrase, not a single sustained beep.
2. Use 32 steps of mostly 16th notes. Include RESTS ("rest") — silence is part of the music.
3. Melodies must MOVE: no more than 2 identical pitches in a row. Use leaps and steps from the pixel sketch contour.
4. Solo Normie: emit TWO parts — a lead (role primary) AND a bass (role counter) from the same NFT so solo is complete.
5. Multiple Normies: distinct registers (lead mid, harmony high, counter/bass low).
6. Trait mapping (audible):
   - Type → scale (Human minor, Cat pentatonic, Alien wholetone, Agent phrygian)
   - Expression → rests & staccato (angry = short punchy; friendly = smoother; sad = more space)
   - Age → tempo bias
   - Eyes → filterHz (shades darker/lower, laser brighter/higher)
7. notes: scientific pitch (C4, D#3) or "rest". durations: seconds matching ~16th–8th at the bpm (e.g. 0.1–0.25 at 110 BPM).
8. synth: square | sawtooth | triangle | pulse
9. scale: major | minor | pentatonic | phrygian | wholetone
10. synopsis: 1–2 sentences naming which traits drove the sound.
11. source must be exactly "venice".

Return ONLY valid JSON (no markdown):
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
        // Prefer fallback if Venice returned a near-drone (too few unique pitches)
        const unique = new Set(
          data.score.parts.flatMap((p) =>
            p.notes.filter((n) => n && n !== "rest"),
          ),
        )
        if (unique.size >= 3) {
          return { ...data.score, source: "venice" }
        }
      }
    }
  } catch {
    // network → fallback
  }

  return buildFallbackScore(voices)
}
