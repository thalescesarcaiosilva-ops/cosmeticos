import {
  isAnalyticsBot,
  normalizeNotFoundPath,
} from '@/lib/analytics/bot-filter'
import { incrementNotFoundPath } from '@/lib/analytics/record'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const ua = request.headers.get('user-agent')
  if (isAnalyticsBot(ua)) {
    return new Response(null, { status: 204 })
  }

  const ip = getClientIp(request)
  const limited = checkRateLimit(`not-found:${ip}`, {
    limit: 30,
    windowMs: RATE_LIMITS.general.windowMs,
  })
  if (!limited.allowed) {
    return jsonError('Muitas requisições', 429)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const rawPath =
    body && typeof body === 'object' && 'path' in body
      ? String((body as { path: unknown }).path)
      : ''
  const path = normalizeNotFoundPath(rawPath)
  if (!path) {
    return new Response(null, { status: 204 })
  }

  const referrer =
    body && typeof body === 'object' && 'referrer' in body
      ? String((body as { referrer: unknown }).referrer || '').slice(0, 300)
      : null

  try {
    await incrementNotFoundPath(path, referrer || null)
  } catch {
    // ignore
  }

  return jsonSuccess({ ok: true })
}
