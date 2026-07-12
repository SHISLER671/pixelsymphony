import type {
  InstrumentId,
  NormieTrait,
  NormieVoiceInput,
  ScaleName,
  VoicePart,
  VoiceRole,
  VoiceScore,
} from "@/lib/types"
import { MAX_AUDIO_PARTS } from "@/lib/types"

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
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
}

/**
 * INSTRUMENTS (what makes sound) ← Type, Accessory, Gender
 * MODULATORS (how it sounds)    ← Expression, Age, Eyes, Hair, Facial, pixels
 */
function instrumentFromTraits(
  traits: NormieTrait[],
  kind: VoiceRole,
  tokenId: number,
): InstrumentId {
  const type = traitValue(traits, "Type").toLowerCase()
  const accessory = traitValue(traits, "Accessory").toLowerCase()
  const gender = traitValue(traits, "Gender").toLowerCase()
  const seed = hashString(`${tokenId}:${type}:${accessory}`)

  if (kind === "bass") return "bass-sub"
  if (kind === "pad") {
    if (type === "agent") return "agent-pad"
    if (type === "alien") return "alien-bell"
    return "choir-ah"
  }
  if (kind === "arp") return "arp-pulse"

  // Lead / harmony / counter — Type is the singer
  if (type === "agent") return seed % 2 === 0 ? "agent-pad" : "human-lead"
  if (type === "alien") return accessory.includes("laser") ? "arp-pulse" : "alien-bell"
  if (type === "cat") return "cat-pluck"
  if (type === "human") {
    if (gender.includes("female") || gender.includes("non")) return "choir-ah"
    if (accessory.includes("tie") || accessory.includes("hat")) return "glass-keys"
    return "human-lead"
  }
  return "human-lead"
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
      return "dorian"
  }
}

function noteName(rootIndex: number, degree: number, octave: number): string {
  const idx = (rootIndex + degree + 120) % 12
  return `${ROOTS[idx]}${octave}`
}

function beatSec(bpm: number): number {
  return 60 / bpm
}

type LayerKind = "lead" | "pad" | "bass" | "arp" | "harmony"

function roleOf(kind: LayerKind): VoiceRole {
  if (kind === "pad") return "pad"
  if (kind === "bass") return "bass"
  if (kind === "arp") return "arp"
  if (kind === "harmony") return "harmony"
  return "primary"
}

/**
 * Synthwave phrase: longer notes, legato pads, melodic lead, breathing rests.
 * Grid is 16 steps × 4 bars (eighth notes) for a musical loop.
 */
