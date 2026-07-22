import { syncProfileFromCheckout } from '@/lib/auth/claim-guest-orders'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendOrderConfirmationEmail } from '@/lib/email/order-confirmation'
import type { CheckoutCustomerInput, CheckoutShippingAddressInput } from '@/schemas/checkout-payment-schema'

export type CheckoutOrderResult = {
  id: string
  subtotal: number
  shipping_price: number
  discount_amount: number
  total: number
  shipping_method_name: string | null
  guest_access_token: string | null
}

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message)
    this.name = 'CheckoutError'
  }
}

export async function createCheckoutOrder(params: {
  shippingMethodId: string
  items: Array<{ product_id: string; quantity: number }>
  discountAmount?: number
  pixDiscountPercent?: number
  userId?: string | null
  addressId?: string | null
  customer?: CheckoutCustomerInput
  shippingAddress?: CheckoutShippingAddressInput
  document?: string | null
}): Promise<CheckoutOrderResult> {
  const admin = createAdminClient()

  // Preferência: dados do formulário (sempre enviados pelo checkout atual).
  // Ainda assim vincula user_id quando o cliente está logado — sem exigir addressId.
  const hasInlineCheckout = Boolean(params.customer && params.shippingAddress)
  const useSavedAddress = Boolean(params.userId && params.addressId && !hasInlineCheckout)

  const { data, error } = await admin.rpc('create_checkout_order', {
    p_shipping_method_id: params.shippingMethodId,
    p_items: params.items,
    p_discount_amount: params.discountAmount ?? 0,
    p_pix_discount_percent: params.pixDiscountPercent ?? 0,
    p_user_id: params.userId ?? null,
    p_address_id: useSavedAddress ? params.addressId : null,
    p_customer: useSavedAddress ? null : params.customer ?? null,
    p_shipping_address: useSavedAddress ? null : params.shippingAddress ?? null,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('INSUFFICIENT_STOCK')) {
      throw new CheckoutError('Estoque insuficiente para um ou mais produtos', 'INSUFFICIENT_STOCK')
    }
    if (msg.includes('ADDRESS_NOT_FOUND') || msg.includes('INVALID_CEP')) {
      throw new CheckoutError('Endereço inválido', 'ADDRESS_NOT_FOUND')
    }
    if (msg.includes('CUSTOMER_INCOMPLETE')) {
      throw new CheckoutError('Dados do cliente incompletos', 'PROFILE_INCOMPLETE')
    }
    if (msg.includes('SHIPPING_NOT_FOUND')) {
      throw new CheckoutError('Forma de frete inválida', 'SHIPPING_NOT_FOUND')
    }
    if (msg.includes('EMPTY_CART')) {
      throw new CheckoutError('Carrinho vazio', 'EMPTY_CART')
    }
    throw new CheckoutError('Não foi possível criar o pedido', 'ORDER_CREATE_FAILED')
  }

  const row = data as Record<string, unknown>
  const result: CheckoutOrderResult = {
    id: String(row.id),
    subtotal: Number(row.subtotal),
    shipping_price: Number(row.shipping_price),
    discount_amount: Number(row.discount_amount ?? 0),
    total: Number(row.total),
    shipping_method_name:
      typeof row.shipping_method_name === 'string' ? row.shipping_method_name : null,
    guest_access_token:
      typeof row.guest_access_token === 'string' ? row.guest_access_token : null,
  }

  if (params.userId && params.customer) {
    await syncProfileFromCheckout({
      userId: params.userId,
      name: params.customer.name,
      phone: params.customer.phone,
      cpf: params.document,
    }).catch(() => undefined)
  }

  return result
}

export async function cancelCheckoutOrder(orderId: string): Promise<void> {
  const admin = createAdminClient()
  await admin.rpc('cancel_order_and_restore_stock', { p_order_id: orderId })
}

