const DEFAULT_REDIRECT = '/conta'

/** Accepts only same-origin relative paths (blocks open redirects). */
export function sanitizeRedirectPath(value: string | null | undefined, fallback = DEFAULT_REDIRECT): string {
  if (!value || typeof value !== 'string') return fallback

  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback

  try {
    const parsed = new URL(trimmed, 'http://localhost')
    if (parsed.origin !== 'http://localhost') return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