function buildLayer(
  voice: NormieVoiceInput,
  scale: ScaleName,
  rootIndex: number,
  bpm: number,
  kind: LayerKind,
  rng: () => number,
  gainScale = 1,
): VoicePart {
  const dens = pixelDensity(voice.pixels)
  const energy = rowBands(voice.pixels, 16)
  const contour = contourBands(voice.pixels, 16)
  const type = traitValue(voice.traits, "Type") || "Human"
  const expression = traitValue(voice.traits, "Expression").toLowerCase()
  const age = traitValue(voice.traits, "Age").toLowerCase()
  const eyes = traitValue(voice.traits, "Eyes").toLowerCase()
  const hair = traitValue(voice.traits, "Hair Style")
  const facial = traitValue(voice.traits, "Facial Feature")
  const accessory = traitValue(voice.traits, "Accessory")
  const degrees = SCALES[scale]
  const eighth = beatSec(bpm) / 2
  const steps = 32 // 4 bars of 8ths
  const notes: string[] = []
  const durations: number[] = []

  const instrument = instrumentFromTraits(voice.traits, roleOf(kind), voice.tokenId)
  const motif = hashString(hair + facial + accessory + String(voice.tokenId)) % degrees.length

  // MODULATORS — Expression / Age / Eyes
  let restBias = 0.12
  let legato = 1.1 // hold longer than step for pad/lead glue
  let attack = 0.04
  let decay = 0.2
  let sustain = 0.45
  let release = 0.35
  let reverbSend = 0.25
  let delaySend = 0.18

  if (expression.includes("friendly") || expression.includes("happy")) {
    restBias = 0.06
    legato = 1.25
    attack = 0.06
    sustain = 0.55
    reverbSend = 0.32
  } else if (expression.includes("angry") || expression.includes("mad")) {
    restBias = 0.04
    legato = 0.75
    attack = 0.01
    sustain = 0.2
    release = 0.12
    delaySend = 0.08
  } else if (expression.includes("sad") || expression.includes("sleepy")) {
    restBias = 0.22
    legato = 1.6
    attack = 0.12
    sustain = 0.6
    release = 0.7
    reverbSend = 0.45
  } else if (expression.includes("smug") || expression.includes("cool")) {
    restBias = 0.14
    legato = 1.0
    delaySend = 0.28
  }

  if (age === "old") {
    attack *= 1.4
    release *= 1.3
    bpm // tempo handled outside
  } else if (age === "young") {
    attack *= 0.7
    release *= 0.8
  }

  let filterHz = 1200 + dens * 1600
  if (eyes.includes("shade") || eyes.includes("closed")) {
    filterHz *= 0.5
    reverbSend += 0.08
  }
  if (eyes.includes("laser") || eyes.includes("glow")) {
    filterHz *= 1.4
    delaySend += 0.1
  }
  if (eyes.includes("big")) filterHz *= 1.15

  // Instrument-specific envelope defaults
  if (instrument === "agent-pad" || instrument === "choir-ah") {
    attack = Math.max(attack, 0.18)
    sustain = Math.max(sustain, 0.65)
    release = Math.max(release, 0.8)
    legato = Math.max(legato, 1.8)
    reverbSend = Math.max(reverbSend, 0.4)
  } else if (instrument === "bass-sub") {
    attack = 0.02
    sustain = 0.5
    release = 0.25
    filterHz = Math.min(filterHz, 600)
    reverbSend = 0.08
  } else if (instrument === "cat-pluck" || instrument === "glass-keys") {
    attack = 0.005
    decay = 0.25
    sustain = 0.15
    release = 0.2
    legato = 0.85
  } else if (instrument === "alien-bell") {
    attack = 0.01
    decay = 0.4
    sustain = 0.2
    release = 0.9
    reverbSend = 0.5
  } else if (instrument === "arp-pulse") {
    attack = 0.005
    sustain = 0.1
    release = 0.08
    legato = 0.7
    delaySend = 0.35
  } else if (instrument === "human-lead") {
    attack = Math.max(0.03, attack)
    sustain = 0.4
    release = 0.4
    legato = 1.15
  }

  let baseOctave = 4
  if (kind === "bass") baseOctave = 2
  else if (kind === "pad") baseOctave = 3
  else if (kind === "arp") baseOctave = 5
  else if (kind === "harmony") baseOctave = 5
  if (age === "old" && kind === "lead") baseOctave = 3

  let lastDegree = -99
  let sameCount = 0
  let i = 0
  while (i < steps) {
    const band = i % 16
    const e = energy[band] ?? 0
    const c = contour[band] ?? 0.5

    // Bass: half notes on roots
    if (kind === "bass") {
      if (i % 4 !== 0) {
        notes.push("rest")
        durations.push(eighth)
        i++
        continue
      }
      const bassDeg = degrees[i % 8 < 4 ? 0 : Math.min(4, degrees.length - 1)]
      notes.push(noteName(rootIndex, bassDeg, baseOctave))
      durations.push(eighth * 2 * legato)
      // skip next step in grid time
      notes.push("rest")
      durations.push(eighth * 0.01) // tiny spacer so sum stays ~even
      i += 2
      continue
    }

    // Pad: long held tones (every 4 eighths = half bar)
    if (kind === "pad") {
      if (i % 4 !== 0) {
        notes.push("rest")
        durations.push(eighth)
        i++
        continue
      }
      const deg = degrees[(motif + Math.floor(i / 4) * 2) % degrees.length]
      notes.push(noteName(rootIndex, deg, baseOctave))
      // Hold across 4 steps; remaining steps are rests for grid
      durations.push(eighth * 3.6)
      notes.push("rest")
      durations.push(eighth * 0.4)
      i += 4
      continue
    }

    // Arp: steady 16th-feel on 8th grid with motion
    if (kind === "arp") {
      if (e < 0.08 && rng() < 0.3) {
        notes.push("rest")
        durations.push(eighth)
        i++
        continue
      }
      const deg =
        degrees[(motif + i + Math.floor(c * 3)) % degrees.length]
      notes.push(noteName(rootIndex, deg, baseOctave + (i % 4 === 0 ? 0 : 0)))
      durations.push(eighth * 0.85)
      i++
      continue
    }

    // Lead / harmony: melodic with expression rests
    const thr = 0.05 + dens * 0.08
    if (e < thr && rng() < restBias + (1 - e) * 0.2) {
      notes.push("rest")
      durations.push(eighth)
      i++
      continue
    }

    let degreeIdx = Math.floor(
      (c * (degrees.length - 1) + e * 3 + motif + i * 0.35) % degrees.length,
    )
    degreeIdx = ((degreeIdx % degrees.length) + degrees.length) % degrees.length
    if (degreeIdx === lastDegree) {
      sameCount++
      if (sameCount >= 2) {
        degreeIdx = (degreeIdx + 1 + Math.floor(rng() * 3)) % degrees.length
        sameCount = 0
      }
    } else sameCount = 0
    lastDegree = degreeIdx

    let octave = baseOctave
    if (e > 0.4) octave += 1
    if (c < 0.2) octave = Math.max(3, octave - 1)
    if (kind === "harmony") {
      // third above
      degreeIdx = (degreeIdx + 2) % degrees.length
    }

    // Longer notes on strong beats
    const hold = i % 4 === 0 ? 2 : i % 2 === 0 ? 1.5 : 1
    notes.push(noteName(rootIndex, degrees[degreeIdx], octave))
    durations.push(eighth * hold * legato * (expression.includes("angry") ? 0.7 : 1))
    i++
  }

  // Normalize total duration to ~4 bars of 8ths
  const targetLen = eighth * steps
  let total = durations.reduce((a, b) => a + b, 0)
  if (total > 0 && Math.abs(total - targetLen) / targetLen > 0.15) {
    const scale = targetLen / total
    for (let j = 0; j < durations.length; j++) durations[j] *= scale
  }

  // Ensure enough hits
  if (notes.filter((n) => n !== "rest").length < 4) {
    for (let s = 0; s < steps; s += 4) {
      notes[s] = noteName(rootIndex, degrees[(motif + s) % degrees.length], baseOctave)
      durations[s] = eighth * 2
    }
  }

  const gainBase =
    kind === "lead"
      ? 0.28
      : kind === "pad"
        ? 0.16
        : kind === "bass"
          ? 0.24
          : kind === "arp"
            ? 0.12
            : 0.14

  const pan =
    kind === "harmony" ? 0.35 : kind === "arp" ? -0.25 : kind === "pad" ? -0.1 : 0

  return {
    role: roleOf(kind),
    instrument,
    notes,
    durations,
    filterHz: Math.round(Math.min(5200, Math.max(120, filterHz))),
    gain: Math.max(0.04, gainBase * gainScale),
    attack,
    decay,
    sustain,
    release,
    pan,
    reverbSend: Math.min(0.7, reverbSend),
    delaySend: Math.min(0.5, delaySend),
    tokenId: voice.tokenId,
  }
}

