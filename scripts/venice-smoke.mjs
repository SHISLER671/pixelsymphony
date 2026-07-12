/**
 * Smoke-test Venice chat/completions (OpenAI-compatible).
 * Loads .env.local / .env without printing the API key.
 *
 * Usage: node scripts/venice-smoke.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

function loadEnvFile(name) {
  const path = resolve(process.cwd(), name)
  if (!existsSync(path)) return
  const text = readFileSync(path, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile(".env.local")
loadEnvFile(".env")

const apiKey = (
  process.env.VENICE_API_KEY ||
  process.env.VENICE_INFERENCE_KEY ||
  ""
).trim()
const baseUrl = (
  process.env.VENICE_BASE_URL || "https://api.venice.ai/api/v1"
).replace(/\/$/, "")
const model = process.env.VENICE_MODEL || "zai-org-glm-5-2"

if (!apiKey) {
  console.error("FAIL: VENICE_API_KEY is not set in .env.local or environment")
  process.exit(1)
}

console.log("Venice smoke test")
console.log(`  base:  ${baseUrl}`)
console.log(`  model: ${model}`)
console.log(`  key:   ${apiKey.slice(0, 12)}… (${apiKey.length} chars)`)

const res = await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: "Hello! Reply in one short sentence." }],
    max_tokens: 64,
    temperature: 0.3,
  }),
})

const text = await res.text()
if (!res.ok) {
  console.error(`FAIL: HTTP ${res.status}`)
  console.error(text.slice(0, 500))
  process.exit(1)
}

let data
try {
  data = JSON.parse(text)
} catch {
  console.error("FAIL: response is not JSON")
  console.error(text.slice(0, 300))
  process.exit(1)
}

const content = data?.choices?.[0]?.message?.content
if (!content) {
  console.error("FAIL: no choices[0].message.content")
  console.error(JSON.stringify(data).slice(0, 400))
  process.exit(1)
}

console.log("OK — assistant reply:")
console.log(`  ${String(content).trim().slice(0, 300)}`)
