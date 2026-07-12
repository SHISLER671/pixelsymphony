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
 * Balanced forest song layer.
 * "song" mode = complete melodic phrases (solo wow).
 * "network" mode = answering phrases with space (multi), still musical.
 */
function buildLayer(
  voice: NormieVoiceInput,
  scale: ScaleName,
  rootIndex: number,
  bpm: number,
  kind: LayerKind,
  rng: () => number,
  gainScale = 1,
  startOffset = 0,
  density: "song" | "network" = "song",
): VoicePart {
  const dens = pixelDensity(voice.pixels)
  const energy = rowBands(voice.pixels, 16)
  const contour = contourBands(voice.pixels, 16)
  const expression = traitValue(voice.traits, "Expression").toLowerCase()
  const age = traitValue(voice.traits, "Age").toLowerCase()
  const eyes = traitValue(voice.traits, "Eyes").toLowerCase()
  const hair = traitValue(voice.traits, "Hair Style")
  const facial = traitValue(voice.traits, "Facial Feature")
  const accessory = traitValue(voice.traits, "Accessory")
  const degrees = SCALES[scale]
  // 8th-note grid — enough motion for a song, still room to breathe
  const step = beatSec(bpm) / 2
  // 8 bars of 8ths ≈ 16–22s at 70–90 BPM (loops with wow, not endless void)
  const steps = 64
  const notes: string[] = []
  const durations: number[] = []

  const instrument = instrumentFromTraits(voice.traits, roleOf(kind), voice.tokenId)
  const motif = hashString(hair + facial + accessory + String(voice.tokenId)) % degrees.length

  let attack = 0.04
  let decay = 0.22
  let sustain = 0.35
  let release = 0.55
  let reverbSend = 0.32
  let delaySend = 0.18
  let filterHz = 900 + dens * 1400

  if (expression.includes("angry") || expression.includes("mad")) {
    attack = 0.015
    release = 0.28
    sustain = 0.2
  } else if (expression.includes("sad") || expression.includes("sleepy")) {
    attack = 0.1
    release = 0.9
    reverbSend = 0.42
  } else if (expression.includes("friendly")) {
    attack = 0.05
    release = 0.65
    sustain = 0.4
  }

  if (age === "old") {
    attack *= 1.3
    release *= 1.2
  } else if (age === "young") {
    attack *= 0.8
  }

  if (eyes.includes("shade") || eyes.includes("closed")) filterHz *= 0.55
  if (eyes.includes("laser") || eyes.includes("glow")) filterHz *= 1.3

  if (instrument === "agent-pad" || instrument === "choir-ah") {
    attack = Math.max(0.12, attack)
    sustain = 0.55
    release = Math.max(0.9, release)
    reverbSend = 0.42
  } else if (instrument === "bass-sub") {
    attack = 0.02
    sustain = 0.45
    release = 0.4
    filterHz = Math.min(filterHz, 480)
    reverbSend = 0.12
  } else if (instrument === "alien-bell" || instrument === "cat-pluck") {
    attack = 0.008
    decay = 0.28
    sustain = 0.12
    release = 0.7
  } else if (instrument === "human-lead") {
    attack = 0.03
    sustain = 0.35
    release = 0.5
  } else if (instrument === "arp-pulse") {
    attack = 0.008
    sustain = 0.12
    release = 0.2
    delaySend = 0.28
  }

  let baseOctave = 4
  if (kind === "bass") baseOctave = 2
  else if (kind === "pad") baseOctave = 3
  else if (kind === "arp") baseOctave = 5
  else if (kind === "harmony") baseOctave = 5
  if (age === "old" && kind === "lead") baseOctave = 3

  // Density knobs
  const song = density === "song"
  // phrase lengths in steps (melodic runs, not single beeps)
  const phraseLen = song
    ? kind === "lead"
      ? 5 + Math.floor(rng() * 4)
      : kind === "harmony"
        ? 4 + Math.floor(rng() * 3)
        : kind === "arp"
          ? 6 + Math.floor(rng() * 4)
          : 3
    : kind === "lead"
      ? 3 + Math.floor(rng() * 3)
      : 2 + Math.floor(rng() * 2)

  const gapMin = song
    ? kind === "pad"
      ? 2
      : kind === "bass"
        ? 1
        : 2
    : kind === "pad"
      ? 4
      : kind === "bass"
        ? 3
        : 3

  let i = 0
  let lastDegree = motif % degrees.length

  while (i < steps) {
    const band = i % 16
    const e = energy[band] ?? 0
    const c = contour[band] ?? 0.5

    // --- Pad: continuous bed with motion (solo must never feel empty) ---
    if (kind === "pad") {
      // Hold chord tones every 4 steps, small gaps only in network mode
      if (!song && i % 8 !== 0 && rng() > 0.35) {
        notes.push("rest")
        durations.push(step)
        i++
        continue
      }
      if (song || i % 4 === 0) {
        const deg = degrees[(motif + Math.floor(i / 4) + Math.floor(c * 2)) % degrees.length]
        notes.push(noteName(rootIndex, deg, baseOctave))
        durations.push(step * (song ? 3.2 : 2.4))
        // pad grid: skip consumed steps as rests
        const skip = song ? 3 : 2
        for (let k = 1; k < skip && i + k < steps; k++) {
          notes.push("rest")
          durations.push(step * 0.15)
        }
        i += skip
        continue
      }
      notes.push("rest")
      durations.push(step)
      i++
      continue
    }

    // --- Bass: walking pulse (song) or soft roots (network) ---
    if (kind === "bass") {
      const every = song ? 4 : 6
      if (i % every !== 0) {
        notes.push("rest")
        durations.push(step)
        i++
        continue
      }
      const bassDeg =
        degrees[
          i % 16 < 8
            ? 0
            : Math.min(4, degrees.length - 1)
        ]
      // occasional fifth walk in song mode
      const useFifth = song && i % 8 === 4
      notes.push(
        noteName(
          rootIndex,
          useFifth ? degrees[Math.min(4, degrees.length - 1)] : bassDeg,
          baseOctave,
        ),
      )
      durations.push(step * (song ? 3.5 : 2.8))
      i++
      continue
    }

    // --- Lead / harmony / arp: PHRASES not single tones ---
    // Rest gap between phrases
    const wantGap =
      i > 0 &&
      (i % (phraseLen + gapMin) < gapMin ||
        (!song && e < 0.12 && rng() < 0.35))

    if (wantGap && rng() < (song ? 0.55 : 0.75)) {
      notes.push("rest")
      durations.push(step)
      i++
      continue
    }

    // Emit a short melodic phrase (2–8 notes)
    const len = Math.min(phraseLen, steps - i)
    for (let p = 0; p < len && i < steps; p++, i++) {
      const b = i % 16
      const ee = energy[b] ?? e
      const cc = contour[b] ?? c

      // Micro-rest inside phrase for groove (not empty silence)
      if (song && p > 0 && p < len - 1 && ee < 0.1 && rng() < 0.15) {
        notes.push("rest")
        durations.push(step * 0.5)
        continue
      }

      // Melodic motion from contour + motif (always moves)
      let degreeIdx =
        (lastDegree +
          (rng() < 0.55 ? 1 : rng() < 0.5 ? -1 : 2) +
          Math.floor(cc * 2) +
          (kind === "harmony" ? 2 : 0)) %
        degrees.length
      if (degreeIdx < 0) degreeIdx += degrees.length
      // Force change if stuck
      if (degreeIdx === lastDegree) {
        degreeIdx = (degreeIdx + 1 + Math.floor(rng() * 2)) % degrees.length
      }
      lastDegree = degreeIdx

      let octave = baseOctave
      if (ee > 0.4) octave += 1
      if (cc < 0.22) octave = Math.max(3, octave - 1)
      if (kind === "arp" && p % 2 === 1) octave = Math.min(6, octave + 1)

      const hold =
        kind === "arp"
          ? 0.85 + rng() * 0.35
          : p === 0 || p === len - 1
            ? 1.4 + rng() * 0.6
            : 0.9 + rng() * 0.5

      notes.push(noteName(rootIndex, degrees[degreeIdx], octave))
      durations.push(step * hold)
    }

    // Breath after phrase
    const breath = song ? gapMin : gapMin + 1
    for (let g = 0; g < breath && i < steps; g++, i++) {
      notes.push("rest")
      durations.push(step)
    }
  }

  // Normalize length to cycle
  const targetLen = step * steps
  let total = durations.reduce((a, b) => a + b, 0)
  if (total > 0 && Math.abs(total - targetLen) / targetLen > 0.12) {
    const sc = targetLen / total
    for (let j = 0; j < durations.length; j++) durations[j] *= sc
  }

  // Solo safety: enough musical hits
  const minHits = kind === "lead" ? (song ? 18 : 10) : kind === "bass" ? 8 : 6
  if (notes.filter((n) => n !== "rest").length < minHits) {
    for (let s = 0; s < steps; s += song ? 3 : 5) {
      if (s >= notes.length) break
      notes[s] = noteName(
        rootIndex,
        degrees[(motif + s) % degrees.length],
        baseOctave,
      )
      durations[s] = step * 1.2
    }
  }

  const gainBase =
    kind === "lead"
      ? 0.3
      : kind === "pad"
        ? song
          ? 0.14
          : 0.1
        : kind === "bass"
          ? 0.22
          : kind === "arp"
            ? 0.14
            : 0.16

  const pan =
    kind === "harmony"
      ? 0.35
      : kind === "arp"
        ? -0.3
        : kind === "pad"
          ? -0.05
          : (hashString(String(voice.tokenId)) % 100) / 100 - 0.5

  return {
    role: roleOf(kind),
    instrument,
    notes,
    durations,
    filterHz: Math.round(Math.min(4500, Math.max(120, filterHz))),
    gain: Math.max(0.04, gainBase * gainScale),
    attack,
    decay,
    sustain,
    release,
    pan: Math.max(-0.7, Math.min(0.7, pan)),
    reverbSend: Math.min(0.65, reverbSend),
    delaySend: Math.min(0.4, delaySend),
    tokenId: voice.tokenId,
    startOffset,
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
 * Forest song score from live pixels + traits.
 * Solo: full arrangement (pad + bass + lead + harmony) — one NFT is a song.
 * Multi: primary still sings; others weave answering phrases with light stagger.
 */
export function buildFallbackScore(voices: NormieVoiceInput[]): VoiceScore {
  if (voices.length === 0) {
    return {
      bpm: 88,
      root: "A",
      scale: "dorian",
      parts: [],
      synopsis: "No Normies selected — silence in the forest.",
      source: "fallback",
      swing: 0.04,
      loopSeconds: 20,
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

  // Engaging mid-tempo forest groove
  let bpm = Math.round(78 + dens * 36)
  if (age.toLowerCase() === "old") bpm = Math.round(bpm * 0.92)
  if (age.toLowerCase() === "young") bpm = Math.round(bpm * 1.08)
  bpm = Math.min(108, Math.max(72, bpm))

  const scale = scaleFromType(type)
  const rootIndex = seed % 12
  const root = ROOTS[rootIndex]
  const n = hive.length
  const solo = n === 1
  const density = solo ? "song" : "network"
  const gainScale = n <= 2 ? 1 : 1 / Math.sqrt(n * 0.5)
  // 64 eighths
  const loopSeconds = (60 / bpm / 2) * 64

  const parts: VoicePart[] = []

  // Primary always gets a full mini-band (pad + bass + lead)
  parts.push(
    buildLayer(
      primary,
      scale,
      rootIndex,
      bpm,
      "pad",
      mulberry32(seed ^ 0x22),
      gainScale * (solo ? 0.95 : 0.7),
      0,
      density,
    ),
  )
  parts.push(
    buildLayer(
      primary,
      scale,
      rootIndex,
      bpm,
      "bass",
      mulberry32(seed ^ 0x33),
      gainScale,
      0,
      density,
    ),
  )
  parts.push(
    buildLayer(
      primary,
      scale,
      rootIndex,
      bpm,
      "lead",
      mulberry32(seed ^ 0x11),
      gainScale,
      0,
      density,
    ),
  )

  // Solo wow: harmony + light arp from the same Normie (still one NFT, full song)
  if (solo) {
    parts.push(
      buildLayer(
        primary,
        scale,
        rootIndex,
        bpm,
        "harmony",
        mulberry32(seed ^ 0x44),
        gainScale * 0.75,
        loopSeconds * 0.04,
        "song",
      ),
    )
    parts.push(
      buildLayer(
        primary,
        scale,
        rootIndex,
        bpm,
        "arp",
        mulberry32(seed ^ 0x55),
        gainScale * 0.55,
        loopSeconds * 0.08,
        "song",
      ),
    )
  }

  // Extra Normies: answering phrases, modest stagger (not waiting forever)
  if (!solo) {
    for (let i = 1; i < hive.length; i++) {
      const v = hive[i]
      const t = traitValue(v.traits, "Type").toLowerCase()
      let kind: LayerKind = "harmony"
      if (t === "agent") kind = "pad"
      else if (t === "alien" || t === "cat") kind = "arp"
      else if (i % 3 === 0) kind = "lead"
      else kind = "harmony"

      const stagger =
        (i / Math.max(n, 2)) * loopSeconds * 0.22 +
        ((hashString(String(v.tokenId)) % 500) / 500) * (loopSeconds * 0.04)

      parts.push(
        buildLayer(
          v,
          scale,
          rootIndex,
          bpm,
          kind,
          mulberry32(seed ^ ((i + 1) * 0x9e3779b9)),
          gainScale * 0.78,
          stagger,
          "network",
        ),
      )
    }
  }

  const capped = parts.slice(0, MAX_AUDIO_PARTS)

  const synopsis =
    voices.length <= 1
      ? `${primary.name || `Normie #${primary.tokenId}`} singing in ${root} ${scale} at ${bpm} BPM.`
      : `${voices.length} Normies singing together in ${root} ${scale} at ${bpm} BPM.`

  return {
    bpm,
    root,
    scale,
    parts: capped,
    synopsis,
    source: "fallback",
    swing: 0.05,
    loopSeconds,
  }
}
