import { jsonError, jsonSuccess } from '@/lib/api/response'
import {
  getOptionalSessionUserId,
  readGuestTokenFromRequest,
} from '@/lib/checkout/order-access'
import {
  PaymentProofError,
  uploadOrderPaymentProof,
} from '@/lib/checkout/payment-proof'
import { paymentProofSourceSchema } from '@/schemas/payment-proof-schema'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const { id: orderId } = await context.params

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return jsonError('Selecione o arquivo do comprovante', 400)
  }

  const messageRaw = formData.get('message')
  const message = typeof messageRaw === 'string' ? messageRaw : null

  const sourceParsed = paymentProofSourceSchema.safeParse(formData.get('source') ?? 'checkout')
  if (!sourceParsed.success) {
    return jsonError('Origem inválida', 400)
  }

  const userId = await getOptionalSessionUserId()
  const guestToken = readGuestTokenFromRequest(request)

  try {
    const proof = await uploadOrderPaymentProof({
      orderId,
      userId,
      guestToken,
      file,
      message,
      source: sourceParsed.data,
    })

    return jsonSuccess(
      { proofId: proof.id, status: proof.status },
      'Comprovante enviado. Nossa equipe irá analisar e confirmar o pagamento.'
    )
  } catch (e) {
    if (e instanceof PaymentProofError) {
      const status =
        e.code === 'FORBIDDEN' || e.code === 'ORDER_NOT_FOUND'
          ? 403
          : e.code === 'ALREADY_PAID'
            ? 409
            : 400
      return jsonError(e.message, status, e.code)
    }
    return jsonError('Não foi possível enviar o comprovante', 500)
  }
}
