import { revalidatePath } from 'next/cache'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { getAllowPayWebhookSecret, isAllowPayFailedStatus, isAllowPayPaidStatus } from '@/lib/allowpay/client'
import { verifyAllowPaySignature } from '@/lib/allowpay/signature'
import {
  cancelCheckoutOrder,
  confirmCheckoutPayment,
  findOrderByAllowpayTxid,
  recordWebhookEvent,
} from '@/lib/checkout/create-order'

type AllowPayWebhookPayload = {
  event_id?: string
  event?: string
  txid?: string
  status?: string
  amount?: number
  currency?: string
  created_at?: string
}

export async function POST(request: Request) {
  // O HMAC é calculado sobre o corpo BRUTO — não use request.json() antes disso.
  const rawBody = await request.text()

  const secret = getAllowPayWebhookSecret()
  if (secret) {
    const valid = verifyAllowPaySignature({
      rawBody,
      signature: request.headers.get('x-allowpay-signature'),
      secret,
    })
    if (!valid) {
      return jsonError('Assinatura inválida', 401)
    }
  }

  let payload: AllowPayWebhookPayload
  try {
    payload = JSON.parse(rawBody) as AllowPayWebhookPayload
  } catch {
    return jsonError('Payload inválido', 400)
  }

  const txid = payload.txid?.trim()
  const status = payload.status?.trim().toLowerCase()

  if (!txid || !status) {
    return jsonSuccess({ ok: true, skipped: true })
  }

  const order = await findOrderByAllowpayTxid(txid)
  if (!order) {
    // 404 faz a AllowPay reenviar — cobre a janela entre criar o Pix e gravar o txid.
    return jsonError('Pedido não encontrado para este txid', 404)
  }

  const recorded = await recordWebhookEvent({
    eventId: payload.event_id?.trim() || `${txid}:${status}`,
    orderId: order.id,
    payload,
  }).catch(() => true)

  if (!recorded) {
    return jsonSuccess({ ok: true, orderId: order.id, status: 'duplicate' })
  }

  if (isAllowPayPaidStatus(status)) {
    await confirmCheckoutPayment({ orderId: order.id, paymentMethod: 'pix' })
    revalidatePath('/conta/pedidos')
    revalidatePath(`/pedido/${order.id}/obrigado`)
    return jsonSuccess({ ok: true, orderId: order.id, status: 'confirmed' })
  }

  if (isAllowPayFailedStatus(status)) {
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
