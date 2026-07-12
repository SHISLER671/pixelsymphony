/**
 * Pure on-chain composition entry point.
 * No AI — the Normie's live pixels + traits map deterministically to a score.
 */

import { buildFallbackScore } from "@/lib/fallback"
import type { NormieVoiceInput, VoiceScore } from "@/lib/types"

/** Compose a VoiceScore from live Normie data (client-side, free, authentic). */
export function composeScore(voices: NormieVoiceInput[]): VoiceScore {
  const score = buildFallbackScore(voices)
  return { ...score, source: "onchain" }
}
