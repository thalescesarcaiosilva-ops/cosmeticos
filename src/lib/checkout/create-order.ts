import { createAdminClient } from '@/lib/supabase/admin'
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
}): Promise<CheckoutOrderResult> {
  const admin = createAdminClient()

  const useSavedAddress = Boolean(params.userId && params.addressId)

  const { data, error } = await admin.rpc('create_checkout_order', {
    p_shipping_method_id: params.shippingMethodId,
    p_items: params.items,
    p_discount_amount: params.discountAmount ?? 0,
    p_pix_discount_percent: params.pixDiscountPercent ?? 0,
    p_user_id: useSavedAddress ? params.userId : null,
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
  return {
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
