import type {
  NormieTrait,
  NormieVoiceInput,
  ScaleName,
  SynthType,
  VoicePart,
  VoiceRole,
  VoiceScore,
} from "@/lib/types"

/** FNV-1a 32-bit */
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
  for (let i = 0; i < pixels.length; i++) if (pixels[i] === "1") on++
  return on / Math.max(pixels.length, 1)
}

/** 16 band row energies (bin 40 rows → 16) */
function rowBands(pixels: string, bands = 16): number[] {
  const out: number[] = []
  const rowsPer = 40 / bands
  for (let b = 0; b < bands; b++) {
    let sum = 0
    let count = 0
    const y0 = Math.floor(b * rowsPer)
    const y1 = Math.floor((b + 1) * rowsPer)
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < 40; x++) {
        if (pixels[y * 40 + x] === "1") sum++
        count++
      }
    }
    out.push(sum / Math.max(count, 1))
  }
  return out
}

/** Moving horizontal centroid across row bands — pitch contour over time */
function contourBands(pixels: string, bands = 16): number[] {
  const out: number[] = []
  const rowsPer = 40 / bands
  for (let b = 0; b < bands; b++) {
    let mass = 0
    let weighted = 0
    const y0 = Math.floor(b * rowsPer)
    const y1 = Math.floor((b + 1) * rowsPer)
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < 40; x++) {
        if (pixels[y * 40 + x] === "1") {
          mass++
          weighted += x
        }
      }
    }
    out.push(mass === 0 ? 0.5 : weighted / mass / 40)
  }
  return out
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

function noteName(rootIndex: number, degree: number, octave: number): string {
  const idx = (rootIndex + degree + 120) % 12
  return `${ROOTS[idx]}${octave}`
}

/** 16th-note seconds at bpm */
function sixteenthSec(bpm: number): number {
  return 60 / bpm / 4
}

type PhraseKind = "lead" | "bass" | "harmony" | "counter"

function synthFor(
  kind: PhraseKind,
  type: string,
  accessory: string,
): SynthType {
  if (kind === "bass") return "sawtooth"
  if (kind === "harmony") return "triangle"
  if (kind === "counter") return accessory.toLowerCase().includes("laser")
    ? "pulse"
    : "square"
  // lead
  if (type.toLowerCase() === "agent") return "sawtooth"
  if (type.toLowerCase() === "alien") return "pulse"
  if (type.toLowerCase() === "cat") return "triangle"
  return "square"
}

function roleForKind(kind: PhraseKind): VoiceRole {
  if (kind === "harmony") return "harmony"
  if (kind === "bass" || kind === "counter") return "counter"
  return "primary"
}

/**
 * Build a 32-step (2 bars × 16) chiptune phrase from pixels + traits.
 * Durations are real seconds derived from BPM so Transport.bpm matches feel.
 */
