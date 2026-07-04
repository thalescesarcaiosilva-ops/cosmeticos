import { revalidatePath } from 'next/cache'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import {
  cancelCheckoutOrder,
  confirmCheckoutPayment,
  findOrderById,
  findOrderByPayoutCheckoutId,
  findOrderByPayoutSecureId,
  findOrderByPayoutTransactionId,
  recordWebhookEvent,
} from '@/lib/checkout/create-order'
import { isFailedStatus, isPaidStatus } from '@/lib/payout/pix-qrcode'

type PayoutPostback = {
  id?: number | string
  type?: string
  objectId?: string
  data?: {
    id?: number
    secureId?: string
    status?: string
    paymentMethod?: string
    externalRef?: string
    metadata?: string
    transaction?: {
      id?: number
      status?: string
      paymentMethod?: string
      secureId?: string
      externalRef?: string
      metadata?: string
    } | null
  }
}

function readTransactionStatus(payload: PayoutPostback): {
  status: string | null
  paymentMethod: string | null
  transactionId: number | null
  checkoutId: number | null
  secureId: string | null
  externalRef: string | null
  metadata: string | null
  eventId: string | null
} {
  const data = payload.data
  const tx = data?.transaction

  if (payload.type === 'checkout' && tx) {
    return {
      status: tx.status ?? null,
      paymentMethod: tx.paymentMethod ?? null,
      transactionId: tx.id ?? null,
      checkoutId: data?.id ?? null,
      secureId: data?.secureId ?? tx.secureId ?? null,
      externalRef: tx.externalRef ?? data?.externalRef ?? null,
      metadata: tx.metadata ?? data?.metadata ?? null,
      eventId: payload.id != null ? String(payload.id) : null,
    }
  }

  if (payload.type === 'transaction' && data) {
    return {
      status: data.status ?? null,
      paymentMethod: data.paymentMethod ?? null,
      transactionId: data.id ?? null,
      checkoutId: null,
      secureId: data.secureId ?? null,
      externalRef: data.externalRef ?? null,
      metadata: data.metadata ?? null,
      eventId: payload.id != null ? String(payload.id) : null,
    }
  }

  return {
    status: data?.status ?? null,
    paymentMethod: data?.paymentMethod ?? null,
    transactionId: data?.id ?? null,
    checkoutId: data?.id ?? null,
    secureId: data?.secureId ?? null,
    externalRef: data?.externalRef ?? null,
    metadata: data?.metadata ?? null,
    eventId: payload.id != null ? String(payload.id) : null,
  }
}

function resolveOrderId(params: {
  externalRef: string | null
  metadata: string | null
  transactionId: number | null
}): string | null {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  if (params.externalRef && uuidPattern.test(params.externalRef)) return params.externalRef
  if (params.metadata && uuidPattern.test(params.metadata)) return params.metadata
  return null
}

export async function POST(request: Request) {
  let payload: PayoutPostback
  try {
    payload = (await request.json()) as PayoutPostback
  } catch {
    return jsonError('Payload inválido', 400)
  }

  const {
    status,
    paymentMethod,
    transactionId,
    checkoutId,
    secureId,
    externalRef,
    metadata,
    eventId,
  } = readTransactionStatus(payload)

  if (!status) {
    return jsonSuccess({ ok: true, skipped: true })
  }

  const orderIdFromPayload = resolveOrderId({ externalRef, metadata, transactionId })

  let order =
    (orderIdFromPayload ? await findOrderById(orderIdFromPayload) : null) ??
    (transactionId != null ? await findOrderByPayoutTransactionId(transactionId) : null) ??
    (checkoutId != null ? await findOrderByPayoutCheckoutId(checkoutId) : null) ??
    (secureId ? await findOrderByPayoutSecureId(secureId) : null)

  if (!order) {
    return jsonSuccess({ ok: true, order: null })
  }

  const dedupeKey =
    eventId ??
    `${transactionId ?? checkoutId ?? secureId ?? order.id}:${status.toLowerCase()}`

  const recorded = await recordWebhookEvent({
    eventId: dedupeKey,
    orderId: order.id,
    payload,
  }).catch(() => true)

  if (!recorded) {
    return jsonSuccess({ ok: true, orderId: order.id, status: 'duplicate' })
  }

  const normalized = status.toLowerCase()

  if (isPaidStatus(normalized)) {
    await confirmCheckoutPayment({
      orderId: order.id,
      paymentMethod,
      transactionId,
    })
    revalidatePath('/conta/pedidos')
    revalidatePath(`/pedido/${order.id}/obrigado`)
    return jsonSuccess({ ok: true, orderId: order.id, status: 'confirmed' })
  }

  if (isFailedStatus(normalized)) {
    if (order.status === 'pending') {
      await cancelCheckoutOrder(order.id)
    }
    revalidatePath('/conta/pedidos')
    return jsonSuccess({ ok: true, orderId: order.id, status: 'cancelled' })
  }

  return jsonSuccess({ ok: true, orderId: order.id, status: 'ignored' })
}

export async function GET() {
  return jsonSuccess({ ok: true })
}
