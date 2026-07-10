import { jsonError, jsonSuccess } from '@/lib/api/response'
import { getSessionUser } from '@/lib/auth/verify-session'
import {
  addFavorite,
  getFavoriteProductIds,
  removeFavorite,
  syncFavoriteProductIds,
} from '@/lib/favorites/queries'
import { favoriteActionSchema, favoriteSyncSchema } from '@/schemas/favorites-schema'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return jsonSuccess({ loggedIn: false, productIds: [] as string[] })
  }

  const productIds = await getFavoriteProductIds(user.id)
  return jsonSuccess({ loggedIn: true, productIds })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = favoriteActionSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const ok =
    parsed.data.action === 'add'
      ? await addFavorite(user.id, parsed.data.productId)
      : await removeFavorite(user.id, parsed.data.productId)

  if (!ok) {
    return jsonError('Não foi possível atualizar favoritos', 400)
  }

  const productIds = await getFavoriteProductIds(user.id)
  return jsonSuccess({ productIds })
}

export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = favoriteSyncSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const productIds = await syncFavoriteProductIds(user.id, parsed.data.productIds)
  return jsonSuccess({ productIds })
}
