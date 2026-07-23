import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import {
  listProofsForOrder,
  PaymentProofError,
  reviewPaymentProof,
} from '@/lib/checkout/payment-proof'
import { paymentProofReviewSchema } from '@/schemas/payment-proof-schema'

async function requireAdmin() {
  try {
    return await requireAdminUser()
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
    }
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return jsonError('Acesso negado', 403, 'FORBIDDEN')
    }
    return jsonError('Erro interno', 500)
  }
}

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get('orderId')
  if (!orderId) return jsonError('orderId obrigatório', 400)

  const proofs = await listProofsForOrder(orderId)
  return jsonSuccess(proofs)
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = paymentProofReviewSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  try {
    const result = await reviewPaymentProof({
      proofId: parsed.data.proofId,
      action: parsed.data.action,
      adminUserId: auth.id,
    })

    return jsonSuccess(
      result,
      parsed.data.action === 'approve'
        ? 'Pagamento confirmado. E-mail de confirmação será enviado ao cliente.'
        : 'Comprovante rejeitado'
    )
  } catch (e) {
    if (e instanceof PaymentProofError) {
      return jsonError(e.message, 400, e.code)
    }
    return jsonError('Não foi possível revisar o comprovante', 500)
  }
}
