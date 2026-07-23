import { getSiteUrl } from '@/lib/seo/site-url'

export type PayoutComplianceMetadata = {
  provider: 'CustomCheckout'
  user_email: string
  order_id: string
  checkout_url: string
  shop_url: string
}

/** Monta o metadata de compliance como string JSON (exigência da API Payout). */
export function buildPayoutComplianceMetadata(params: {
  userEmail: string
  orderId: string
  shopUrl?: string | null
}): string {
  const shopUrl = (params.shopUrl ?? getSiteUrl())?.replace(/\/+$/, '')
  if (!shopUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL não configurada')
  }

  const metadata: PayoutComplianceMetadata = {
    provider: 'CustomCheckout',
    user_email: params.userEmail.trim(),
    order_id: params.orderId,
    checkout_url: `${shopUrl}/checkout`,
    shop_url: shopUrl,
  }

  return JSON.stringify(metadata)
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Extrai o order_id do metadata da Payout.
 * Suporta o formato legado (UUID puro) e o JSON de compliance (`order_id`).
 */
export function parseOrderIdFromPayoutMetadata(metadata: string | null | undefined): string | null {
  if (!metadata) return null
  const trimmed = metadata.trim()
  if (!trimmed) return null

  if (UUID_PATTERN.test(trimmed)) return trimmed

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      'order_id' in parsed &&
      typeof (parsed as { order_id: unknown }).order_id === 'string'
    ) {
      const orderId = (parsed as { order_id: string }).order_id.trim()
      if (orderId && UUID_PATTERN.test(orderId)) return orderId
    }
  } catch {
    // metadata não é JSON válido
  }

  return null
}

/**
 * IP real do comprador a partir dos headers da requisição.
 * Retorna null se não for confiável (não envia "unknown" à Payout).
 */
export function getBuyerIpFromRequest(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const candidate =
    forwarded?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    null

  if (!candidate) return null

  const lowered = candidate.toLowerCase()
  if (
    lowered === 'unknown' ||
    lowered === 'undefined' ||
    lowered === 'null' ||
    lowered === '::' ||
    lowered === '0.0.0.0'
  ) {
    return null
  }

  return candidate
}
