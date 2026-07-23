import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { getSessionUser } from '@/lib/auth/verify-session'

const ORDER_COLUMNS =
  'id, status, payment_status, payment_method, total, subtotal, shipping_price, discount_amount, shipping_method_name, address_id, shipping_address, notes, tracking_code, carrier, shipped_at, delivered_at, payment_proof_pending, created_at, updated_at'

const ORDER_ITEM_COLUMNS =
  'id, product_id, quantity, unit_price, subtotal, products(name, slug)'

const ADDRESS_COLUMNS =
  'id, street, number, complement, neighborhood, city, state, zip_code'

const TRACKING_EVENT_COLUMNS =
  'id, sequence, event_type, city, state, message, scheduled_at, occurred_at, is_manual'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select(
      `${ORDER_COLUMNS}, addresses(${ADDRESS_COLUMNS}), order_items(${ORDER_ITEM_COLUMNS}), tracking_events(${TRACKING_EVENT_COLUMNS})`
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .order('sequence', { referencedTable: 'tracking_events', ascending: true })

  if (error) {
    const legacy = await supabase
      .from('orders')
      .select(`${ORDER_COLUMNS}, order_items(${ORDER_ITEM_COLUMNS})`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (legacy.error) {
      return jsonError('Não foi possível carregar os pedidos', 500)
    }

    return jsonSuccess(legacy.data ?? [])
  }

  return jsonSuccess(data ?? [])
}
