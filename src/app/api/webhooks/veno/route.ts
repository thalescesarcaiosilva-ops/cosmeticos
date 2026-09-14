import { revalidatePath } from 'next/cache'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import {
  cancelCheckoutOrder,
  confirmCheckoutPayment,
  findOrderByAllowpayTxid,
  findOrderById,
  findOrderByVenoDepositId,
  recordWebhookEvent,
} from '@/lib/checkout/create-order'
import {
  getVenoPixStatus,
  isVenoFailedStatus,
  isVenoPaidStatus,
  VenoError,
} from '@/lib/veno/client'

type VenoWebhookPayload = {
  event?: string
  data?: {
    id?: string
    txid?: string
    external_id?: string
    status?: string
    amount?: number
    paid_at?: string
  }
}

async function resolveOrder(data: NonNullable<VenoWebhookPayload['data']>) {
  if (data.external_id) {
    const byExternal = await findOrderById(data.external_id)
    if (byExternal) return byExternal
  }
  if (data.id) {
    const byDeposit = await findOrderByVenoDepositId(data.id)
    if (byDeposit) return byDeposit
  }
  if (data.txid) {
    const byTxid = await findOrderByAllowpayTxid(data.txid)
    if (byTxid) return byTxid
  }
  return null
}

export async function POST(request: Request) {
  let payload: VenoWebhookPayload
  try {
    payload = (await request.json()) as VenoWebhookPayload
  } catch {
    return jsonError('Payload inválido', 400)
  }

  const event = payload.event?.trim().toLowerCase() ?? ''
  const data = payload.data
  if (!data || typeof data !== 'object') {
    return jsonSuccess({ ok: true, skipped: true })
  }

  const order = await resolveOrder(data)
  if (!order) {
    // 404 faz a Veno retentar (até 3x) — cobre janela entre criar Pix e gravar o id.
    return jsonError('Pedido não encontrado', 404)
  }

  let status = data.status?.trim().toLowerCase() ?? ''

  // Sem HMAC na doc: confere na API quando temos deposit id.
  const depositId = order.veno_deposit_id || data.id
  if (depositId && (event === 'deposit.paid' || status === 'paid' || !status)) {
    try {
      const remote = await getVenoPixStatus(depositId)
      if (remote.status) status = remote.status.toLowerCase()
    } catch (e) {
      if (!(e instanceof VenoError)) throw e
      // Segue com o status do webhook se a consulta falhar
    }
  }

  if (!status && event.startsWith('deposit.')) {
    status = event.replace(/^deposit\./, '')
  }

  const eventId =
    `${depositId || data.txid || order.id}:${event || status}:${data.paid_at ?? ''}`

  const recorded = await recordWebhookEvent({
    eventId,
    orderId: order.id,
    payload,
  }).catch(() => true)

  if (!recorded) {
    return jsonSuccess({ ok: true, orderId: order.id, status: 'duplicate' })
  }

  if (isVenoPaidStatus(status) || event === 'deposit.paid') {
    // Reconfirma na API se ainda não temos certeza
    if (!isVenoPaidStatus(status) && depositId) {
      try {
        const remote = await getVenoPixStatus(depositId)
        if (!isVenoPaidStatus(remote.status)) {
          return jsonSuccess({ ok: true, orderId: order.id, status: 'ignored' })
        }
      } catch {
        return jsonSuccess({ ok: true, orderId: order.id, status: 'ignored' })
      }
    }

    await confirmCheckoutPayment({
      orderId: order.id,
      paymentMethod: 'pix',
    })
    revalidatePath('/conta/pedidos')
    revalidatePath(`/pedido/${order.id}/obrigado`)
    return jsonSuccess({ ok: true, orderId: order.id, status: 'confirmed' })
  }

  if (
    isVenoFailedStatus(status) ||
    event === 'deposit.expired' ||
    event === 'deposit.cancelled'
  ) {
    if (order.status === 'pending') {
      await cancelCheckoutOrder(order.id)
    }
    revalidatePath('/conta/pedidos')
    return jsonSuccess({ ok: true, orderId: order.id, status: 'cancelled' })
  }

  return jsonSuccess({ ok: true, orderId: order.id, status: 'ignored' })
}
