import { jsonError, jsonSuccess } from '@/lib/api/response'
import { getProductsByIds } from '@/lib/favorites/queries'
import { favoriteProductsSchema } from '@/schemas/favorites-schema'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = favoriteProductsSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const products = await getProductsByIds(parsed.data.productIds)
  return jsonSuccess({ products })
}
