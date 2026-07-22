import { jsonError, jsonSuccess } from '@/lib/api/response'
import {
  assertOrderAccess,
  getOptionalSessionUserId,
  OrderAccessError,
  readGuestTokenFromRequest,
} from '@/lib/checkout/order-access'
import { createAdminClient } from '@/lib/supabase/admin'

const ORDER_COLUMNS =
  'id, user_id, status, payment_status, payment_method, customer_email, customer_name, total, subtotal, shipping_price, discount_amount, shipping_method_name, pix_qr_code, pix_expiration, created_at'

const ORDER_ITEM_COLUMNS =
  'id, product_id, quantity, unit_price, subtotal, products(name, slug)'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const userId = await getOptionalSessionUserId()
  const guestToken = readGuestTokenFromRequest(request)

  try {
    await assertOrderAccess({ orderId: id, userId, guestToken })
  } catch (e) {
    if (e instanceof OrderAccessError) {
      return jsonError('Pedido não encontrado', 404, 'ORDER_NOT_FOUND')
    }
    return jsonError('Erro ao carregar pedido', 500)
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('orders')
    .select(`${ORDER_COLUMNS}, order_items(${ORDER_ITEM_COLUMNS})`)
    .eq('id', id)
    .single()

  if (error || !data) {
    return jsonError('Pedido não encontrado', 404)
  }

  const canCreateAccount = !data.user_id && Boolean(guestToken)

  return jsonSuccess({
    ...data,
    can_create_account: canCreateAccount,
    is_linked_to_session: Boolean(userId && data.user_id === userId),
  })
}
