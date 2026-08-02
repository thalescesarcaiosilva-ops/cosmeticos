import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import {
  backfillMediaVariantsBatch,
  countMediaMissingVariants,
} from '@/lib/media/backfill-variants'

export const maxDuration = 60

async function requireAdmin() {
  try {
    return await requireAdminUser()
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
    }
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return jsonError('Acesso negado', 403, 'FORBIDDEN')
    }
    return jsonError('Erro interno', 500)
  }
}

/** Quantas mídias ainda precisam de thumb/medium. */
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  try {
    const remaining = await countMediaMissingVariants()
    return jsonSuccess({ remaining })
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Falha ao contar mídias', 500)
  }
}

/**
 * Processa um lote de imagens antigas (thumb + medium).
 * public_url canônico NÃO muda — seguro para Google Merchant.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  let limit = 8
  try {
    const body = (await request.json()) as { limit?: unknown }
    if (typeof body.limit === 'number' && Number.isFinite(body.limit)) {
      limit = body.limit
    }
  } catch {
    // body opcional
  }

  try {
    const result = await backfillMediaVariantsBatch(limit)
    return jsonSuccess(result, `Lote: ${result.updated} atualizadas, ${result.remaining} restantes`)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Falha no backfill', 500)
  }
}
