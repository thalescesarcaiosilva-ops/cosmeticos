import { revalidatePath } from 'next/cache'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { getOptionalSessionUserId } from '@/lib/checkout/order-access'
import { CheckoutError } from '@/lib/checkout/create-order'
import { processPixCheckout } from '@/lib/checkout/process-payment'
import { checkoutPixSchema } from '@/schemas/checkout-payment-schema'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = checkoutPixSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos — verifique CPF, e-mail e endereço', 400)
  }

  const { shipping_method_id, items, document, customer, shipping_address } = parsed.data
  const userId = await getOptionalSessionUserId()

  try {
    const result = await processPixCheckout({
      shippingMethodId: shipping_method_id,
      items,
      document,
      customer,
      shippingAddress: shipping_address,
      userId,
    })

    revalidatePath('/conta/pedidos')

    return jsonSuccess(result, 'Pix gerado — escaneie o QR Code para pagar')
  } catch (e) {
    if (e instanceof CheckoutError) {
      return jsonError(e.message, 400, e.code)
    }
    if (e instanceof Error && e.message.includes('PAYOUT')) {
      return jsonError('Pagamento indisponível no momento. Tente novamente.', 503, 'PAYOUT_ERROR')
    }
    return jsonError('Não foi possível gerar o Pix', 500)
  }
}
