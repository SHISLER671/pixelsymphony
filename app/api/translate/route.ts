import { NextRequest, NextResponse } from "next/server"

import { buildFallbackScore } from "@/lib/fallback"
import type { NormieVoiceInput, VoiceScore } from "@/lib/types"
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
      { error: "voices[] required (1–3 Normies)" },
      { status: 400 },
    )
  }
  if (voices.length > 3) {
    return NextResponse.json(
      { error: "Max 3 Normies" },
      { status: 400 },
    )
  }

  const veniceKey = (
    process.env.VENICE_API_KEY ||
    process.env.VENICE_INFERENCE_KEY ||
    process.env.NEXT_PUBLIC_VENICE_API_KEY ||
    ""
  ).trim()

  if (!veniceKey) {
    const score = buildFallbackScore(voices)
    return NextResponse.json({ score, reason: "no_venice_key" })
  }

  const prompt = buildTranslatePrompt(voices)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    const res = await fetch("https://api.venice.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${veniceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "hermes-3-llama-3.1-405b",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.4,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.error("[translate] Venice error", res.status, errText.slice(0, 200))
      const score = buildFallbackScore(voices)
      return NextResponse.json({
        score,
        reason: `venice_${res.status}`,
      })
    }

    const data = await res.json()
    const content =
      data.choices?.[0]?.message?.content ??
      data.choices?.[0]?.text ??
      ""

    const parsed: VoiceScore | null = parseVoiceScore(content)
    if (!parsed) {
      const score = buildFallbackScore(voices)
      return NextResponse.json({ score, reason: "invalid_json" })
    }

    return NextResponse.json({ score: parsed })
  } catch (err) {
    console.error("[translate] failed", err)
    const score = buildFallbackScore(voices)
    return NextResponse.json({
      score,
      reason: "timeout_or_network",
    })
  }
}
