import type {
  NormieTrait,
  NormieVoiceInput,
  ScaleName,
  SynthType,
  VoicePart,
  VoiceRole,
  VoiceScore,
} from "@/lib/types"

/** FNV-1a 32-bit hash for deterministic seeding */
function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function traitValue(traits: NormieTrait[], type: string): string {
  const found = traits.find(
    (t) => t.trait_type.toLowerCase() === type.toLowerCase(),
  )
  return found ? String(found.value) : ""
}

function pixelDensity(pixels: string): number {
  let on = 0
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i] === "1") on++
  }
  return on / Math.max(pixels.length, 1)
}

function rowEnergies(pixels: string): number[] {
  const rows: number[] = []
  for (let y = 0; y < 40; y++) {
    let sum = 0
    for (let x = 0; x < 40; x++) {
      if (pixels[y * 40 + x] === "1") sum++
    }
    rows.push(sum / 40)
  }
  return rows
}

function colCentroid(pixels: string): number {
  let mass = 0
  let weighted = 0
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
      if (pixels[y * 40 + x] === "1") {
        mass++
        weighted += x
      }
    }
  }
  return mass === 0 ? 20 : weighted / mass
}

const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

const SCALES: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  wholetone: [0, 2, 4, 6, 8, 10],
}

function scaleFromType(type: string): ScaleName {
  switch (type.toLowerCase()) {
    case "cat":
      return "pentatonic"
    case "alien":
      return "wholetone"
    case "agent":
      return "phrygian"
    case "human":
    default:
      return "minor"
  }
}

function synthFromRole(role: VoiceRole, type: string): SynthType {
  if (role === "primary") {
    if (type.toLowerCase() === "agent") return "sawtooth"
    if (type.toLowerCase() === "alien") return "pulse"
    return "square"
  }
  if (role === "harmony") return "triangle"
  return "sawtooth"
}

function noteName(rootIndex: number, degree: number, octave: number): string {
  const idx = (rootIndex + degree + 120) % 12
  return `${ROOTS[idx]}${octave}`
}

function buildPart(
  voice: NormieVoiceInput,
  scale: ScaleName,
  rootIndex: number,
  rng: () => number,
): VoicePart {
  const dens = pixelDensity(voice.pixels)
  const rows = rowEnergies(voice.pixels)
  const centroid = colCentroid(voice.pixels)
  const type = traitValue(voice.traits, "Type") || "Human"
  const expression = traitValue(voice.traits, "Expression")
  const degrees = SCALES[scale]
  const steps = 32
  const notes: Array<string> = []
  const durations: number[] = []

  const baseOctave =
    voice.role === "primary" ? 4 : voice.role === "harmony" ? 5 : 3

  // Bin 40 rows into 32 steps
  for (let i = 0; i < steps; i++) {
    const rowIdx = Math.floor((i / steps) * 40)
    const energy = rows[rowIdx] ?? 0
    const threshold = 0.12 + dens * 0.15

    // Soft rests for sparse rows
    if (energy < threshold * 0.45 && rng() > energy + 0.25) {
      notes.push("rest")
      durations.push(0.25)
      continue
    }

    const degreeIdx = Math.floor(
      ((centroid / 40) * degrees.length + energy * degrees.length + rng() * 2) %
        degrees.length,
    )
    const degree = degrees[Math.max(0, degreeIdx) % degrees.length]
    let octave = baseOctave
    if (energy > 0.55) octave += 1
    if (energy < 0.2 && voice.role === "counter") octave -= 0

    // Friendly expression → more stepwise motion (favor lower degrees)
    if (expression.toLowerCase() === "friendly" && rng() > 0.5) {
      const soft = degrees[Math.floor(rng() * Math.min(4, degrees.length))]
      notes.push(noteName(rootIndex, soft, octave))
    } else {
      notes.push(noteName(rootIndex, degree, octave))
    }

    // Rhythm from local energy
    if (energy > 0.65) durations.push(0.125)
    else if (energy > 0.35) durations.push(0.25)
    else durations.push(0.5)
  }

  // Ensure solo completeness: at least some notes
  const onlyRests = notes.filter((n) => n !== "rest").length === 0
  if (onlyRests && notes.length > 0) {
    notes.splice(
      0,
      notes.length,
      noteName(rootIndex, degrees[0], baseOctave),
      "rest",
      "rest",
      "rest",
      noteName(rootIndex, degrees[2 % degrees.length], baseOctave),
      "rest",
      "rest",
      "rest",
      noteName(rootIndex, degrees[4 % degrees.length], baseOctave),
      "rest",
      "rest",
      "rest",
      noteName(rootIndex, degrees[0], baseOctave),
    )
    for (let i = 0; i < notes.length; i++) {
      durations[i] = notes[i] === "rest" ? 0.25 : 0.5
    }
  }

  const eyes = traitValue(voice.traits, "Eyes")
  let filterHz = 600 + dens * 1800 + (centroid / 40) * 400
  if (eyes.toLowerCase().includes("shade")) filterHz *= 0.75
  if (eyes.toLowerCase().includes("laser")) filterHz *= 1.35

  const gain =
    voice.role === "primary" ? 0.38 : voice.role === "harmony" ? 0.22 : 0.18

  return {
    role: voice.role,
    synth: synthFromRole(voice.role, type),
    notes,
    durations,
    filterHz: Math.round(Math.min(4200, Math.max(200, filterHz))),
    gain,
  }
}

/**
 * Deterministic mapping of live Normie pixels + traits → VoiceScore.
 * Always available when Venice is offline or returns invalid JSON.
 */
export function buildFallbackScore(voices: NormieVoiceInput[]): VoiceScore {
  if (voices.length === 0) {
    return {
      bpm: 96,
      root: "A",
      scale: "minor",
      parts: [],
      synopsis: "No Normies selected — silence in the hive.",
      source: "fallback",
    }
  }

  const seedMaterial = voices
    .map(
      (v) =>
        `${v.tokenId}:${v.pixels}:${v.traits.map((t) => `${t.trait_type}=${t.value}`).join(",")}`,
    )
    .join("|")
  const seed = hashString(seedMaterial)
  const rng = mulberry32(seed)

  const primary = voices[0]
  const dens = pixelDensity(primary.pixels)
  const type = traitValue(primary.traits, "Type") || "Human"
  const age = traitValue(primary.traits, "Age")
  const expression = traitValue(primary.traits, "Expression") || "Unknown"

  let bpm = Math.round(72 + dens * 76)
  if (age.toLowerCase() === "old") bpm = Math.round(bpm * 0.9)
  if (age.toLowerCase() === "young") bpm = Math.round(bpm * 1.08)
  bpm = Math.min(148, Math.max(72, bpm))

  const scale = scaleFromType(type)
  const rootIndex = seed % 12
  const root = ROOTS[rootIndex]

  const parts: VoicePart[] = voices.map((v, i) => {
    const partRng = mulberry32(seed ^ ((i + 1) * 0x9e3779b9))
    return buildPart(v, scale, rootIndex, partRng)
  })

  const densPct = Math.round(dens * 100)
  const multi =
    voices.length > 1
      ? ` ${voices.length} Normies layered (primary + ${voices.length - 1} harmony).`
      : " Solo voice is complete."

  const synopsis = `Normie #${primary.tokenId} (${type}) maps ${densPct}% pixel density to ${bpm} BPM in ${root} ${scale}. ${expression} expression shapes articulation.${multi}`

  return {
    bpm,
    root,
    scale,
    parts,
    synopsis,
    source: "fallback",
  }
}
