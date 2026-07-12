import { NextRequest, NextResponse } from "next/server"

import { buildFallbackScore } from "@/lib/fallback"
import type { NormieVoiceInput, VoiceScore } from "@/lib/types"
import {
  hasVeniceKey,
  veniceChatCompletions,
} from "@/lib/venice-client"
import {
  getCachedVeniceScore,
  setCachedVeniceScore,
} from "@/lib/venice-cache"
import {
  checkVeniceBudget,
  recordVeniceHit,
} from "@/lib/venice-limit"
import { buildTranslatePrompt, parseVoiceScore } from "@/lib/venice"

function fallback(
  voices: NormieVoiceInput[],
  reason: string,
  extra?: Record<string, unknown>,
) {
  const score = buildFallbackScore(voices)
  return NextResponse.json({ score, reason, ...extra })
}

export async function POST(req: NextRequest) {
  let body: { voices?: NormieVoiceInput[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const voices = body.voices ?? []
  if (!Array.isArray(voices) || voices.length === 0) {
    return NextResponse.json(
      { error: "voices[] required (at least 1 Normie)" },
      { status: 400 },
    )
  }
  // Large hives never hit Venice (expensive + huge prompts)
  if (voices.length > 6) {
    return fallback(voices, "ensemble_too_large_for_venice")
  }

  if (!hasVeniceKey()) {
    return fallback(voices, "no_venice_key")
  }

  // Cache hit — free, no inference spend
  const cached = getCachedVeniceScore(voices)
  if (cached) {
    return NextResponse.json({
      score: cached,
      reason: "venice_cache",
    })
  }

  // Rate / budget limits — app still works via fallback
  const budget = checkVeniceBudget(req)
  if (!budget.allowed) {
    return fallback(voices, budget.reason, {
      retryAfterSec: budget.retryAfterSec,
    })
  }

  const prompt = buildTranslatePrompt(voices)

  try {
    // Count the attempt before the network call so aborts still count
    recordVeniceHit(budget.clientId)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25_000)

    const result = await veniceChatCompletions({
      messages: [{ role: "user", content: prompt }],
      // Cap completion size to control cost
      max_tokens: 1200,
      temperature: 0.4,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const parsed: VoiceScore | null = parseVoiceScore(result.content)
    if (!parsed) {
      return fallback(voices, "invalid_json")
    }

    setCachedVeniceScore(voices, parsed)
    return NextResponse.json({ score: parsed, reason: "venice" })
  } catch (err) {
    console.error("[translate] failed", err)
    const message = err instanceof Error ? err.message : String(err)
    const reason = message.includes("abort")
      ? "timeout_or_network"
      : message.startsWith("Venice chat/completions")
        ? "venice_error"
        : "timeout_or_network"
    return fallback(voices, reason)
  }
}
