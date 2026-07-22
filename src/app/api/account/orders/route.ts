import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { getSessionUser } from '@/lib/auth/verify-session'

const ORDER_COLUMNS =
  'id, status, payment_status, payment_method, total, subtotal, shipping_price, discount_amount, shipping_method_name, address_id, shipping_address, notes, created_at, updated_at'

const ORDER_ITEM_COLUMNS =
  'id, product_id, quantity, unit_price, subtotal, products(name, slug)'

const ADDRESS_COLUMNS =
  'id, street, number, complement, neighborhood, city, state, zip_code'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select(
      `${ORDER_COLUMNS}, addresses(${ADDRESS_COLUMNS}), order_items(${ORDER_ITEM_COLUMNS})`
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    // Fallback se join de addresses falhar em schemas legados
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
