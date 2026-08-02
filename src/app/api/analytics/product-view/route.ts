import { isAnalyticsBot } from '@/lib/analytics/bot-filter'
import { incrementProductView } from '@/lib/analytics/record'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const ua = request.headers.get('user-agent')
  if (isAnalyticsBot(ua)) {
    return new Response(null, { status: 204 })
  }

  const ip = getClientIp(request)
  const limited = checkRateLimit(`product-view:${ip}`, {
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

  const productId =
    body && typeof body === 'object' && 'productId' in body
      ? String((body as { productId: unknown }).productId)
      : ''

  if (!UUID_RE.test(productId)) {
    return jsonError('productId inválido', 400)
  }

  try {
    await incrementProductView(productId)
  } catch {
    // Não falha a página do cliente
  }

  return jsonSuccess({ ok: true })
}
