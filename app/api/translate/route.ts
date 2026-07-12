import { NextRequest, NextResponse } from "next/server"

import { buildFallbackScore } from "@/lib/fallback"
import type { NormieVoiceInput, VoiceScore } from "@/lib/types"
import {
  hasVeniceKey,
  veniceChatCompletions,
} from "@/lib/venice-client"
import { buildTranslatePrompt, parseVoiceScore } from "@/lib/venice"

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
  // Large hives are composed client-side; keep Venice payloads bounded
  if (voices.length > 12) {
    return NextResponse.json(
      { error: "Too many voices for Venice path; use client fallback" },
      { status: 400 },
    )
  }

  if (!hasVeniceKey()) {
    const score = buildFallbackScore(voices)
    return NextResponse.json({ score, reason: "no_venice_key" })
  }

  const prompt = buildTranslatePrompt(voices)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    const result = await veniceChatCompletions({
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.4,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const parsed: VoiceScore | null = parseVoiceScore(result.content)
    if (!parsed) {
      const score = buildFallbackScore(voices)
      return NextResponse.json({ score, reason: "invalid_json" })
    }

    return NextResponse.json({ score: parsed })
  } catch (err) {
    console.error("[translate] failed", err)
    const score = buildFallbackScore(voices)
    const message = err instanceof Error ? err.message : String(err)
    const reason = message.includes("abort")
      ? "timeout_or_network"
      : message.startsWith("Venice chat/completions")
        ? `venice_error`
        : "timeout_or_network"
    return NextResponse.json({ score, reason })
  }
}
