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
 * Mycelium / forest network phrase.
 * Long cycle (16 bars of quarters), mostly silence, occasional "pings"
 * that answer each other across the loop — not a dense hive buzz.
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
  // Quarter-note grid — slower, room to breathe
  const quarter = beatSec(bpm)
  // 16 bars = long forest cycle (~32–48s at 60–80 BPM)
  const steps = 64
  const notes: string[] = []
  const durations: number[] = []

  const instrument = instrumentFromTraits(voice.traits, roleOf(kind), voice.tokenId)
  const motif = hashString(hair + facial + accessory + String(voice.tokenId)) % degrees.length

  // Soft, wet, patient envelopes (mycelium ping, not staccato bee)
  let attack = 0.08
  let decay = 0.35
  let sustain = 0.25
  let release = 1.4
  let reverbSend = 0.45
  let delaySend = 0.22
  let filterHz = 700 + dens * 1200

  if (expression.includes("angry") || expression.includes("mad")) {
    attack = 0.02
    release = 0.7
  } else if (expression.includes("sad") || expression.includes("sleepy")) {
    attack = 0.2
    release = 2.2
    reverbSend = 0.55
  } else if (expression.includes("friendly")) {
    release = 1.6
    reverbSend = 0.48
  }

  if (age === "old") {
    attack *= 1.5
    release *= 1.3
  } else if (age === "young") {
    attack *= 0.75
  }

  if (eyes.includes("shade") || eyes.includes("closed")) filterHz *= 0.55
  if (eyes.includes("laser") || eyes.includes("glow")) filterHz *= 1.3

  if (instrument === "agent-pad" || instrument === "choir-ah") {
    attack = Math.max(0.25, attack)
    sustain = 0.55
    release = Math.max(2.0, release)
    reverbSend = 0.55
  } else if (instrument === "bass-sub") {
    attack = 0.04
    sustain = 0.4
    release = 0.9
    filterHz = Math.min(filterHz, 420)
    reverbSend = 0.15
  } else if (instrument === "alien-bell" || instrument === "cat-pluck") {
    attack = 0.01
    decay = 0.5
    sustain = 0.08
    release = 1.8
    reverbSend = 0.55
  } else if (instrument === "human-lead") {
    attack = 0.06
    sustain = 0.3
    release = 1.2
  }

  let baseOctave = 4
  if (kind === "bass") baseOctave = 2
  else if (kind === "pad") baseOctave = 3
  else if (kind === "arp") baseOctave = 5
  else if (kind === "harmony") baseOctave = 5
  if (age === "old" && kind === "lead") baseOctave = 3

  // How often this voice "pings" the network (sparse)
  let pingChance =
    kind === "pad"
      ? 0.06
      : kind === "bass"
        ? 0.1
        : kind === "arp"
          ? 0.14
          : kind === "harmony"
            ? 0.11
            : 0.13
  // Denser pixels → slightly more signals, never a buzz
  pingChance = Math.min(0.22, pingChance + dens * 0.08)

  // Minimum gap between pings (steps) — mycelium spacing
  const minGap =
    kind === "pad" ? 10 : kind === "bass" ? 7 : kind === "arp" ? 4 : 5
  let sincePing = minGap // allow early first ping after offset phase

  for (let i = 0; i < steps; i++) {
    const band = i % 16
    const e = energy[band] ?? 0
    const c = contour[band] ?? 0.5
    sincePing++

    // Soft bed: pad only holds rare long tones
    if (kind === "pad") {
      const fire = sincePing >= minGap && (e > 0.25 || rng() < pingChance)
      if (!fire) {
        notes.push("rest")
        durations.push(quarter)
        continue
      }
      sincePing = 0
      const deg = degrees[(motif + Math.floor(i / 8)) % degrees.length]
      notes.push(noteName(rootIndex, deg, baseOctave))
      durations.push(quarter * 3.5)
      // consume next 2 steps as micro-rests for grid alignment
      if (i + 1 < steps) {
        notes.push("rest")
        durations.push(quarter * 0.5)
        i++
      }
      continue
    }

    // Bass: slow root pulses, not a pump
    if (kind === "bass") {
      const fire = sincePing >= minGap && i % 8 === 0 && rng() < 0.7
      if (!fire) {
        notes.push("rest")
        durations.push(quarter)
        continue
      }
      sincePing = 0
      const bassDeg = degrees[i % 16 < 8 ? 0 : Math.min(4, degrees.length - 1)]
      notes.push(noteName(rootIndex, bassDeg, baseOctave))
      durations.push(quarter * 2.2)
      continue
    }

    // Lead / harmony / arp: sparse answering pings
    const energyBoost = e * 0.35
    const fire =
      sincePing >= minGap &&
      (rng() < pingChance + energyBoost ||
        // guarantee a few landmarks from pixel peaks
        (e > 0.45 && sincePing >= minGap - 1 && rng() < 0.4))

    if (!fire) {
      notes.push("rest")
      durations.push(quarter)
      continue
    }

    sincePing = 0
    let degreeIdx = Math.floor(
      (c * (degrees.length - 1) + motif + i * 0.2) % degrees.length,
    )
    degreeIdx = ((degreeIdx % degrees.length) + degrees.length) % degrees.length
    if (kind === "harmony") degreeIdx = (degreeIdx + 2) % degrees.length

    let octave = baseOctave
    if (e > 0.4) octave += 1
    if (c < 0.25) octave = Math.max(3, octave - 1)

    // Single sustained "ping" into the reverb network
    const hold =
      kind === "arp" ? 1.2 + rng() * 0.8 : 1.6 + rng() * 1.4
    notes.push(noteName(rootIndex, degrees[degreeIdx], octave))
    durations.push(quarter * hold)
  }

  // Normalize to full cycle length
  const targetLen = quarter * steps
  let total = durations.reduce((a, b) => a + b, 0)
  if (total > 0 && Math.abs(total - targetLen) / targetLen > 0.12) {
    const sc = targetLen / total
    for (let j = 0; j < durations.length; j++) durations[j] *= sc
  }

  // At least a few pings so solo isn't silence
  if (notes.filter((n) => n !== "rest").length < 3) {
    for (let s = 4; s < steps; s += 16) {
      notes[s] = noteName(
        rootIndex,
        degrees[(motif + s) % degrees.length],
        baseOctave,
      )
      durations[s] = quarter * 2
    }
  }

  const gainBase =
    kind === "lead"
      ? 0.26
      : kind === "pad"
        ? 0.1
        : kind === "bass"
          ? 0.18
          : kind === "arp"
            ? 0.12
            : 0.14

  const pan =
    kind === "harmony"
      ? 0.4
      : kind === "arp"
        ? -0.35
        : kind === "pad"
          ? -0.08
          : (hashString(String(voice.tokenId)) % 100) / 100 - 0.5

  return {
    role: roleOf(kind),
    instrument,
    notes,
    durations,
    filterHz: Math.round(Math.min(4200, Math.max(100, filterHz))),
    gain: Math.max(0.03, gainBase * gainScale),
    attack,
    decay,
    sustain,
    release,
    pan: Math.max(-0.7, Math.min(0.7, pan)),
    reverbSend: Math.min(0.75, reverbSend),
    delaySend: Math.min(0.45, delaySend),
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
 * Mycelium forest score from live pixels + traits.
 * Long cycle; voices enter staggered and ping sparsely into a shared reverb bed.
 * Solo: soft soil (pad+bass) + primary lead pings.
 * Multi: each Normie is a node in the network — not all buzzing at once.
 */
export function buildFallbackScore(voices: NormieVoiceInput[]): VoiceScore {
  if (voices.length === 0) {
    return {
      bpm: 72,
      root: "A",
      scale: "dorian",
      parts: [],
      synopsis: "No Normies selected — silence in the forest.",
      source: "fallback",
      swing: 0.02,
      loopSeconds: 32,
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

  // Forest tempo — slow enough for long decay tails to cross
  let bpm = Math.round(58 + dens * 28)
  if (age.toLowerCase() === "old") bpm = Math.round(bpm * 0.92)
  if (age.toLowerCase() === "young") bpm = Math.round(bpm * 1.06)
  bpm = Math.min(88, Math.max(52, bpm))

  const scale = scaleFromType(type)
  const rootIndex = seed % 12
  const root = ROOTS[rootIndex]
  const n = hive.length
  const gainScale = n <= 2 ? 1 : 1 / Math.sqrt(n * 0.45)
  // 64 quarter-notes at bpm
  const loopSeconds = (60 / bpm) * 64

  const parts: VoicePart[] = []

  // Soil bed from primary only — quiet continuous mycelium undergrowth
  parts.push(
    buildLayer(
      primary,
      scale,
      rootIndex,
      bpm,
      "pad",
      mulberry32(seed ^ 0x22),
      gainScale * 0.75,
      0,
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
      gainScale * 0.85,
      loopSeconds * 0.08,
    ),
  )

  // Each Normie = one network node with staggered entry (mycelium, not hive)
  for (let i = 0; i < hive.length; i++) {
    const v = hive[i]
    const t = traitValue(v.traits, "Type").toLowerCase()
    let kind: LayerKind = "lead"
    if (i === 0) kind = "lead"
    else if (t === "agent") kind = "pad"
    else if (t === "alien" || t === "cat") kind = "arp"
    else if (i % 2 === 1) kind = "harmony"
    else kind = "lead"

    // Spread nodes across the full cycle so they answer, not pile on
    const stagger =
      n <= 1
        ? 0
        : (i / n) * loopSeconds * 0.85 +
          ((hashString(String(v.tokenId)) % 1000) / 1000) * (loopSeconds * 0.06)

    parts.push(
      buildLayer(
        v,
        scale,
        rootIndex,
        bpm,
        kind,
        mulberry32(seed ^ ((i + 1) * 0x9e3779b9)),
        gainScale * (i === 0 ? 1 : 0.8),
        stagger,
      ),
    )
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
    swing: 0.02,
    loopSeconds,
  }
}
