/**
 * Server-side Venice budget guards.
 * When a limit trips we skip Venice and the app uses deterministic fallback —
 * the player never breaks, only the AI path is throttled.
 *
 * Note: in-memory counters are per serverless isolate (Vercel). They still
 * cut repeated spam from the same instance and during warm periods; combined
 * with result caching this protects the account without new infra.
 */

export type VeniceLimitResult =
  | { allowed: true }
  | { allowed: false; reason: string; retryAfterSec?: number }

type Bucket = {
  /** unix ms timestamps of Venice calls */
  hits: number[]
}

const ipBuckets = new Map<string, Bucket>()
let globalHits: number[] = []

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

/** Kill switch — set VENICE_ENABLED=false to force fallback-only. */
export function isVeniceEnabled(): boolean {
  const v = (process.env.VENICE_ENABLED ?? "true").trim().toLowerCase()
  return v !== "0" && v !== "false" && v !== "off" && v !== "no"
}

export function getVeniceLimits() {
  return {
    perIpHour: envInt("VENICE_LIMIT_PER_IP_HOUR", 2),
    perIpDay: envInt("VENICE_LIMIT_PER_IP_DAY", 5),
    globalDay: envInt("VENICE_LIMIT_GLOBAL_DAY", 40),
  }
}

function prune(hits: number[], windowMs: number, now: number): number[] {
  const cut = now - windowMs
  return hits.filter((t) => t > cut)
}

function clientKey(req: {
  headers: Headers
}): string {
  const xf = req.headers.get("x-forwarded-for")
  if (xf) {
    const first = xf.split(",")[0]?.trim()
    if (first) return `ip:${first}`
  }
  const real = req.headers.get("x-real-ip")?.trim()
  if (real) return `ip:${real}`
  // Vercel
  const vercel = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
  if (vercel) return `ip:${vercel}`
  return "ip:unknown"
}

/**
 * Check whether this request may spend a Venice inference call.
 * Does not record — call recordVeniceHit only after a successful API attempt
 * (or when we decide to fire the request).
 */
export function checkVeniceBudget(req: {
  headers: Headers
}): VeniceLimitResult & { clientId?: string } {
  if (!isVeniceEnabled()) {
    return { allowed: false, reason: "venice_disabled" }
  }

  const { perIpHour, perIpDay, globalDay } = getVeniceLimits()
  const now = Date.now()
  const HOUR = 60 * 60 * 1000
  const DAY = 24 * HOUR

  // Global day budget
  globalHits = prune(globalHits, DAY, now)
  if (globalHits.length >= globalDay) {
    const oldest = globalHits[0] ?? now
    const retryAfterSec = Math.max(1, Math.ceil((oldest + DAY - now) / 1000))
    return {
      allowed: false,
      reason: "venice_global_day_limit",
      retryAfterSec,
    }
  }

  const id = clientKey(req)
  const bucket = ipBuckets.get(id) ?? { hits: [] }
  bucket.hits = prune(bucket.hits, DAY, now)

  const hourHits = bucket.hits.filter((t) => t > now - HOUR)
  if (hourHits.length >= perIpHour) {
    const oldest = hourHits[0] ?? now
    return {
      allowed: false,
      reason: "venice_ip_hour_limit",
      retryAfterSec: Math.max(1, Math.ceil((oldest + HOUR - now) / 1000)),
      clientId: id,
    }
  }

  if (bucket.hits.length >= perIpDay) {
    const oldest = bucket.hits[0] ?? now
    return {
      allowed: false,
      reason: "venice_ip_day_limit",
      retryAfterSec: Math.max(1, Math.ceil((oldest + DAY - now) / 1000)),
      clientId: id,
    }
  }

  return { allowed: true, clientId: id }
}

/** Record a Venice attempt (counts toward budgets even if the model fails). */
export function recordVeniceHit(clientId?: string): void {
  const now = Date.now()
  globalHits.push(now)
  if (clientId) {
    const bucket = ipBuckets.get(clientId) ?? { hits: [] }
    bucket.hits.push(now)
    ipBuckets.set(clientId, bucket)
  }
  // Bound map size
  if (ipBuckets.size > 5000) {
    const first = ipBuckets.keys().next().value
    if (first) ipBuckets.delete(first)
  }
}