function pickHiveVoices(voices: NormieVoiceInput[]): NormieVoiceInput[] {
  if (voices.length <= MAX_AUDIO_PARTS) return voices
  // Prefer type diversity when truncating the hive
  const byType = new Map<string, NormieVoiceInput[]>()
  for (const v of voices) {
    const t = traitValue(v.traits, "Type") || "Unknown"
    const list = byType.get(t) ?? []
    list.push(v)
    byType.set(t, list)
  }
  const picked: NormieVoiceInput[] = []
  const types = Array.from(byType.keys())
  let i = 0
  while (picked.length < MAX_AUDIO_PARTS && picked.length < voices.length) {
    const t = types[i % types.length]
    const bucket = byType.get(t)!
    if (bucket.length) picked.push(bucket.shift()!)
    i++
    if (types.every((ty) => (byType.get(ty)?.length ?? 0) === 0)) break
  }
  // Always keep primary first
  const primary = voices[0]
  if (!picked.find((p) => p.tokenId === primary.tokenId)) {
    picked[0] = primary
  } else {
    const idx = picked.findIndex((p) => p.tokenId === primary.tokenId)
    if (idx > 0) {
      const [p] = picked.splice(idx, 1)
      picked.unshift(p)
    }
  }
  return picked
}

/**
 * Synthwave / agent-hymn score from live pixels + traits.
 * Solo: lead + pad + bass (complete).
 * Multi / ALL: primary full stack + each extra Normie as a layer (capped).
 */
