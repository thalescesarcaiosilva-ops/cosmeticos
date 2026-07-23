import { jsonError, jsonSuccess } from '@/lib/api/response'
import { runTrackingCron } from '@/lib/tracking/advance'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    // Em desenvolvimento permite sem secret; em produção exige CRON_SECRET
    return process.env.NODE_ENV !== 'production'
  }

  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true

  const cronHeader = request.headers.get('x-cron-secret')
  return cronHeader === secret
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
  }

  try {
    const result = await runTrackingCron()
    return jsonSuccess(result, 'Rastreio processado')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro no cron de rastreio'
    return jsonError(message, 500)
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
