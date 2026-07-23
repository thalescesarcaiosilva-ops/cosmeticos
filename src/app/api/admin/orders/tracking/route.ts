import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import {
  advanceNextTrackingEvent,
  registerManualTrackingLocation,
  setTrackingSimulationPaused,
} from '@/lib/tracking/advance'
import { dispatchOrderTracking } from '@/lib/tracking/dispatch'
import { adminTrackingActionSchema } from '@/schemas/tracking-schema'

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

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const orderId = new URL(request.url).searchParams.get('orderId')
  if (!orderId) return jsonError('Pedido inválido', 400)

  const admin = createAdminClient()
  const { data: order, error } = await admin
    .from('orders')
    .select(
      'id, status, tracking_code, carrier, shipped_at, delivered_at, tracking_simulation_paused'
    )
    .eq('id', orderId)
    .maybeSingle()

  if (error || !order) return jsonError('Pedido não encontrado', 404)

  const { data: events } = await admin
    .from('tracking_events')
    .select(
      'id, sequence, event_type, city, state, message, scheduled_at, occurred_at, is_manual'
    )
    .eq('order_id', orderId)
    .order('sequence', { ascending: true })

  return jsonSuccess({ order, events: events ?? [] })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = adminTrackingActionSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const payload = parsed.data

  if (payload.action === 'dispatch') {
    const result = await dispatchOrderTracking(payload.orderId)
    if (!result.ok) {
      return jsonError(result.reason ?? 'Não foi possível despachar', 400)
    }
    return jsonSuccess(result, 'Pedido despachado e código gerado')
  }

  if (payload.action === 'advance') {
    const result = await advanceNextTrackingEvent(payload.orderId)
    if (!result.ok) {
      return jsonError(
        result.reason === 'no_pending_events'
          ? 'Não há próximos eventos de rastreio'
          : (result.reason ?? 'Falha ao avançar'),
        400
      )
    }
    return jsonSuccess(result, 'Rastreio avançado')
  }

  if (payload.action === 'pause' || payload.action === 'resume') {
    const result = await setTrackingSimulationPaused(
      payload.orderId,
      payload.action === 'pause'
    )
    if (!result.ok) return jsonError(result.reason ?? 'Falha ao atualizar', 400)
    return jsonSuccess(
      result,
      payload.action === 'pause' ? 'Simulação pausada' : 'Simulação retomada'
    )
  }

  const result = await registerManualTrackingLocation({
    orderId: payload.orderId,
    city: payload.city,
    state: payload.state,
    message: payload.message,
  })
  if (!result.ok) {
    return jsonError(result.reason ?? 'Falha ao registrar localização', 400)
  }
  return jsonSuccess(result, 'Localização registrada')
}
