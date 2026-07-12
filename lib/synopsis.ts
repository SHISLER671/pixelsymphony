import type {
  InstrumentId,
  NormieTrait,
  NormieVoiceInput,
  VoicePart,
  VoiceScore,
} from "@/lib/types"

export interface SynopsisStory {
  headline: string
  /** Short vibe line */
  vibe: string
  /** Flowing paragraphs */
  paragraphs: string[]
  /** Who is singing / instrument map */
  cast: { name: string; instrument: string; role: string }[]
  /** Trait → audible effect, plain English */
  influences: { trait: string; value: string; effect: string }[]
  meta: { bpm: number; key: string; scale: string; source: string }
}

const INSTRUMENT_LABELS: Record<InstrumentId, string> = {
  "agent-pad": "warm agent pad",
  "human-lead": "synthwave lead",
  "cat-pluck": "soft pluck",
  "alien-bell": "alien bell",
  "choir-ah": "choir pad",
  "bass-sub": "sub bass",
  "arp-pulse": "pulse arpeggio",
  "glass-keys": "glass keys",
  "noise-breath": "breath texture",
}

const ROLE_LABELS: Record<string, string> = {
  primary: "Lead voice",
  pad: "Atmosphere",
  bass: "Low end",
  harmony: "Harmony",
  counter: "Counterline",
  arp: "Arpeggio",
}

function traitValue(traits: NormieTrait[], type: string): string {
  const found = traits.find(
    (t) => t.trait_type.toLowerCase() === type.toLowerCase(),
  )
  return found ? String(found.value) : ""
}

function instrumentLabel(id: string | undefined): string {
  if (!id) return "synth voice"
  return INSTRUMENT_LABELS[id as InstrumentId] ?? id.replace(/-/g, " ")
}

function expressionEffect(expr: string): string {
  const e = expr.toLowerCase()
  if (e.includes("friendly") || e.includes("happy"))
    return "smoother phrasing and a more open, legato feel"
  if (e.includes("angry") || e.includes("mad"))
    return "tighter attacks and punchier, shorter notes"
  if (e.includes("sad") || e.includes("sleepy"))
    return "more space between phrases and a deeper reverb wash"
  if (e.includes("smug") || e.includes("cool"))
    return "laid-back timing with a touch more delay"
  if (!expr) return "default phrasing from the pixel rhythm"
  return `a ${expr.toLowerCase()} character in how phrases breathe`
}

function eyesEffect(eyes: string): string {
  const e = eyes.toLowerCase()
  if (e.includes("shade") || e.includes("closed"))
    return "darker, muffled filter (less brightness)"
  if (e.includes("laser") || e.includes("glow"))
    return "brighter, more cutting tone"
  if (e.includes("big")) return "a wider, more open filter"
  if (!eyes) return "neutral brightness from pixel density"
  return `${eyes} tinting the filter color`
}

function ageEffect(age: string): string {
  const a = age.toLowerCase()
  if (a === "old") return "slightly slower tempo and softer attacks"
  if (a === "young") return "a bit more urgency in tempo and attack"
  return "standard pace for this arrangement"
}

function typeInstrumentHint(type: string): string {
  switch (type.toLowerCase()) {
    case "agent":
      return "AI-hymn pads and leads"
    case "cat":
      return "plucky, playful lines"
    case "alien":
      return "bells and strange arps"
    case "human":
      return "classic synthwave lead and choir colors"
    default:
      return "the hive’s default voice family"
  }
}

function densityPhrase(pixels: string): string {
  let on = 0
  for (let i = 0; i < pixels.length; i++) if (pixels[i] === "1") on++
  const pct = Math.round((on / Math.max(pixels.length, 1)) * 100)
  if (pct >= 45) return `busy pixel density (${pct}%) pushes a fuller, busier groove`
  if (pct <= 20) return `sparse pixels (${pct}%) leave more air in the rhythm`
  return `balanced pixel density (${pct}%) sets a mid-tempo pulse`
}

/**
 * Build a human-readable story for the synopsis panel from score + voices.
 */
