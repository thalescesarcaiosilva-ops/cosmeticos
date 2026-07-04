import { revalidatePath } from 'next/cache'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { CheckoutError } from '@/lib/checkout/create-order'
import {
  getOptionalSessionUserId,
  readGuestTokenFromRequest,
} from '@/lib/checkout/order-access'
import { getOrderPaymentStatus } from '@/lib/checkout/process-payment'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const userId = await getOptionalSessionUserId()
  const guestToken = readGuestTokenFromRequest(request)

  try {
    const status = await getOrderPaymentStatus({
      orderId: id,
      userId,
      guestToken,
    })

    if (status.status === 'paid') {
      revalidatePath('/conta/pedidos')
      revalidatePath(`/pedido/${id}/obrigado`)
    }

    return jsonSuccess(status)
  } catch (e) {
    if (e instanceof CheckoutError) {
      return jsonError(e.message, 404, e.code)
    }
    return jsonError('Não foi possível consultar o pagamento', 500)
  }
}
