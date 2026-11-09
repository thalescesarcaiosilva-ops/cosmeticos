import { syncCartItems } from '@/lib/cart/sync-cart'
import { resolveActiveCoupon } from '@/lib/checkout/coupon'
import { roundMoney } from '@/lib/checkout/coupon-math'
import { isValidCpf } from '@/lib/checkout/cpf'
import {
  cancelCheckoutOrder,
  CheckoutError,
  confirmCheckoutPayment,
  createCheckoutOrder,
} from '@/lib/checkout/create-order'
import { assertOrderAccess, OrderAccessError } from '@/lib/checkout/order-access'
import { calcInstallmentTotal } from '@/lib/payment/installment-rates'
import { buildInstallmentTable } from '@/lib/payment/installment-table'
import { getCheckoutPaymentSettings, getPaymentSettings } from '@/lib/payment/queries'
import {
  createPayoutBrCardTransaction,
  getPayoutBrTransaction,
  isPayoutBrFailedStatus,
  isPayoutBrPaidStatus,
  PayoutBrError,
} from '@/lib/payoutbr/client'
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
  couponCode?: string | null
}

type CardCheckoutInput = CheckoutInput & {
  cardHash: string
  installments: number
  clientIp?: string | null
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

async function attachCardTransactionToOrder(params: {
  orderId: string
  transactionId: number
  secureId?: string | null
  customerDocument: string
  chargedTotal: number
}) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('orders')
    .update({
      payout_transaction_id: params.transactionId,
      payout_secure_id: params.secureId ?? null,
      payment_method: 'credit_card',
      customer_document: onlyDigits(params.customerDocument),
      total: params.chargedTotal,
    })
    .eq('id', params.orderId)
    .eq('status', 'pending')

  if (error) {
    await cancelCheckoutOrder(params.orderId)
    throw new CheckoutError('Falha ao vincular pagamento ao pedido', 'PAYOUTBR_LINK_FAILED')
  }
}

function lineSignature(lines: Array<{ productId: string; quantity: number }>): string {
  return lines
    .map((l) => `${l.productId}:${l.quantity}`)
    .sort()
    .join('|')
}

/**
 * Reaproveita um pedido Pix pendente e ainda válido, do mesmo cliente,
 * com o mesmo carrinho — evita duplicar ao reenviar o mesmo pedido
 * (double-click, reload antes de restaurar o estado local, etc.).
 *
 * Não bloqueia pedidos novos/diferentes: só reaproveita quando itens,
 * frete e e-mail coincidem exatamente com um pedido recente ainda pagável.
 */
