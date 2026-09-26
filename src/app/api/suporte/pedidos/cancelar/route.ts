import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireSupportReader } from '@/lib/auth/require-support'
import { cancelSupportOrder } from '@/lib/support/queue'
import { z } from 'zod'

const cancelSchema = z.object({
  orderId: z.string().uuid(),
})

export async function POST(request: Request) {
  try {
    await requireSupportReader()
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
    }
    return jsonError('Acesso negado', 403, 'FORBIDDEN')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = cancelSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  try {
    const result = await cancelSupportOrder(parsed.data.orderId)
    if (!result) {
      return jsonError('Pedido fora da fila', 404)
    }
    return jsonSuccess(result, 'Pedido cancelado')
  } catch {
    return jsonError('Não foi possível cancelar o pedido', 500)
  }
}
