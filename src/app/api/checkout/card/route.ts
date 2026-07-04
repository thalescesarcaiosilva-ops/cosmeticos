import { revalidatePath } from 'next/cache'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { getOptionalSessionUserId } from '@/lib/checkout/order-access'
import { CheckoutError } from '@/lib/checkout/create-order'
import { processCardCheckout } from '@/lib/checkout/process-payment'
import { checkoutCardSchema } from '@/schemas/checkout-payment-schema'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = checkoutCardSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos — verifique CPF, e-mail e cartão', 400)
  }

  const {
    shipping_method_id,
    items,
    document,
    customer,
    shipping_address,
    card_hash,
    installments,
  } = parsed.data

  const userId = await getOptionalSessionUserId()

  try {
    const result = await processCardCheckout({
      shippingMethodId: shipping_method_id,
      items,
      document,
      customer,
      shippingAddress: shipping_address,
      userId,
      cardHash: card_hash,
      installments,
    })

    revalidatePath('/conta/pedidos')
    revalidatePath(`/pedido/${result.orderId}/obrigado`)

    return jsonSuccess(result, result.paid ? 'Pagamento confirmado' : 'Pagamento em processamento')
  } catch (e) {
    if (e instanceof CheckoutError) {
      return jsonError(e.message, 400, e.code)
    }
    if (e instanceof Error) {
      const msg = e.message.toLowerCase()
      if (msg.includes('recus') || msg.includes('refus') || msg.includes('negad')) {
        return jsonError('Pagamento recusado. Verifique os dados do cartão.', 402, 'CARD_REFUSED')
      }
    }
    if (e instanceof Error && e.message.includes('PAYOUT')) {
      return jsonError('Pagamento indisponível no momento. Tente novamente.', 503, 'PAYOUT_ERROR')
    }
    return jsonError('Não foi possível processar o cartão', 500)
  }
}
