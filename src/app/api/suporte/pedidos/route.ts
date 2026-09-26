import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireSupportReader } from '@/lib/auth/require-support'
import { parseSupportQueuePeriod } from '@/lib/support/eligibility'
import { listSupportQueue } from '@/lib/support/queue'

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
