import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { orderStatusUpdateSchema } from '@/schemas/order-schema'

const ORDER_COLUMNS =
  'id, user_id, status, payment_status, payment_method, total, subtotal, shipping_price, shipping_method_name, address_id, notes, customer_name, customer_email, customer_phone, shipping_address, created_at, updated_at'

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
      `${ORDER_COLUMNS}, profiles(${PROFILE_COLUMNS}), addresses(${ADDRESS_COLUMNS}), order_items(${ORDER_ITEM_COLUMNS})`
    )
    .order('created_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) {
    const legacy = await admin
      .from('orders')
      .select(`${ORDER_COLUMNS}, order_items(${ORDER_ITEM_COLUMNS})`)
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
  const { data, error } = await admin
    .from('orders')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id)
    .select(ORDER_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível atualizar o pedido', 400)
  }

  return jsonSuccess(data, 'Status do pedido atualizado')
}
