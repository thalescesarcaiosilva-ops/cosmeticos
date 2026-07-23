import { syncCartItems } from '@/lib/cart/sync-cart'
import {
  createCardTransaction,
  createPixTransaction,
  getPayoutTransaction,
  onlyDigits,
  toCents,
  type CreateCardTransactionPayload,
  type CreatePixTransactionPayload,
  type PayoutCustomer,
} from '@/lib/payout/client'
import { buildPayoutComplianceMetadata } from '@/lib/payout/compliance-metadata'
import { isPaidStatus, resolvePixDisplay } from '@/lib/payout/pix-qrcode'
import { getCheckoutPaymentSettings } from '@/lib/payment/queries'
import { getSiteUrl } from '@/lib/seo/site-url'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ValidatedCartLine } from '@/types/cart'
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
  /** IP real do comprador (fora do metadata). Omitido se null. */
  buyerIp?: string | null
}

function buildCustomer(
  customer: CheckoutCustomerInput,
  shippingAddress: CheckoutShippingAddressInput,
  document: string
): PayoutCustomer {
  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    document: { type: 'cpf', number: onlyDigits(document) },
    address: {
      street: shippingAddress.street,
      streetNumber: shippingAddress.number,
      complement: shippingAddress.complement ?? null,
      zipCode: onlyDigits(shippingAddress.zip_code),
      neighborhood: shippingAddress.neighborhood,
      city: shippingAddress.city,
      state: shippingAddress.state.toUpperCase(),
      country: 'BR',
    },
  }
}

function buildTransactionItems(
  lines: ValidatedCartLine[],
  orderId: string,
  shippingPrice: number,
  shippingName: string
) {
  const items: CreatePixTransactionPayload['items'] = lines
    .filter((line) => line.available && line.quantity > 0)
    .map((line) => ({
      title: line.name,
      unitPrice: toCents(line.price),
      quantity: line.quantity,
      tangible: true,
      externalRef: line.productId,
    }))

  if (shippingPrice > 0) {
    items.push({
      title: `Frete — ${shippingName}`,
      unitPrice: toCents(shippingPrice),
      quantity: 1,
      tangible: true,
      externalRef: `shipping:${orderId}`,
    })
  }

  return items
}

async function attachTransactionToOrder(params: {
  orderId: string
  transactionId: number
  paymentMethod: string
  customerDocument: string
  pixQrCode?: string | null
  pixExpiration?: string | null
}) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('orders')
    .update({
      payout_transaction_id: params.transactionId,
      payment_method: params.paymentMethod,
      customer_document: onlyDigits(params.customerDocument),
      pix_qr_code: params.pixQrCode ?? null,
      pix_expiration: params.pixExpiration ?? null,
    })
    .eq('id', params.orderId)
    .eq('status', 'pending')

  if (error) {
    await cancelCheckoutOrder(params.orderId)
    throw new CheckoutError('Falha ao vincular pagamento ao pedido', 'PAYOUT_LINK_FAILED')
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

  const customer = buildCustomer(params.customer, params.shippingAddress, params.document)
  const items = buildTransactionItems(
    availableLines,
    order.id,
    order.shipping_price,
    order.shipping_method_name ?? 'Entrega'
  )

  const payload: CreatePixTransactionPayload = {
    amount: toCents(order.total),
    paymentMethod: 'pix',
    customer,
    shipping: {
      fee: toCents(order.shipping_price),
      address: customer.address,
    },
    items,
    postbackUrl: `${siteUrl}/api/webhooks/payout`,
    metadata: buildPayoutComplianceMetadata({
      userEmail: params.customer.email,
      orderId: order.id,
      shopUrl: siteUrl,
    }),
    externalRef: order.id,
    ...(params.buyerIp ? { ip: params.buyerIp } : {}),
    traceable: true,
    pix: { expiresInDays: 1 },
  }

  try {
    const transaction = await createPixTransaction(payload)
    const pixDisplay = await resolvePixDisplay(transaction as Record<string, unknown>)

    await attachTransactionToOrder({
      orderId: order.id,
      transactionId: transaction.id,
      paymentMethod: 'pix',
      customerDocument: params.document,
      pixQrCode: pixDisplay.copyPaste,
      pixExpiration: pixDisplay.expiresAt,
    })

    return {
      orderId: order.id,
      guestAccessToken: order.guest_access_token,
      total: order.total,
      discountAmount: order.discount_amount,
      transactionId: transaction.id,
      status: transaction.status ?? 'pending',
      qrCode: pixDisplay.copyPaste,
      qrImage: pixDisplay.qrImage,
      expiresAt: pixDisplay.expiresAt,
    }
  } catch (e) {
    await cancelCheckoutOrder(order.id)
    throw e
  }
}