async function findReusablePendingOrder(params: {
  customerEmail: string
  shippingMethodId: string
  lines: Array<{ productId: string; quantity: number }>
  couponCode?: string | null
}): Promise<{
  orderId: string
  guestAccessToken: string | null
  total: number
  discountAmount: number
  qrCode: string
  expiresAt: string
} | null> {
  const email = params.customerEmail.trim().toLowerCase()
  if (!email) return null

  const admin = createAdminClient()
  const windowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const nowIso = new Date().toISOString()

  const { data: candidates } = await admin
    .from('orders')
    .select(
      `id, total, discount_amount, guest_access_token, pix_qr_code, pix_expiration,
       shipping_method_id, coupon_code, created_at,
       order_items(product_id, quantity)`
    )
    .ilike('customer_email', email)
    .eq('status', 'pending')
    .eq('payment_method', 'pix')
    .gte('created_at', windowStart)
    .gt('pix_expiration', nowIso)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!candidates?.length) return null

  const targetSignature = lineSignature(params.lines)

  for (const candidate of candidates) {
    if (candidate.shipping_method_id !== params.shippingMethodId) continue
    if (!candidate.pix_qr_code || !candidate.pix_expiration) continue

    const rows = Array.isArray(candidate.order_items) ? candidate.order_items : []
    const candidateSignature = lineSignature(
      rows.map((row) => ({
        productId: String((row as { product_id: string }).product_id),
        quantity: Number((row as { quantity: number }).quantity ?? 0),
      }))
    )

    if (candidateSignature !== targetSignature) continue

    const storedCoupon = typeof candidate.coupon_code === 'string' ? candidate.coupon_code : ''
    if (storedCoupon !== (params.couponCode ?? '')) continue

    return {
      orderId: candidate.id,
      guestAccessToken: candidate.guest_access_token,
      total: Number(candidate.total),
      discountAmount: Number(candidate.discount_amount ?? 0),
      qrCode: candidate.pix_qr_code,
      expiresAt: candidate.pix_expiration,
    }
  }

  return null
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

  let couponCode: string | null = null
  let couponDiscount = 0
  const requestedCoupon = params.couponCode?.trim() ?? ''
  if (requestedCoupon) {
    const coupon = await resolveActiveCoupon(requestedCoupon, cart.merchandiseTotal)
    if (!coupon) {
      throw new CheckoutError('Cupom inválido', 'INVALID_COUPON')
    }
    couponCode = coupon.code
    couponDiscount = coupon.discountAmount
  }

  // Evita duplicar pedido/pagamento se o mesmo carrinho já tem um Pix
  // pendente e ainda válido (double-click, retry antes do estado local
  // ser restaurado, etc.). Pedidos com itens/frete diferentes não são
  // afetados — o cliente sempre pode fazer um pedido novo.
  const reusable = await findReusablePendingOrder({
    customerEmail: params.customer.email,
    shippingMethodId: params.shippingMethodId,
    lines: availableLines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
    couponCode,
  })

  if (reusable) {
    const qrImage = await buildPixQrImage(reusable.qrCode)
    return {
      orderId: reusable.orderId,
      guestAccessToken: reusable.guestAccessToken,
      total: reusable.total,
      discountAmount: reusable.discountAmount,
      transactionId: null,
      status: 'waiting_payment' as const,
      qrCode: reusable.qrCode,
      qrImage,
      expiresAt: reusable.expiresAt,
    }
  }

  const order = await createCheckoutOrder({
    shippingMethodId: params.shippingMethodId,
    items: availableLines.map((line) => ({
      product_id: line.productId,
      quantity: line.quantity,
    })),
    discountAmount: roundMoney(
      cart.bundleDiscountAmount + (cart.quantityDiscountAmount ?? 0) + couponDiscount
    ),
    pixDiscountPercent: checkoutSettings.pixDiscount,
    usedBuyTogether: cart.bundleDiscountAmount > 0,
    userId: params.userId,
    addressId: params.addressId,
    customer: params.customer,
    shippingAddress: params.shippingAddress,
    document: params.document,
  })

  if (couponCode) {
    await createAdminClient().from('orders').update({ coupon_code: couponCode }).eq('id', order.id)
  }

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

