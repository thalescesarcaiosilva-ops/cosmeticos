import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { completeTrackingAsDelivered } from '@/lib/tracking/advance'
import { dispatchOrderTracking } from '@/lib/tracking/dispatch'
import { orderStatusUpdateSchema } from '@/schemas/order-schema'

const ORDER_COLUMNS =
  'id, user_id, status, payment_status, payment_method, total, subtotal, shipping_price, shipping_method_name, address_id, notes, customer_name, customer_email, customer_phone, shipping_address, tracking_code, carrier, shipped_at, delivered_at, tracking_simulation_paused, payment_proof_pending, created_at, updated_at'

const ORDER_ITEM_COLUMNS =
  'id, product_id, quantity, unit_price, subtotal, products(name, slug)'

const ADDRESS_COLUMNS =
  'id, street, number, complement, neighborhood, city, state, zip_code'

const PROFILE_COLUMNS = 'id, name'

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

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')

  const admin = createAdminClient()

  let query = admin
    .from('orders')
    .select(
      `${ORDER_COLUMNS}, profiles(${PROFILE_COLUMNS}), addresses(${ADDRESS_COLUMNS}), order_items(${ORDER_ITEM_COLUMNS}), tracking_events(id, sequence, event_type, city, state, message, scheduled_at, occurred_at, is_manual)`
    )
    .order('created_at', { ascending: false })
    .order('sequence', { referencedTable: 'tracking_events', ascending: true })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) {
    const legacy = await admin
      .from('orders')
      .select(
        `id, user_id, status, payment_status, payment_method, total, subtotal, shipping_price, shipping_method_name, address_id, notes, customer_name, customer_email, customer_phone, shipping_address, tracking_code, carrier, shipped_at, delivered_at, tracking_simulation_paused, created_at, updated_at, order_items(${ORDER_ITEM_COLUMNS})`
      )
      .order('created_at', { ascending: false })

    if (legacy.error) {
      return jsonError('Não foi possível carregar os pedidos', 500)
    }

    return jsonSuccess(legacy.data ?? [])
  }

  return jsonSuccess(data ?? [])
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = orderStatusUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const admin = createAdminClient()

  if (parsed.data.status === 'shipped') {
    const dispatched = await dispatchOrderTracking(parsed.data.id)
    if (!dispatched.ok) {
      return jsonError(dispatched.reason ?? 'Não foi possível despachar o pedido', 400)
    }
  } else if (parsed.data.status === 'delivered') {
    const completed = await completeTrackingAsDelivered(parsed.data.id)
    if (!completed.ok) {
      const { error } = await admin
        .from('orders')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .eq('id', parsed.data.id)
      if (error) return jsonError('Não foi possível atualizar o pedido', 400)
    }
  } else {
    const { error } = await admin
      .from('orders')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)

    if (error) {
      return jsonError('Não foi possível atualizar o pedido', 400)
    }
  }

  const { data, error } = await admin
    .from('orders')
    .select(
      `${ORDER_COLUMNS}, tracking_events(id, sequence, event_type, city, state, message, scheduled_at, occurred_at, is_manual)`
    )
    .eq('id', parsed.data.id)
    .order('sequence', { referencedTable: 'tracking_events', ascending: true })
    .single()

  if (error || !data) {
    return jsonError('Não foi possível atualizar o pedido', 400)
  }

  return jsonSuccess(data, 'Status do pedido atualizado')
}