export function buildFallbackScore(voices: NormieVoiceInput[]): VoiceScore {
  if (voices.length === 0) {
    return {
      bpm: 96,
      root: "A",
      scale: "dorian",
      parts: [],
      synopsis: "No Normies selected — silence in the hive.",
      source: "fallback",
      swing: 0.05,
    }
  }

  const hive = pickHiveVoices(voices)
  const seedMaterial = hive
    .map(
      (v) =>
        `${v.tokenId}:${v.pixels.slice(0, 200)}:${v.traits.map((t) => `${t.trait_type}=${t.value}`).join(",")}`,
    )
    .join("|")
  const seed = hashString(seedMaterial)

  const primary = hive[0]
  const dens = pixelDensity(primary.pixels)
  const type = traitValue(primary.traits, "Type") || "Human"
  const age = traitValue(primary.traits, "Age")
  const expression = traitValue(primary.traits, "Expression") || "Unknown"
  const eyes = traitValue(primary.traits, "Eyes")

  let bpm = Math.round(82 + dens * 40) // slower, more synthwave
  if (age.toLowerCase() === "old") bpm = Math.round(bpm * 0.9)
  if (age.toLowerCase() === "young") bpm = Math.round(bpm * 1.08)
  bpm = Math.min(118, Math.max(72, bpm))

  const scale = scaleFromType(type)
  const rootIndex = seed % 12
  const root = ROOTS[rootIndex]
  const n = hive.length
  const gainScale = n <= 3 ? 1 : 1 / Math.sqrt(n * 0.55)

  const parts: VoicePart[] = []

  // Primary: full synthwave stack
  parts.push(
    buildLayer(primary, scale, rootIndex, bpm, "lead", mulberry32(seed ^ 0x11), gainScale),
  )
  parts.push(
    buildLayer(primary, scale, rootIndex, bpm, "pad", mulberry32(seed ^ 0x22), gainScale * 0.9),
  )
  parts.push(
    buildLayer(primary, scale, rootIndex, bpm, "bass", mulberry32(seed ^ 0x33), gainScale),
  )

  // Remaining hive members — one expressive layer each
  for (let i = 1; i < hive.length; i++) {
    const v = hive[i]
    const t = traitValue(v.traits, "Type").toLowerCase()
    let kind: LayerKind = "harmony"
    if (t === "agent") kind = "pad"
    else if (t === "alien") kind = "arp"
    else if (t === "cat") kind = "arp"
    else if (i % 3 === 0) kind = "harmony"
    else if (i % 3 === 1) kind = "pad"
    else kind = "lead"

    // Avoid too many leads drowning the mix
    if (kind === "lead" && i > 2) kind = "harmony"

    parts.push(
      buildLayer(
        v,
        scale,
        rootIndex,
        bpm,
        kind,
        mulberry32(seed ^ ((i + 1) * 0x9e3779b9)),
        gainScale * 0.85,
      ),
    )
  }

  // Soft audio part cap (primary stack already 3)
  const capped = parts.slice(0, MAX_AUDIO_PARTS)

  const densPct = Math.round(dens * 100)
  const extra =
    voices.length > hive.length
      ? ` Hive of ${voices.length} reduced to ${hive.length} voices for mix clarity.`
      : voices.length > 1
        ? ` Hive ensemble: ${voices.length} Normies.`
        : " Solo: lead + pad + bass from one Normie."

  const synopsis = `Normie #${primary.tokenId} (${type}) sings ${bpm} BPM ${root} ${scale} synthwave. Pixels→melody (${densPct}% density). Expression ${expression} shapes phrasing; ${eyes || "eyes"} color the filter. Type/Accessory choose instruments; Age/Hair/Facial color the feel.${extra}`

  return {
    bpm,
    root,
    scale,
    parts: capped,
    synopsis,
    source: "fallback",
    swing: 0.04,
  }
}
