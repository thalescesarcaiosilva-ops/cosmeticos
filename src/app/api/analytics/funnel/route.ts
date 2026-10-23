import { isAnalyticsBot } from '@/lib/analytics/bot-filter'
import { isFunnelStep } from '@/lib/analytics/funnel-steps'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  if (isAnalyticsBot(request.headers.get('user-agent'))) {
    return new Response(null, { status: 204 })
  }

  const ip = getClientIp(request)
  const limited = checkRateLimit(`funnel:${ip}`, {
    limit: 60,
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

  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const sessionId = typeof record.sessionId === 'string' ? record.sessionId : ''
  const step = typeof record.step === 'string' ? record.step : ''
  const rawPath = typeof record.path === 'string' ? record.path : ''
  const path = rawPath.startsWith('/') && rawPath.length <= 200 ? rawPath : null

  if (!UUID_RE.test(sessionId) || !isFunnelStep(step)) {
    return jsonError('Dados inválidos', 400)
  }

  try {
    const admin = createAdminClient()
    const { error } = await admin.from('store_funnel_events').upsert(
      { session_id: sessionId, step, path },
      { onConflict: 'session_id,step', ignoreDuplicates: true }
    )
    if (error) {
      return jsonSuccess({ ok: false })
    }
  } catch {
    return jsonSuccess({ ok: false })
  }

  return jsonSuccess({ ok: true })
}