export async function processCardCheckout(
  params: CheckoutInput & { cardHash: string; installments: number }
) {
  const siteUrl = getSiteUrl()
  if (!siteUrl) throw new CheckoutError('NEXT_PUBLIC_SITE_URL não configurada', 'SITE_URL_MISSING')

  const checkoutSettings = await getCheckoutPaymentSettings()
  if (!checkoutSettings.cardEnabled) {
    throw new CheckoutError('Pagamento via cartão indisponível', 'CARD_DISABLED')
  }

  const { cart, availableLines } = await prepareCheckoutCart(params.items, params.bundlePairs)

  const order = await createCheckoutOrder({
    shippingMethodId: params.shippingMethodId,
    items: availableLines.map((line) => ({
      product_id: line.productId,
      quantity: line.quantity,
    })),
    discountAmount: cart.bundleDiscountAmount,
    userId: params.userId,
    addressId: params.addressId,
    customer: params.customer,
    shippingAddress: params.shippingAddress,
    document: params.document,
  })

  const customer = buildCustomer(params.customer, params.shippingAddress, params.document)
  const items = buildTransactionItems(
    availableLines,
    order.id,
    order.shipping_price,
    order.shipping_method_name ?? 'Entrega'
  )

  const payload: CreateCardTransactionPayload = {
    amount: toCents(order.total),
    paymentMethod: 'credit_card',
    installments: params.installments,
    card: { hash: params.cardHash },
    customer,
    shipping: {
      fee: toCents(order.shipping_price),
      address: customer.address,
    },
    items,
    postbackUrl: `${siteUrl}/api/webhooks/payout`,
    metadata: buildPayoutComplianceMetadata({
      userEmail: params.customer.email,
      orderId: order.id,
      shopUrl: siteUrl,
    }),
    externalRef: order.id,
    ...(params.buyerIp ? { ip: params.buyerIp } : {}),
    traceable: true,
  }

  try {
    const transaction = await createCardTransaction(payload)

    await attachTransactionToOrder({
      orderId: order.id,
      transactionId: transaction.id,
      paymentMethod: 'credit_card',
      customerDocument: params.document,
    })

    const paid = isPaidStatus(transaction.status)
    if (paid) {
      await confirmCheckoutPayment({
        orderId: order.id,
        paymentMethod: 'credit_card',
        transactionId: transaction.id,
      })
    }

    return {
      orderId: order.id,
      guestAccessToken: order.guest_access_token,
      total: order.total,
      discountAmount: order.discount_amount,
      transactionId: transaction.id,
      status: transaction.status ?? 'pending',
      paid,
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
      'id, status, payment_status, payment_method, total, discount_amount, pix_qr_code, pix_expiration, payout_transaction_id'
    )
    .eq('id', params.orderId)
    .maybeSingle()

  if (error || !order) {
    throw new CheckoutError('Pedido não encontrado', 'ORDER_NOT_FOUND')
  }

  if (order.status === 'confirmed' || order.payment_status === 'paid') {
    return {
      orderId: order.id,
      status: 'paid' as const,
      paymentStatus: order.payment_status,
      orderStatus: order.status,
      paymentMethod: order.payment_method,
      total: Number(order.total),
      discountAmount: Number(order.discount_amount ?? 0),
      qrCode: order.pix_qr_code,
      expiresAt: order.pix_expiration,
    }
  }

  if (!order.payout_transaction_id) {
    return {
      orderId: order.id,
      status: 'pending' as const,
      paymentStatus: order.payment_status,
      orderStatus: order.status,
      paymentMethod: order.payment_method,
      total: Number(order.total),
      discountAmount: Number(order.discount_amount ?? 0),
      qrCode: order.pix_qr_code,
      expiresAt: order.pix_expiration,
    }
  }

  const transaction = await getPayoutTransaction(Number(order.payout_transaction_id))
  const paid = isPaidStatus(transaction.status)

  if (paid && order.status === 'pending') {
    await confirmCheckoutPayment({
      orderId: order.id,
      paymentMethod: order.payment_method ?? transaction.paymentMethod ?? null,
      transactionId: Number(order.payout_transaction_id),
    })
  }

  return {
    orderId: order.id,
    status: paid ? ('paid' as const) : ('pending' as const),
    paymentStatus: paid ? 'paid' : order.payment_status,
    orderStatus: paid ? 'confirmed' : order.status,
    paymentMethod: order.payment_method,
    total: Number(order.total),
    discountAmount: Number(order.discount_amount ?? 0),
    qrCode: order.pix_qr_code,
    expiresAt: order.pix_expiration,
    transactionStatus: transaction.status ?? null,
  }
}
