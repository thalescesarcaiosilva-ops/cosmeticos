import { revalidatePath } from 'next/cache'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { getOptionalSessionUserId } from '@/lib/checkout/order-access'
import { CheckoutError } from '@/lib/checkout/create-order'
import { processCardCheckout, PayoutBrError } from '@/lib/checkout/process-payment'
import { checkoutCardSchema } from '@/schemas/checkout-payment-schema'

function readClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  const realIp = request.headers.get('x-real-ip')?.trim()
  return realIp || null
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = checkoutCardSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos — verifique cartão, CPF, e-mail e endereço', 400)
  }

  const {
    shipping_method_id,
    items,
    bundle_pairs,
    document,
    customer,
    shipping_address,
    coupon_code,
    card_hash,
    installments,
  } = parsed.data
  const userId = await getOptionalSessionUserId()

  try {
    const result = await processCardCheckout({
      shippingMethodId: shipping_method_id,
      items,
      bundlePairs: bundle_pairs,
      document,
      customer,
      shippingAddress: shipping_address,
      userId,
      couponCode: coupon_code,
      cardHash: card_hash,
      installments,
      clientIp: readClientIp(request),
    })

    revalidatePath('/conta/pedidos')
    if (result.status === 'paid') {
      revalidatePath(`/pedido/${result.orderId}/obrigado`)
    }

    return jsonSuccess(
      result,
      result.status === 'paid' ? 'Pagamento aprovado' : 'Pagamento em análise'
    )
  } catch (e) {
    if (e instanceof CheckoutError) {
      const status =
        e.code === 'CARD_REFUSED' ? 402 : e.code === 'PAYMENT_PROVIDER_ERROR' ? 503 : 400
      return jsonError(e.message, status, e.code)
    }
    if (e instanceof PayoutBrError) {
      // processCardCheckout já mapeia PayoutBrError → CheckoutError; este fallback
      // cobre falhas fora do fluxo (ex.: config) sem vazar detalhe interno.
      return jsonError(
        'Pagamento com cartão indisponível no momento. Tente novamente ou finalize com Pix.',
        503,
        'PAYMENT_PROVIDER_ERROR'
      )
    }
    return jsonError('Não foi possível processar o cartão. Tente outro cartão ou Pix.', 500)
  }
}