function buildPhrase(
  voice: NormieVoiceInput,
  scale: ScaleName,
  rootIndex: number,
  bpm: number,
  kind: PhraseKind,
  rng: () => number,
): VoicePart {
  const dens = pixelDensity(voice.pixels)
  const energy = rowBands(voice.pixels, 16)
  const contour = contourBands(voice.pixels, 16)
  const type = traitValue(voice.traits, "Type") || "Human"
  const expression = traitValue(voice.traits, "Expression").toLowerCase()
  const age = traitValue(voice.traits, "Age").toLowerCase()
  const eyes = traitValue(voice.traits, "Eyes").toLowerCase()
  const accessory = traitValue(voice.traits, "Accessory")
  const hair = traitValue(voice.traits, "Hair Style")
  const degrees = SCALES[scale]
  const step = sixteenthSec(bpm)

  // 2 bars of 16ths = 32 steps
  const steps = 32
  const notes: string[] = []
  const durations: number[] = []

  let baseOctave = 4
  if (kind === "bass") baseOctave = 2
  else if (kind === "harmony") baseOctave = 5
  else if (kind === "counter") baseOctave = 3
  if (age === "old" && kind === "lead") baseOctave = 3
  if (age === "young" && kind === "lead") baseOctave = 4

  // Expression → rest density & staccato length
  let restBias = 0.15
  let noteLenMul = 1
  if (expression.includes("friendly")) {
    restBias = 0.08
    noteLenMul = 0.85
  } else if (expression.includes("angry") || expression.includes("mad")) {
    restBias = 0.05
    noteLenMul = 0.55
  } else if (expression.includes("sad") || expression.includes("sleepy")) {
    restBias = 0.28
    noteLenMul = 1.4
  } else if (expression.includes("smug") || expression.includes("cool")) {
    restBias = 0.18
    noteLenMul = 0.7
  }

  // Hair / accessory seed offset into scale
  const motifOffset =
    (hashString(hair + accessory + String(voice.tokenId)) % degrees.length)

  let lastDegree = -99
  let sameCount = 0

  for (let i = 0; i < steps; i++) {
    const band = i % 16
    const bar = Math.floor(i / 16)
    const e = energy[band] ?? 0
    const c = contour[band] ?? 0.5

    // Bass hits stronger on beats 1 & 3 (every 4 sixteenths)
    if (kind === "bass") {
      if (i % 4 !== 0) {
        notes.push("rest")
        durations.push(step)
        continue
      }
    }

    // Harmony: off-beat sparkles
    if (kind === "harmony") {
      if (i % 2 === 0 && e < 0.2) {
        notes.push("rest")
        durations.push(step)
        continue
      }
    }

    // Lead/counter: rests from sparse rows + expression
    const threshold =
      kind === "lead" ? 0.06 + dens * 0.1 : 0.1 + dens * 0.12
    if (e < threshold && rng() < restBias + (1 - e) * 0.25) {
      notes.push("rest")
      durations.push(step)
      continue
    }

    // Pitch from moving contour + band index (forces motion)
    let degreeIdx = Math.floor(
      (c * (degrees.length - 1) +
        e * 2 +
        motifOffset +
        bar +
        (kind === "harmony" ? 2 : 0) +
        (kind === "bass" ? 0 : i * 0.15)) %
        degrees.length,
    )
    degreeIdx = ((degreeIdx % degrees.length) + degrees.length) % degrees.length

    // No more than 2 identical pitches in a row
    if (degreeIdx === lastDegree) {
      sameCount++
      if (sameCount >= 2) {
        degreeIdx = (degreeIdx + 1 + Math.floor(rng() * 2)) % degrees.length
        sameCount = 0
      }
    } else {
      sameCount = 0
    }
    lastDegree = degreeIdx

    const degree = degrees[degreeIdx]
    let octave = baseOctave
    if (kind === "lead" && e > 0.45) octave += 1
    if (kind === "lead" && c < 0.25) octave = Math.max(3, octave - 1)
    if (kind === "bass") {
      // Prefer root / fifth — duration stays one 16th so all parts loop-lock
      const bassDeg = degrees[i % 8 < 4 ? 0 : Math.min(4, degrees.length - 1)]
      notes.push(noteName(rootIndex, bassDeg, baseOctave))
      durations.push(step)
      continue
    }

    notes.push(noteName(rootIndex, degree, octave))

    // Grid-locked 16ths (envelope does the staccato, not grid stretch)
    durations.push(step)
  }

  // Ensure solo completeness: enough non-rests
  const hits = notes.filter((n) => n !== "rest").length
  if (hits < 6) {
    for (let i = 0; i < steps; i += 4) {
      notes[i] = noteName(
        rootIndex,
        degrees[(motifOffset + i / 4) % degrees.length],
        baseOctave,
      )
      durations[i] = step
    }
  }

  // Eyes → filter brightness
  let filterHz = 900 + dens * 2200 + motifOffset * 40
  if (eyes.includes("shade") || eyes.includes("closed")) filterHz *= 0.55
  if (eyes.includes("laser") || eyes.includes("glow")) filterHz *= 1.45
  if (eyes.includes("big")) filterHz *= 1.15
  if (kind === "bass") filterHz = Math.min(filterHz, 800)

  const gainBase =
    kind === "lead" ? 0.32 : kind === "bass" ? 0.22 : kind === "harmony" ? 0.16 : 0.14

  return {
    role: roleForKind(kind),
    synth: synthFor(kind, type, accessory),
    notes,
    durations,
    filterHz: Math.round(Math.min(4800, Math.max(180, filterHz))),
    gain: gainBase,
  }
}

/**
 * Deterministic chiptune score from live Normie pixels + traits.
 * Solo: lead + bass from the primary Normie (complete mini-song).
 * Multi: primary lead(+bass), 2nd harmony, 3rd counter.
 */
export function buildFallbackScore(voices: NormieVoiceInput[]): VoiceScore {
  if (voices.length === 0) {
    return {
      bpm: 100,
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

  const primary = voices[0]
  const dens = pixelDensity(primary.pixels)
  const type = traitValue(primary.traits, "Type") || "Human"
  const age = traitValue(primary.traits, "Age")
  const expression = traitValue(primary.traits, "Expression") || "Unknown"
  const eyes = traitValue(primary.traits, "Eyes")

  let bpm = Math.round(88 + dens * 56)
  if (age.toLowerCase() === "old") bpm = Math.round(bpm * 0.88)
  if (age.toLowerCase() === "young") bpm = Math.round(bpm * 1.12)
  bpm = Math.min(140, Math.max(78, bpm))

  const scale = scaleFromType(type)
  const rootIndex = seed % 12
  const root = ROOTS[rootIndex]

  const parts: VoicePart[] = []

  // Primary always gets lead + bass (solo completeness)
  parts.push(
    buildPhrase(
      primary,
      scale,
      rootIndex,
      bpm,
      "lead",
      mulberry32(seed ^ 0x1111),
    ),
  )
  parts.push(
    buildPhrase(
      primary,
      scale,
      rootIndex,
      bpm,
      "bass",
      mulberry32(seed ^ 0x2222),
    ),
  )

  if (voices[1]) {
    parts.push(
      buildPhrase(
        voices[1],
        scale,
        rootIndex,
        bpm,
        "harmony",
        mulberry32(seed ^ 0x3333),
      ),
    )
  }
  if (voices[2]) {
    parts.push(
      buildPhrase(
        voices[2],
        scale,
        rootIndex,
        bpm,
        "counter",
        mulberry32(seed ^ 0x4444),
      ),
    )
  }

  const densPct = Math.round(dens * 100)
  const multi =
    voices.length > 1
      ? ` Ensemble: #${voices.map((v) => v.tokenId).join(", #")} as lead/harmony/counter.`
      : " Solo includes lead + bass from the same pixels."

  const synopsis = `Normie #${primary.tokenId} (${type}) → ${bpm} BPM ${root} ${scale} chiptune. ${densPct}% density sets tempo; ${expression} shapes rests/articulation; ${eyes || "eyes"} tint the filter.${multi}`

  return {
    bpm,
    root,
    scale,
    parts,
    synopsis,
    source: "fallback",
  }
}