export async function processCardCheckout(params: CardCheckoutInput) {
  const siteUrl = getSiteUrl()
  if (!siteUrl) throw new CheckoutError('NEXT_PUBLIC_SITE_URL não configurada', 'SITE_URL_MISSING')

  const checkoutSettings = await getCheckoutPaymentSettings()
  if (!checkoutSettings.cardEnabled) {
    throw new CheckoutError('Pagamento com cartão indisponível', 'CARD_DISABLED')
  }

  const document = onlyDigits(params.document)
  if (!isValidCpf(document)) {
    throw new CheckoutError('CPF inválido', 'INVALID_CPF')
  }

  const cardHash = params.cardHash.trim()
  if (cardHash.length < 20) {
    throw new CheckoutError('Token do cartão inválido', 'INVALID_CARD_TOKEN')
  }

  const { cart, availableLines } = await prepareCheckoutCart(params.items, params.bundlePairs)

  let couponCode: string | null = null
  let couponDiscount = 0
  const requestedCoupon = params.couponCode?.trim() ?? ''
  if (requestedCoupon) {
    const coupon = await resolveActiveCoupon(requestedCoupon, cart.merchandiseTotal)
    if (!coupon) {
      throw new CheckoutError('Cupom inválido', 'INVALID_COUPON')
    }
    couponCode = coupon.code
    couponDiscount = coupon.discountAmount
  }

  const order = await createCheckoutOrder({
    shippingMethodId: params.shippingMethodId,
    items: availableLines.map((line) => ({
      product_id: line.productId,
      quantity: line.quantity,
    })),
    discountAmount: roundMoney(
      cart.bundleDiscountAmount + (cart.quantityDiscountAmount ?? 0) + couponDiscount
    ),
    pixDiscountPercent: 0,
    usedBuyTogether: cart.bundleDiscountAmount > 0,
    userId: params.userId,
    addressId: params.addressId,
    customer: params.customer,
    shippingAddress: params.shippingAddress,
    document: params.document,
  })

  if (couponCode) {
    await createAdminClient().from('orders').update({ coupon_code: couponCode }).eq('id', order.id)
  }

  try {
    const paymentSettings = await getPaymentSettings()
    const installmentOptions = buildInstallmentTable(order.total, paymentSettings)
    const selected = installmentOptions.find((row) => row.count === params.installments)
    if (!selected) {
      throw new CheckoutError('Número de parcelas inválido para este valor', 'INVALID_INSTALLMENTS')
    }

    const { total: chargedTotal } = calcInstallmentTotal(
      order.total,
      params.installments,
      paymentSettings
    )
    const amountCents = toCents(chargedTotal)
    const addr = params.shippingAddress

    const transaction = await createPayoutBrCardTransaction({
      amount: amountCents,
      installments: params.installments,
      cardHash,
      customer: {
        name: params.customer.name,
        email: params.customer.email,
        phone: onlyDigits(params.customer.phone),
        document: { number: document, type: 'cpf' },
        externalRef: order.id,
      },
      items: [
        {
          title: buildPixDescription(availableLines).slice(0, 120) || 'Pedido loja',
          unitPrice: amountCents,
          quantity: 1,
          tangible: true,
          externalRef: order.id,
        },
      ],
      shipping: {
        fee: toCents(order.shipping_price),
        address: {
          street: addr.street,
          streetNumber: addr.number,
          complement: addr.complement || null,
          zipCode: onlyDigits(addr.zip_code),
          neighborhood: addr.neighborhood,
          city: addr.city,
          state: addr.state.toUpperCase(),
          country: 'br',
        },
      },
      postbackUrl: `${siteUrl}/api/webhooks/payoutbr`,
      metadata: order.id,
      ip: params.clientIp ?? null,
    })

    await attachCardTransactionToOrder({
      orderId: order.id,
      transactionId: transaction.id,
      secureId: transaction.secureId,
      customerDocument: params.document,
      chargedTotal,
    })

    if (isPayoutBrPaidStatus(transaction.status)) {
      await confirmCheckoutPayment({
        orderId: order.id,
        paymentMethod: 'credit_card',
        payoutTransactionId: transaction.id,
      })

      return {
        orderId: order.id,
        guestAccessToken: order.guest_access_token,
        total: chargedTotal,
        discountAmount: order.discount_amount,
        transactionId: transaction.id,
        installments: params.installments,
        status: 'paid' as const,
      }
    }

    if (isPayoutBrFailedStatus(transaction.status)) {
      await cancelCheckoutOrder(order.id)
      const reason =
        transaction.refusedReason?.description?.trim() ||
        'Pagamento recusado pela operadora. Tente outro cartão ou use Pix.'
      throw new CheckoutError(reason, 'CARD_REFUSED')
    }

    return {
      orderId: order.id,
      guestAccessToken: order.guest_access_token,
      total: chargedTotal,
      discountAmount: order.discount_amount,
      transactionId: transaction.id,
      installments: params.installments,
      status: 'waiting_payment' as const,
    }
  } catch (e) {
    if (e instanceof CheckoutError) {
      if (e.code !== 'CARD_REFUSED') {
        await cancelCheckoutOrder(order.id).catch(() => undefined)
      }
      throw e
    }
    await cancelCheckoutOrder(order.id).catch(() => undefined)
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
      'id, status, payment_status, payment_method, total, discount_amount, pix_qr_code, pix_expiration, veno_deposit_id, allowpay_txid, payout_transaction_id'
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

  if (order.payment_method === 'credit_card') {
    const payoutTransactionId =
      typeof order.payout_transaction_id === 'number'
        ? order.payout_transaction_id
        : Number(order.payout_transaction_id)

    if (!Number.isFinite(payoutTransactionId) || payoutTransactionId <= 0) {
      return { ...baseResult, status: 'pending' as const }
    }

    let transactionStatus: string | null = null
    try {
      const transaction = await getPayoutBrTransaction(payoutTransactionId)
      transactionStatus = transaction.status ?? null
    } catch (e) {
      if (!(e instanceof PayoutBrError)) throw e
      return { ...baseResult, status: 'pending' as const, transactionStatus: null }
    }

    if (isPayoutBrPaidStatus(transactionStatus)) {
      if (order.status === 'pending') {
        await confirmCheckoutPayment({
          orderId: order.id,
          paymentMethod: 'credit_card',
          payoutTransactionId,
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

    if (isPayoutBrFailedStatus(transactionStatus) && order.status === 'pending') {
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

export { VenoError, PayoutBrError }
