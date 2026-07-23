import { jsonError, jsonSuccess } from '@/lib/api/response'
import { getTrackingByCode } from '@/lib/tracking/queries'
import { trackingLookupSchema } from '@/schemas/tracking-schema'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = trackingLookupSchema.safeParse({
    code: searchParams.get('code') ?? searchParams.get('codigo') ?? '',
  })

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Código inválido', 400)
  }

  const tracking = await getTrackingByCode(parsed.data.code)
  if (!tracking) {
    return jsonError('Código de rastreio não encontrado', 404, 'NOT_FOUND')
  }

  return jsonSuccess(tracking)
}
