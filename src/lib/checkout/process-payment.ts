import { syncCartItems } from '@/lib/cart/sync-cart'
import {
  AllowPayError,
  createAllowPayPix,
  getAllowPayPaymentStatus,
  isAllowPayFailedStatus,
  isAllowPayPaidStatus,
} from '@/lib/allowpay/client'
import { buildPixDisplayExpiration, buildPixQrImage } from '@/lib/allowpay/pix'
import { isValidCpf } from '@/lib/checkout/cpf'
import { getCheckoutPaymentSettings } from '@/lib/payment/queries'
import { getSiteUrl } from '@/lib/seo/site-url'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  CheckoutCustomerInput,
  CheckoutShippingAddressInput,
} from '@/schemas/checkout-payment-schema'
import {
  cancelCheckoutOrder,
  CheckoutError,
  confirmCheckoutPayment,
  createCheckoutOrder,
} from '@/lib/checkout/create-order'
import { assertOrderAccess, OrderAccessError } from '@/lib/checkout/order-access'

type CheckoutInput = {
  shippingMethodId: string
  items: Array<{ product_id: string; quantity: number }>
  bundlePairs?: Array<{
    primary_product_id: string
    companion_product_id: string
    discount_percent: number
  }>
  document: string
  customer: CheckoutCustomerInput
  shippingAddress: CheckoutShippingAddressInput
  userId?: string | null
  addressId?: string | null
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function toCents(value: number): number {
  return Math.round(value * 100)
}

/** Monta a description enviada à AllowPay com o(s) nome(s) do(s) produto(s). */
function buildPixDescription(
  lines: Array<{ name: string; quantity: number }>
): string {
  const names = lines
    .map((line) => line.name.trim())
    .filter(Boolean)

  if (names.length === 0) return 'Pedido loja'

  if (names.length === 1) {
    const qty = lines[0]?.quantity ?? 1
    return qty > 1 ? `${names[0]} (x${qty})` : names[0]
  }

  const first = names[0]
  const rest = names.length - 1
  const summary = `${first} + ${rest} ${rest === 1 ? 'item' : 'itens'}`
  // AllowPay / extrato bancário costumam truncar descrições longas
  return summary.slice(0, 140)
}

async function attachPixTransactionToOrder(params: {
  orderId: string
  txid: string
  route: string
  customerDocument: string
  pixQrCode: string
  pixExpiration: string
}) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('orders')
    .update({
      allowpay_txid: params.txid,
      allowpay_route: params.route,
      payment_method: 'pix',
      customer_document: onlyDigits(params.customerDocument),
      pix_qr_code: params.pixQrCode,
      pix_expiration: params.pixExpiration,
    })
    .eq('id', params.orderId)
    .eq('status', 'pending')

  if (error) {
    await cancelCheckoutOrder(params.orderId)
    throw new CheckoutError('Falha ao vincular pagamento ao pedido', 'ALLOWPAY_LINK_FAILED')
  }
}

async function prepareCheckoutCart(
  items: Array<{ product_id: string; quantity: number }>,
  bundlePairs?: CheckoutInput['bundlePairs']
) {
  const cart = await syncCartItems({ items, bundle_pairs: bundlePairs })
  const availableLines = cart.lines.filter((line) => line.available && line.quantity > 0)
  if (availableLines.length === 0) {
    throw new CheckoutError('Seu carrinho não possui itens disponíveis', 'EMPTY_CART')
  }
  return { cart, availableLines }
}

