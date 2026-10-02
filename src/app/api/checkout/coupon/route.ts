import { jsonError, jsonSuccess } from '@/lib/api/response'
import { resolveActiveCoupon } from '@/lib/checkout/coupon'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { applyCouponSchema } from '@/schemas/coupon-schema'

export async function POST(request: Request) {
  const limit = checkRateLimit(`coupon:${getClientIp(request)}`, RATE_LIMITS.coupon)
  if (!limit.allowed) {
    return jsonError('Muitas tentativas. Aguarde um instante.', 429)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = applyCouponSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Cupom inválido', 400)
  }

  const coupon = await resolveActiveCoupon(parsed.data.code, parsed.data.merchandiseTotal)
  if (!coupon || coupon.discountAmount <= 0) {
    return jsonError('Cupom inválido', 400)
  }

  return jsonSuccess(coupon)
}
