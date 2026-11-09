import { revalidatePath } from 'next/cache'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import {
  cancelCheckoutOrder,
  confirmCheckoutPayment,
  findOrderById,
  findOrderByPayoutSecureId,
  findOrderByPayoutTransactionId,
  recordWebhookEvent,
} from '@/lib/checkout/create-order'
import {
  getPayoutBrTransaction,
  isPayoutBrFailedStatus,
  isPayoutBrPaidStatus,
  PayoutBrError,
} from '@/lib/payoutbr/client'

type PayoutBrPostback = {
  id?: number | string
  type?: string
  objectId?: string
  data?: {
    id?: number | string
    status?: string
    secureId?: string | null
    metadata?: string | null
    paymentMethod?: string | null
    paidAt?: string | null
    transaction?: {
      id?: number | string
      status?: string
      secureId?: string | null
      metadata?: string | null
      paidAt?: string | null
    } | null
  }
}

function toPositiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

async function resolveOrder(payload: PayoutBrPostback) {
  const data = payload.data
  if (!data) return null

  const transaction = data.transaction ?? data
  const metadata =
    typeof transaction.metadata === 'string'
      ? transaction.metadata.trim()
      : typeof data.metadata === 'string'
        ? data.metadata.trim()
        : ''

  if (metadata) {
    const byMeta = await findOrderById(metadata)
    if (byMeta) return byMeta
  }

  const transactionId = toPositiveInt(transaction.id)
  if (transactionId) {
    const byTx = await findOrderByPayoutTransactionId(transactionId)
    if (byTx) return byTx
  }

  const secureId =
    (typeof transaction.secureId === 'string' && transaction.secureId.trim()) ||
    (typeof data.secureId === 'string' && data.secureId.trim()) ||
    ''
  if (secureId) {
    const bySecure = await findOrderByPayoutSecureId(secureId)
    if (bySecure) return bySecure
  }

  return null
}

export async function POST(request: Request) {
  let payload: PayoutBrPostback
  try {
    payload = (await request.json()) as PayoutBrPostback
  } catch {
    return jsonError('Payload inválido', 400)
  }

  const type = payload.type?.trim().toLowerCase() ?? ''
  if (type && type !== 'transaction' && type !== 'checkout') {
    return jsonSuccess({ ok: true, skipped: true })
  }

  const data = payload.data
  if (!data || typeof data !== 'object') {
    return jsonSuccess({ ok: true, skipped: true })
  }

  const order = await resolveOrder(payload)
  if (!order) {
    return jsonError('Pedido não encontrado', 404)
  }

  const nested = data.transaction ?? data
  const transactionId =
    toPositiveInt(nested.id) ??
    (typeof order.payout_transaction_id === 'number'
      ? order.payout_transaction_id
      : Number(order.payout_transaction_id))

  let status = typeof nested.status === 'string' ? nested.status.trim().toLowerCase() : ''

  if (Number.isFinite(transactionId) && transactionId > 0) {
    try {
      const remote = await getPayoutBrTransaction(transactionId)
      if (remote.status) status = remote.status.toLowerCase()
    } catch (e) {
      if (!(e instanceof PayoutBrError)) throw e
    }
  }

  const eventId = `payoutbr:${transactionId || order.id}:${status}:${nested.paidAt ?? data.paidAt ?? ''}:${payload.id ?? ''}`
  const recorded = await recordWebhookEvent({
    eventId,
    orderId: order.id,
    payload,
  }).catch(() => true)

  if (!recorded) {
    return jsonSuccess({ ok: true, orderId: order.id, status: 'duplicate' })
  }

  if (isPayoutBrPaidStatus(status)) {
    await confirmCheckoutPayment({
      orderId: order.id,
      paymentMethod: 'credit_card',
      payoutTransactionId: Number.isFinite(transactionId) ? transactionId : null,
    })
    revalidatePath('/conta/pedidos')
    revalidatePath(`/pedido/${order.id}/obrigado`)
    return jsonSuccess({ ok: true, orderId: order.id, status: 'confirmed' })
  }

  if (isPayoutBrFailedStatus(status) && order.status === 'pending') {
    await cancelCheckoutOrder(order.id)
    revalidatePath('/conta/pedidos')
    return jsonSuccess({ ok: true, orderId: order.id, status: 'cancelled' })
  }

  return jsonSuccess({ ok: true, orderId: order.id, status: 'ignored' })
}
