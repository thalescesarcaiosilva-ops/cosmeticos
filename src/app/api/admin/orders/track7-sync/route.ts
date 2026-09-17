import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { isTrack7Configured } from '@/lib/track7/client'
import { syncOrderToTrack7 } from '@/lib/track7/sync-order'

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

/** POST — reenvia até 30 pedidos pagos sem sync Track7. */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  if (!isTrack7Configured()) {
    return jsonError(
      'TRACK7_API_KEY não configurada neste ambiente',
      503,
      'CONFIG'
    )
  }

  let limit = 30
  try {
    const body = (await request.json()) as { limit?: number }
    if (typeof body.limit === 'number' && body.limit > 0) {
      limit = Math.min(50, Math.floor(body.limit))
    }
  } catch {
    // body opcional
  }

  const admin = createAdminClient()
  const { data: orders, error } = await admin
    .from('orders')
    .select('id')
    .eq('payment_status', 'paid')
    .is('track7_synced_at', null)
    .is('tracking_code', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return jsonError('Não foi possível listar pedidos', 500)

  const results: Array<{ id: string; ok: boolean; reason?: string }> = []
  for (const order of orders ?? []) {
    const result = await syncOrderToTrack7(order.id, { force: true })
    results.push({
      id: order.id,
      ok: result.ok,
      reason: result.reason,
    })
  }

  const ok = results.filter((r) => r.ok).length
  const fail = results.length - ok

  return jsonSuccess(
    { ok, fail, results },
    `Track7 sync em lote: ${ok} ok, ${fail} falha(s)`
  )
}
