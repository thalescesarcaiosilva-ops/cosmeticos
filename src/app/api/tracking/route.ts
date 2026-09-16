import { jsonError, jsonSuccess } from '@/lib/api/response'
import { Track7Error } from '@/lib/track7/client'
import {
  looksLikeOrderId,
  resolvePublicTracking,
} from '@/lib/track7/resolve-tracking'
import { trackingLookupSchema } from '@/schemas/tracking-schema'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawCode =
    searchParams.get('codigo') ??
    searchParams.get('code') ??
    searchParams.get('pedido') ??
    searchParams.get('order') ??
    ''

  const explicitOrder =
    searchParams.get('pedido') ?? searchParams.get('order') ?? ''
  const explicitCode =
    searchParams.get('codigo') ?? searchParams.get('code') ?? ''

  const parsed = trackingLookupSchema.safeParse({
    code: explicitCode || (explicitOrder ? '' : rawCode),
    order: explicitOrder || (looksLikeOrderId(rawCode) ? rawCode : ''),
  })

  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? 'Informe um código de rastreio válido',
      400
    )
  }

  const code = parsed.data.code?.trim() || null
  const orderId = parsed.data.order?.trim() || null

  if (!code && !orderId) {
    return jsonError('Informe um código de rastreio válido', 400)
  }

  // Consulta só por código Track7 (sem pedido local) exige env configurada
  // quando não houver match local — resolvePublicTracking trata o fallback.

  try {
    const tracking = await resolvePublicTracking({ code, orderId })
    if (!tracking) {
      return jsonError(
        'Pedido não encontrado. Confira o código ou aguarde a postagem.',
        404,
        'NOT_FOUND'
      )
    }

    return jsonSuccess({
      ...tracking,
      has_events: tracking.hasEvents ?? tracking.events.length > 0,
    })
  } catch (error) {
    if (error instanceof Track7Error) {
      const status =
        error.code === 'CONFIG'
          ? 503
          : error.status >= 400
            ? error.status
            : 502
      return jsonError(error.message, status, error.code)
    }
    console.error('[api/tracking]', error)
    return jsonError(
      'O serviço de rastreio demorou para responder. Tente novamente em instantes.',
      502,
      'UPSTREAM'
    )
  }
}
