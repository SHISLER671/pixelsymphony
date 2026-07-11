export type SkinId = "classic" | "minimal" | "crt" | "pixel-forest"

export type VoiceRole = "primary" | "harmony" | "counter"

export type SynthType = "square" | "sawtooth" | "triangle" | "pulse"

export type ScaleName =
  | "major"
  | "minor"
  | "pentatonic"
  | "phrygian"
  | "wholetone"

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
  synth: SynthType
  notes: string[]
  durations: number[]
  filterHz: number
  gain: number
}

export interface VoiceScore {
  bpm: number
  root: string
  scale: ScaleName
  parts: VoicePart[]
  synopsis: string
  source: "venice" | "fallback"
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

export const MAX_VOICES = 3