export async function processPixCheckout(params: CheckoutInput) {
  const siteUrl = getSiteUrl()
  if (!siteUrl) throw new CheckoutError('NEXT_PUBLIC_SITE_URL não configurada', 'SITE_URL_MISSING')

  const checkoutSettings = await getCheckoutPaymentSettings()
  if (!checkoutSettings.pixEnabled) {
    throw new CheckoutError('Pagamento via Pix indisponível', 'PIX_DISABLED')
  }

  const document = onlyDigits(params.document)
  if (!isValidCpf(document)) {
    throw new CheckoutError('CPF inválido', 'INVALID_CPF')
  }

  const { cart, availableLines } = await prepareCheckoutCart(params.items, params.bundlePairs)

  const order = await createCheckoutOrder({
    shippingMethodId: params.shippingMethodId,
    items: availableLines.map((line) => ({
      product_id: line.productId,
      quantity: line.quantity,
    })),
    discountAmount: cart.bundleDiscountAmount,
    pixDiscountPercent: checkoutSettings.pixDiscount,
    userId: params.userId,
    addressId: params.addressId,
    customer: params.customer,
    shippingAddress: params.shippingAddress,
    document: params.document,
  })

  try {
    const pix = await createAllowPayPix({
      amount: toCents(order.total),
      description: buildPixDescription(availableLines),
      customer: {
        name: params.customer.name,
        email: params.customer.email,
        cellphone: onlyDigits(params.customer.phone),
        taxId: document,
      },
      // O webhook confirma o pagamento; o polling do checkout serve como reconciliação.
      webhookUrl: `${siteUrl.replace(/\/+$/, '')}/api/webhooks/allowpay`,
    })

    const qrImage = await buildPixQrImage(pix.pix_code)
    const expiresAt = buildPixDisplayExpiration()

    await attachPixTransactionToOrder({
      orderId: order.id,
      txid: pix.txid,
      route: pix.route,
      customerDocument: params.document,
      pixQrCode: pix.pix_code,
      pixExpiration: expiresAt,
    })

    return {
      orderId: order.id,
      guestAccessToken: order.guest_access_token,
      total: order.total,
      discountAmount: order.discount_amount,
      transactionId: pix.txid,
      status: 'waiting_payment' as const,
      qrCode: pix.pix_code,
      qrImage,
      expiresAt,
    }
  } catch (e) {
    await cancelCheckoutOrder(order.id)
    throw e
  }
}

export async function getOrderPaymentStatus(params: {
  orderId: string
  userId?: string | null
  guestToken?: string | null
}) {
  try {
    await assertOrderAccess({
      orderId: params.orderId,
      userId: params.userId,
      guestToken: params.guestToken,
    })
  } catch (e) {
    if (e instanceof OrderAccessError) {
      throw new CheckoutError(e.message, 'ORDER_NOT_FOUND')
    }
    throw e
  }

  const admin = createAdminClient()
  const { data: order, error } = await admin
    .from('orders')
    .select(
      'id, status, payment_status, payment_method, total, discount_amount, pix_qr_code, pix_expiration, allowpay_txid, allowpay_route'
    )
    .eq('id', params.orderId)
    .maybeSingle()

  if (error || !order) {
    throw new CheckoutError('Pedido não encontrado', 'ORDER_NOT_FOUND')
  }

  const baseResult = {
    orderId: order.id,
    paymentStatus: order.payment_status,
    orderStatus: order.status,
    paymentMethod: order.payment_method,
    total: Number(order.total),
    discountAmount: Number(order.discount_amount ?? 0),
    qrCode: order.pix_qr_code,
    expiresAt: order.pix_expiration,
  }

  if (order.status === 'confirmed' || order.payment_status === 'paid') {
    return { ...baseResult, status: 'paid' as const }
  }

  if (!order.allowpay_txid || !order.allowpay_route) {
    return { ...baseResult, status: 'pending' as const }
  }

  // Reconciliação: o webhook é a fonte primária, mas consultamos a AllowPay
  // caso ele tenha falhado ou ainda não tenha chegado.
  let transactionStatus: string | null = null
  try {
    const transaction = await getAllowPayPaymentStatus({
      txid: order.allowpay_txid,
      route: order.allowpay_route,
    })
    transactionStatus = transaction.status ?? null
  } catch (e) {
    if (!(e instanceof AllowPayError)) throw e
    return { ...baseResult, status: 'pending' as const, transactionStatus: null }
  }

  if (isAllowPayPaidStatus(transactionStatus)) {
    if (order.status === 'pending') {
      await confirmCheckoutPayment({
        orderId: order.id,
        paymentMethod: order.payment_method ?? 'pix',
      })
    }
    return {
      ...baseResult,
      status: 'paid' as const,
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      transactionStatus,
    }
  }

  if (isAllowPayFailedStatus(transactionStatus) && order.status === 'pending') {
    await cancelCheckoutOrder(order.id)
    return {
      ...baseResult,
      status: 'pending' as const,
      orderStatus: 'cancelled',
      transactionStatus,
    }
  }

  return { ...baseResult, status: 'pending' as const, transactionStatus }
}
