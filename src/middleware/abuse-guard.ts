/**
 * Abuse guard for /mcp.
 *
 * A lightweight in-memory token bucket keyed by client IP that throttles
 * clients sending many unauthenticated requests. Prevents key-guessing and
 * cheap session-init DoS from one source. Single-replica only — move to Redis
 * if the MCP service ever scales out.
 */

const WINDOW_MS = 60_000
const MAX_FAILURES_PER_WINDOW = 30
const BLOCK_MS = 5 * 60_000
const MAX_ENTRIES = 10_000

type Entry = {
  failures: number
  windowStart: number
  blockedUntil: number
}

const entries = new Map<string, Entry>()

export type AbuseCheck =
  | { blocked: false }
  | { blocked: true; retryAfterSeconds: number }

export function checkAbuse(ip: string, now: number = Date.now()): AbuseCheck {
  const entry = entries.get(ip)
  if (!entry) return { blocked: false }

  if (entry.blockedUntil > now) {
    return { blocked: true, retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000) }
  }

  return { blocked: false }
}

export function recordAuthFailure(ip: string, now: number = Date.now()): void {
  let entry = entries.get(ip)
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { failures: 0, windowStart: now, blockedUntil: 0 }
  }

  entry.failures += 1
  if (entry.failures >= MAX_FAILURES_PER_WINDOW) {
    entry.blockedUntil = now + BLOCK_MS
  }

  entries.set(ip, entry)

  if (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value
    if (oldest !== undefined) entries.delete(oldest)
  }
}

export function resetAbuse(ip: string): void {
  entries.delete(ip)
}
