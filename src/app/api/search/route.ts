import { jsonError, jsonSuccess } from '@/lib/api/response'
import { searchProducts } from '@/lib/products/search'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { searchQuerySchema } from '@/schemas/search-schema'

export async function GET(request: Request) {
  const ip = getClientIp(request)
  const rate = checkRateLimit(`search:${ip}`, RATE_LIMITS.general)
  if (!rate.allowed) {
    return jsonError('Muitas requisições. Tente novamente em instantes.', 429, 'RATE_LIMIT')
  }

  const { searchParams } = new URL(request.url)
  const parsed = searchQuerySchema.safeParse({ q: searchParams.get('q') ?? '' })

  if (!parsed.success) {
    return jsonSuccess([])
  }

  try {
    const products = await searchProducts(parsed.data.q)
    return jsonSuccess(products)
  } catch {
    return jsonError('Não foi possível buscar produtos', 500)
  }
}
