/**
 * OpenAI-compatible Venice client (server-side only).
 * Base: https://api.venice.ai/api/v1
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type ChatCompletionsParams = {
  messages: ChatMessage[]
  model?: string
  max_tokens?: number
  temperature?: number
  signal?: AbortSignal
}

export type ChatCompletionsResult = {
  content: string
  model: string
  raw: unknown
}

export function getVeniceApiKey(): string {
  return (
    process.env.VENICE_API_KEY ||
    process.env.VENICE_INFERENCE_KEY ||
    process.env.NEXT_PUBLIC_VENICE_API_KEY ||
    ""
  ).trim()
}

export function getVeniceBaseUrl(): string {
  const base = (
    process.env.VENICE_BASE_URL || "https://api.venice.ai/api/v1"
  ).trim()
  return base.replace(/\/$/, "")
}

export function getVeniceModel(): string {
  return (process.env.VENICE_MODEL || "zai-org-glm-5-2").trim()
}

export function hasVeniceKey(): boolean {
  return getVeniceApiKey().length > 0
}

/**
 * POST /chat/completions against Venice (OpenAI-compatible).
 */
export async function veniceChatCompletions(
  params: ChatCompletionsParams,
): Promise<ChatCompletionsResult> {
  const apiKey = getVeniceApiKey()
  if (!apiKey) {
    throw new Error("VENICE_API_KEY is not set")
  }

  const baseUrl = getVeniceBaseUrl()
  const model = params.model || getVeniceModel()
  const url = `${baseUrl}/chat/completions`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: params.messages,
      max_tokens: params.max_tokens ?? 1024,
      temperature: params.temperature ?? 0.7,
    }),
    signal: params.signal,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(
      `Venice chat/completions ${res.status}: ${errText.slice(0, 300)}`,
    )
  }

  const raw = await res.json()
  const content =
    raw?.choices?.[0]?.message?.content ??
    raw?.choices?.[0]?.text ??
    ""

  return {
    content: typeof content === "string" ? content : String(content ?? ""),
    model: raw?.model || model,
    raw,
  }
}
