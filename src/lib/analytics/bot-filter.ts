/** User-Agents de crawlers que não devem inflar analytics. */
const BOT_UA_PATTERN =
  /googlebot|google-inspectiontool|adsbot-google|storebot-google|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|applebot|chatgpt-user|gptbot|claudebot|bytespider/i

export function isAnalyticsBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return BOT_UA_PATTERN.test(userAgent)
}

const NOISE_PATH_PATTERN =
  /\.(?:php|asp|aspx|cgi|map|sql|bak|env|git|xml|txt|zip|rar|exe|dll)$/i

const NOISE_PREFIXES = [
  '/wp-admin',
  '/wp-login',
  '/wp-content',
  '/wp-includes',
  '/wordpress',
  '/xmlrpc',
  '/.env',
  '/.git',
  '/phpmyadmin',
  '/admin.php',
  '/cgi-bin',
]

/** Paths que não valem log (scanners / assets). */
export function shouldIgnoreNotFoundPath(path: string): boolean {
  const normalized = path.trim().toLowerCase()
  if (!normalized.startsWith('/')) return true
  if (normalized.length > 200) return true
  if (NOISE_PATH_PATTERN.test(normalized)) return true
  if (NOISE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true
  if (normalized.startsWith('/_next/')) return true
  if (normalized.startsWith('/api/')) return true
  return false
}

export function normalizeNotFoundPath(raw: string): string | null {
  try {
    const url = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'https://example.com')
    const path = url.pathname || '/'
    if (shouldIgnoreNotFoundPath(path)) return null
    return path.slice(0, 200)
  } catch {
    return null
  }
}
