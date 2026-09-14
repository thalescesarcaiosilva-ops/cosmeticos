import { syncCartItems } from '@/lib/cart/sync-cart'
import { isValidCpf } from '@/lib/checkout/cpf'
import {
  cancelCheckoutOrder,
  CheckoutError,
  confirmCheckoutPayment,
  createCheckoutOrder,
} from '@/lib/checkout/create-order'
import { assertOrderAccess, OrderAccessError } from '@/lib/checkout/order-access'
import { getCheckoutPaymentSettings } from '@/lib/payment/queries'
import { getSiteUrl } from '@/lib/seo/site-url'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createVenoPix,
  getVenoPixStatus,
  isVenoFailedStatus,
  isVenoPaidStatus,
  VenoError,
} from '@/lib/veno/client'
import { buildPixQrImage, resolvePixExpiration } from '@/lib/veno/pix'
import { assertVenoProductsSum, buildVenoProducts } from '@/lib/veno/products'
import type {
  CheckoutCustomerInput,
  CheckoutShippingAddressInput,
} from '@/schemas/checkout-payment-schema'

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

function buildPixDescription(lines: Array<{ name: string; quantity: number }>): string {
  const names = lines.map((line) => line.name.trim()).filter(Boolean)
  if (names.length === 0) return 'Pedido loja'
  if (names.length === 1) {
    const qty = lines[0]?.quantity ?? 1
    return qty > 1 ? `${names[0]} (x${qty})` : names[0]!
  }
  const rest = names.length - 1
  return `${names[0]} + ${rest} ${rest === 1 ? 'item' : 'itens'}`.slice(0, 140)
}

async function attachPixTransactionToOrder(params: {
  orderId: string
  depositId: string
  txid: string
  customerDocument: string
  pixQrCode: string
  pixExpiration: string
}) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('orders')
    .update({
      veno_deposit_id: params.depositId,
      allowpay_txid: params.txid,
      allowpay_route: null,
      payment_method: 'pix',
      customer_document: onlyDigits(params.customerDocument),
      pix_qr_code: params.pixQrCode,
      pix_expiration: params.pixExpiration,
    })
    .eq('id', params.orderId)
    .eq('status', 'pending')

  if (error) {
    await cancelCheckoutOrder(params.orderId)
    throw new CheckoutError('Falha ao vincular pagamento ao pedido', 'VENO_LINK_FAILED')
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
    const amountCents = toCents(order.total)
    const products = assertVenoProductsSum(
      buildVenoProducts({
        lines: availableLines.map((line) => ({
          productId: line.productId,
          name: line.name,
          quantity: line.quantity,
          lineTotalReais: Number(line.displayLineTotal ?? line.lineTotal),
        })),
        shippingReais: order.shipping_price,
        totalCents: amountCents,
      }),
      amountCents
    )

    const addr = params.shippingAddress
    const pix = await createVenoPix({
      amount: amountCents,
      description: buildPixDescription(availableLines),
      externalId: order.id,
      callbackUrl: `${siteUrl.replace(/\/+$/, '')}/api/webhooks/veno`,
      payer: {
        name: params.customer.name,
        email: params.customer.email,
        document,
        phone: onlyDigits(params.customer.phone),
        address: [addr.street, addr.number].filter(Boolean).join(', '),
        city: addr.city,
        state: addr.state,
        zip_code: onlyDigits(addr.zip_code),
      },
      products,
    })

    const qrImage = await buildPixQrImage(pix.pixCopyPaste)
    const expiresAt = resolvePixExpiration(pix.expiresAt)

    await attachPixTransactionToOrder({
      orderId: order.id,
      depositId: pix.id,
      txid: pix.txid,
      customerDocument: params.document,
      pixQrCode: pix.pixCopyPaste,
      pixExpiration: expiresAt,
    })

    return {
      orderId: order.id,
      guestAccessToken: order.guest_access_token,
      total: order.total,
      discountAmount: order.discount_amount,
      transactionId: pix.txid,
      status: 'waiting_payment' as const,
      qrCode: pix.pixCopyPaste,
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
      'id, status, payment_status, payment_method, total, discount_amount, pix_qr_code, pix_expiration, veno_deposit_id, allowpay_txid'
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

  const depositId = order.veno_deposit_id as string | null
  if (!depositId) {
    return { ...baseResult, status: 'pending' as const }
  }

  let transactionStatus: string | null = null
  try {
    const transaction = await getVenoPixStatus(depositId)
    transactionStatus = transaction.status ?? null
  } catch (e) {
    if (!(e instanceof VenoError)) throw e
    return { ...baseResult, status: 'pending' as const, transactionStatus: null }
  }

  if (isVenoPaidStatus(transactionStatus)) {
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

  if (isVenoFailedStatus(transactionStatus) && order.status === 'pending') {
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

export { VenoError }
