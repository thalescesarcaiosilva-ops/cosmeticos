import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireSupportReader } from '@/lib/auth/require-support'
import { parseSupportQueuePeriod } from '@/lib/support/eligibility'
import { listSupportQueue, setSupportMessageSent } from '@/lib/support/queue'
import { z } from 'zod'

const messageSentSchema = z.object({
  orderId: z.string().uuid(),
  sent: z.boolean(),
})

export async function GET(request: Request) {
  try {
    await requireSupportReader()
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
    }
    return jsonError('Acesso negado', 403, 'FORBIDDEN')
  }

  const { searchParams } = new URL(request.url)
  const period = parseSupportQueuePeriod(searchParams.get('period'))
  const search = (searchParams.get('q') ?? '').slice(0, 120)

  try {
    const payload = await listSupportQueue({ period, search })
    return jsonSuccess(payload)
  } catch {
    return jsonError('Não foi possível carregar a fila', 500)
  }
}

export async function PATCH(request: Request) {
  let reader: Awaited<ReturnType<typeof requireSupportReader>>
  try {
    reader = await requireSupportReader()
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

  const parsed = messageSentSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  try {
    const result = await setSupportMessageSent({
      orderId: parsed.data.orderId,
      sent: parsed.data.sent,
      userId: reader.id,
    })
    if (!result) {
      return jsonError('Pedido fora da fila', 404)
    }
    return jsonSuccess(result)
  } catch {
    return jsonError('Não foi possível atualizar o contato', 500)
  }
}
