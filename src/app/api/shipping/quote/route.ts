import { jsonError, jsonSuccess } from '@/lib/api/response'
import { calculateShippingQuote } from '@/lib/shipping/calculate-quote'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { shippingQuoteSchema } from '@/schemas/shipping-schema'

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rate = checkRateLimit(`shipping-quote:${ip}`, RATE_LIMITS.general)
  if (!rate.allowed) {
    return jsonError('Muitas requisições. Tente novamente em instantes.', 429, 'RATE_LIMIT')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = shippingQuoteSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  try {
    const result = await calculateShippingQuote(parsed.data)
    return jsonSuccess(result)
  } catch {
    return jsonError('Não foi possível calcular o frete', 500)
  }
}
