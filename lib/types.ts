export type SkinId = "classic" | "minimal" | "crt" | "pixel-forest"

export type VoiceRole = "primary" | "harmony" | "counter" | "pad" | "bass" | "arp"

/** Instrument families — Type / Accessory pick these (what makes sound) */
export type InstrumentId =
  | "agent-pad" // warm FM pad — AI agent hymn
  | "human-lead" // expressive saw lead
  | "cat-pluck" // soft triangle pluck
  | "alien-bell" // metallic / FM bell
  | "choir-ah" // stacked sine AM "vocal"
  | "bass-sub" // deep saw / sine hybrid
  | "arp-pulse" // classic synthwave arp
  | "glass-keys" // bright keys
  | "noise-breath" // soft filtered texture hits

export type ScaleName =
  | "major"
  | "minor"
  | "pentatonic"
  | "phrygian"
  | "wholetone"
  | "dorian"
  | "mixolydian"

/** @deprecated prefer instrument */
export type SynthType = "square" | "sawtooth" | "triangle" | "pulse" | "sine" | "fatsawtooth"

export interface NormieTrait {
  trait_type: string
  value: string | number
  display_type?: string
}

export interface NormieVoiceInput {
  tokenId: number
  name: string
  pixels: string
  traits: NormieTrait[]
  imageUrl: string
  role: VoiceRole
}

export interface VoicePart {
  role: VoiceRole
  instrument: InstrumentId
  /** legacy oscillator hint */
  synth?: SynthType
  notes: string[]
  durations: number[]
  filterHz: number
  gain: number
  attack?: number
  decay?: number
  sustain?: number
  release?: number
  pan?: number
  /** 0–1 send levels for bus FX */
  reverbSend?: number
  delaySend?: number
  tokenId?: number
  /** Seconds into the shared loop before this part enters (mycelium stagger) */
  startOffset?: number
}

export interface VoiceScore {
  bpm: number
  root: string
  scale: ScaleName
  parts: VoicePart[]
  synopsis: string
  /** Always on-chain deterministic compose (no AI) */
  source: "onchain"
  swing?: number
  /** Shared loop length in seconds (forest cycle) */
  loopSeconds?: number
}

export interface OwnedNormieSummary {
  tokenId: number
  name?: string
}

export const SKIN_LABELS: Record<SkinId, string> = {
  classic: "Classic 90s",
  minimal: "Minimal",
  crt: "CRT Scanline",
  "pixel-forest": "Pixel Forest",
}

export const SAMPLE_NORMIE_IDS = [7141, 1, 42] as const

/** Soft UI hint only — no hard selection cap. Audio layers are capped separately. */
export const MAX_VOICES = 9999

/** Max simultaneous Tone.js parts (browser CPU safety for large ensembles) */
export const MAX_AUDIO_PARTS = 18
