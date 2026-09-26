/** Pedido só entra na fila depois deste tempo, mesmo se o pagamento ainda estiver em andamento. */
export const SUPPORT_QUEUE_MIN_AGE_MS = 15 * 60 * 1000

export const SUPPORT_QUEUE_EXCLUDED_STATUSES = ['confirmed', 'shipped', 'delivered'] as const
export const SUPPORT_QUEUE_EXCLUDED_PAYMENTS = ['paid', 'refunded'] as const

export type SupportQueuePeriod = '24h' | '7d' | '30d' | 'all'

const PERIOD_MS: Record<Exclude<SupportQueuePeriod, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

export function parseSupportQueuePeriod(value: string | null): SupportQueuePeriod {
  if (value === '7d' || value === '30d' || value === 'all' || value === '24h') return value
  return '24h'
}

export function supportQueueCutoffIso(now = Date.now()): string {
  return new Date(now - SUPPORT_QUEUE_MIN_AGE_MS).toISOString()
}

export function supportQueueSinceIso(period: SupportQueuePeriod, now = Date.now()): string | null {
  if (period === 'all') return null
  return new Date(now - PERIOD_MS[period]).toISOString()
}

export function isSupportQueueEligible(
  order: { status: string; payment_status: string; created_at: string },
  now = Date.now()
): boolean {
  const created = new Date(order.created_at).getTime()
  if (!Number.isFinite(created)) return false
  if (now - created < SUPPORT_QUEUE_MIN_AGE_MS) return false
  if ((SUPPORT_QUEUE_EXCLUDED_PAYMENTS as readonly string[]).includes(order.payment_status)) {
    return false
  }
  if ((SUPPORT_QUEUE_EXCLUDED_STATUSES as readonly string[]).includes(order.status)) {
    return false
  }
  return true
}

export function matchesSupportQueuePeriod(
  createdAt: string,
  period: SupportQueuePeriod,
  now = Date.now()
): boolean {
  if (period === 'all') return true
  const created = new Date(createdAt).getTime()
  if (!Number.isFinite(created)) return false
  return now - created <= PERIOD_MS[period]
}
