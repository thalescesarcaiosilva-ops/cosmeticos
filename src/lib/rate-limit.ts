type RateLimitConfig = {
  limit: number
  windowMs: number
}

type Entry = {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 60_000 },
  register: { limit: 5, windowMs: 60_000 },
  forgotPassword: { limit: 3, windowMs: 60_000 },
  general: { limit: 100, windowMs: 60_000 },
} satisfies Record<string, RateLimitConfig>

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: 0; retryAfterSeconds: number }

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, remaining: config.limit - 1 }
  }

  if (entry.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  entry.count += 1
  store.set(key, entry)
  return { allowed: true, remaining: config.limit - entry.count }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown'
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}