export function buildSynopsisStory(
  score: VoiceScore,
  voices: NormieVoiceInput[],
): SynopsisStory {
  const primary = voices[0]
  const name = primary?.name || (primary ? `Normie #${primary.tokenId}` : "The hive")
  const type = primary ? traitValue(primary.traits, "Type") || "Normie" : "Hive"
  const expression = primary ? traitValue(primary.traits, "Expression") : ""
  const eyes = primary ? traitValue(primary.traits, "Eyes") : ""
  const age = primary ? traitValue(primary.traits, "Age") : ""

  const keyLine = `${score.root} ${score.scale}`
  const headline =
    voices.length <= 1
      ? `${name} is singing in ${keyLine} at ${score.bpm} BPM`
      : `${voices.length} Normies are singing in ${keyLine} at ${score.bpm} BPM`

  const vibeParts: string[] = []
  if (type) vibeParts.push(`${type} energy`)
  if (expression) vibeParts.push(`${expression.toLowerCase()} mood`)
  vibeParts.push(
    score.source === "venice" ? "shaped with Venice" : "woven from on-chain pixels",
  )
  const vibe = vibeParts.join(" · ")

  // Cast from parts (unique by instrument+role+token)
  const cast: SynopsisStory["cast"] = []
  const seen = new Set<string>()
  for (const p of score.parts) {
    const label = instrumentLabel(p.instrument)
    const role = ROLE_LABELS[p.role] || p.role
    const who =
      p.tokenId != null
        ? `Normie #${p.tokenId}`
        : primary
          ? `Normie #${primary.tokenId}`
          : "Voice"
    const key = `${who}|${p.instrument}|${p.role}`
    if (seen.has(key)) continue
    seen.add(key)
    cast.push({ name: who, instrument: label, role })
  }

  const influences: SynopsisStory["influences"] = []
  if (primary) {
    if (type)
      influences.push({
        trait: "Type",
        value: type,
        effect: typeInstrumentHint(type),
      })
    if (expression)
      influences.push({
        trait: "Expression",
        value: expression,
        effect: expressionEffect(expression),
      })
    if (age)
      influences.push({
        trait: "Age",
        value: age,
        effect: ageEffect(age),
      })
    if (eyes)
      influences.push({
        trait: "Eyes",
        value: eyes,
        effect: eyesEffect(eyes),
      })
    influences.push({
      trait: "Pixels",
      value: "40×40 on-chain",
      effect: densityPhrase(primary.pixels),
    })
  }

  // Natural paragraphs
  const paragraphs: string[] = []

  if (voices.length <= 1 && primary) {
    paragraphs.push(
      `${name} (${type}) carries this loop in ${keyLine}. The lead line follows the shape of its on-chain pixels, while a pad and bass keep the synthwave bed steady so a single Normie still feels like a full song.`,
    )
  } else {
    const ids = voices
      .slice(0, 6)
      .map((v) => `#${v.tokenId}`)
      .join(", ")
    const more =
      voices.length > 6 ? ` and ${voices.length - 6} more` : ""
    paragraphs.push(
      `This mix is the hive in chorus: ${ids}${more}. The first Normie sets the key and tempo; the others stack as harmony, pads, and arps so you hear the swarm, not a pile of beeps.`,
    )
  }

  if (influences.length) {
    const bits = influences
      .filter((i) => i.trait !== "Pixels")
      .slice(0, 3)
      .map((i) => `${i.trait} (${i.value}) brings ${i.effect}`)
    if (bits.length) {
      paragraphs.push(bits.join(". ") + ".")
    }
  }

  if (primary) {
    paragraphs.push(
      `${densityPhrase(primary.pixels).replace(/^[a-z]/, (c) => c.toUpperCase())}. Everything you hear is derived from live Normie data — no fake traits, no canned loops.`,
    )
  }

  // Prefer Venice synopsis as an extra paragraph if it's short and readable
  if (
    score.source === "venice" &&
    score.synopsis &&
    score.synopsis.length < 280 &&
    !score.synopsis.includes("→")
  ) {
    paragraphs.unshift(score.synopsis.trim())
  }

  return {
    headline,
    vibe,
    paragraphs,
    cast: cast.slice(0, 10),
    influences,
    meta: {
      bpm: score.bpm,
      key: score.root,
      scale: score.scale,
      source: score.source,
    },
  }
}

/** Lightweight cast from parts alone (when voices not loaded). */
export function castFromParts(parts: VoicePart[]): SynopsisStory["cast"] {
  return parts.slice(0, 8).map((p) => ({
    name: p.tokenId != null ? `Normie #${p.tokenId}` : "Voice",
    instrument: instrumentLabel(p.instrument),
    role: ROLE_LABELS[p.role] || p.role,
  }))
}