export async function confirmCheckoutPayment(params: {
  orderId: string
  paymentMethod?: string | null
  transactionId?: number | null
}): Promise<void> {
  const admin = createAdminClient()
  await admin.rpc('confirm_order_payment', {
    p_order_id: params.orderId,
    p_payment_method: params.paymentMethod ?? null,
    p_payout_transaction_id: params.transactionId ?? null,
  })

  const { data: order } = await admin
    .from('orders')
    .select(
      `id, status, payment_status, customer_email, customer_name, customer_phone,
       total, subtotal, shipping_price, discount_amount, shipping_method_name, payment_method,
       shipping_address, created_at,
       order_items(quantity, unit_price, subtotal, products(name))`
    )
    .eq('id', params.orderId)
    .maybeSingle()

  if (!order) return

  const isPaid = order.status === 'confirmed' || order.payment_status === 'paid'
  if (!isPaid) return
  if (!order.customer_email?.trim()) return

  const dedupe = await recordWebhookEvent({
    eventId: `order-confirm-email:${order.id}`,
    orderId: order.id,
    payload: { source: 'confirm_checkout_payment', orderId: order.id },
  }).catch(() => true)

  if (!dedupe) return

  const rawItems = Array.isArray(order.order_items) ? order.order_items : []
  const items = rawItems.map((row) => {
    const item = row as {
      quantity?: number
      unit_price?: number
      subtotal?: number
      products?: { name?: string } | null
    }
    return {
      name: item.products?.name?.trim() || 'Produto',
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unit_price ?? 0),
      subtotal: Number(item.subtotal ?? 0),
    }
  })

  const shippingAddress =
    order.shipping_address && typeof order.shipping_address === 'object'
      ? (order.shipping_address as {
          street?: string
          number?: string
          complement?: string | null
          neighborhood?: string
          city?: string
          state?: string
          zip_code?: string
        })
      : null

  const sent = await sendOrderConfirmationEmail({
    orderId: order.id,
    customerEmail: order.customer_email,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    total: Number(order.total ?? 0),
    subtotal: order.subtotal != null ? Number(order.subtotal) : null,
    shippingPrice: order.shipping_price != null ? Number(order.shipping_price) : null,
    discountAmount: order.discount_amount != null ? Number(order.discount_amount) : null,
    shippingMethodName: order.shipping_method_name,
    paymentMethod: order.payment_method,
    createdAt: order.created_at,
    items,
    shippingAddress:
      shippingAddress?.street && shippingAddress.city
        ? {
            street: shippingAddress.street,
            number: shippingAddress.number ?? '',
            complement: shippingAddress.complement ?? null,
            neighborhood: shippingAddress.neighborhood ?? '',
            city: shippingAddress.city,
            state: shippingAddress.state ?? '',
            zip_code: shippingAddress.zip_code ?? '',
          }
        : null,
  })

  if (!sent.ok && process.env.NODE_ENV !== 'production') {
    console.error('[order-confirmation-email]', sent.reason)
  }
}

export async function findOrderById(orderId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('orders')
    .select('id, status, payment_status, user_id, payout_transaction_id')
    .eq('id', orderId)
    .maybeSingle()
  return data
}

export async function findOrderByPayoutTransactionId(transactionId: number) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('orders')
    .select('id, status, payment_status, user_id, payout_transaction_id')
    .eq('payout_transaction_id', transactionId)
    .maybeSingle()
  return data
}

export async function findOrderByPayoutCheckoutId(checkoutId: number) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('orders')
    .select('id, status, payment_status, user_id')
    .eq('payout_checkout_id', checkoutId)
    .maybeSingle()
  return data
}

export async function findOrderByPayoutSecureId(secureId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('orders')
    .select('id, status, payment_status, user_id')
    .eq('payout_secure_id', secureId)
    .maybeSingle()
  return data
}

export async function recordWebhookEvent(params: {
  eventId: string
  orderId?: string | null
  payload: unknown
}): Promise<boolean> {
  const admin = createAdminClient()
  const { error } = await admin.from('webhook_events').insert({
    payout_event_id: params.eventId,
    order_id: params.orderId ?? null,
    payload: params.payload as Record<string, unknown>,
    processed: true,
  })

  if (error) {
    if (error.code === '23505') return false
    throw error
  }
  return true
}
