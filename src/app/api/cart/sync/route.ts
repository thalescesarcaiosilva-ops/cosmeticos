import { jsonError, jsonSuccess } from '@/lib/api/response'
import { syncCartItems } from '@/lib/cart/sync-cart'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { cartSyncSchema } from '@/schemas/cart-schema'

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rate = checkRateLimit(`cart-sync:${ip}`, RATE_LIMITS.general)
  if (!rate.allowed) {
    return jsonError('Muitas requisições. Tente novamente em instantes.', 429, 'RATE_LIMIT')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = cartSyncSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  try {
    const result = await syncCartItems(parsed.data)
    return jsonSuccess(result)
  } catch {
    return jsonError('Não foi possível atualizar o carrinho', 500)
  }
}
