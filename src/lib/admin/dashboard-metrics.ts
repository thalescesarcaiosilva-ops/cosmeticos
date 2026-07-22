import type {
  DashboardOrderItemRow,
  DashboardOrderRow,
} from '@/lib/admin/dashboard-analytics'

export type PeriodPreset = '7d' | '30d' | 'custom' | 'all'

export type DateRange = {
  from: Date | null
  to: Date | null
}

const PAID_STATUSES = new Set(['confirmed', 'shipped', 'delivered'])

export type ProductSalesRow = {
  productId: string
  name: string
  slug: string
  unitsSold: number
  revenue: number
  orderCount: number
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function daysAgoStart(days: number, now = new Date()): Date {
  const d = startOfDay(now)
  d.setDate(d.getDate() - (days - 1))
  return d
}

export function resolveRange(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string,
  now = new Date()
): DateRange {
  if (preset === '7d') return { from: daysAgoStart(7, now), to: endOfDay(now) }
  if (preset === '30d') return { from: daysAgoStart(30, now), to: endOfDay(now) }
  if (preset === 'custom') {
    const from = customFrom ? startOfDay(new Date(`${customFrom}T00:00:00`)) : null
    const to = customTo ? endOfDay(new Date(`${customTo}T00:00:00`)) : null
    return { from, to }
  }
  return { from: null, to: null }
}

export function inRange(iso: string, range: DateRange): boolean {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  if (range.from && t < range.from.getTime()) return false
  if (range.to && t > range.to.getTime()) return false
  return true
}

export function isSoldOrder(
  order: DashboardOrderRow,
  paymentColumnsAvailable: boolean
): boolean {
  if (!PAID_STATUSES.has(order.status)) return false
  if (!paymentColumnsAvailable) return true
  return order.payment_status === 'paid'
}

export function filterOrders(
  orders: DashboardOrderRow[],
  range: DateRange
): DashboardOrderRow[] {
  return orders.filter((o) => inRange(o.created_at, range))
}

export function aggregateProductSales(
  items: DashboardOrderItemRow[],
  soldOrderIds: Set<string>
): ProductSalesRow[] {
  const map = new Map<string, ProductSalesRow & { orderIds: Set<string> }>()

  for (const item of items) {
    if (!soldOrderIds.has(item.orderId)) continue
    const existing = map.get(item.productId)
    if (existing) {
      existing.unitsSold += item.quantity
      existing.revenue += item.subtotal
      existing.orderIds.add(item.orderId)
    } else {
      map.set(item.productId, {
        productId: item.productId,
        name: item.productName,
        slug: item.productSlug,
        unitsSold: item.quantity,
        revenue: item.subtotal,
        orderCount: 0,
        orderIds: new Set([item.orderId]),
      })
    }
  }

  return Array.from(map.values())
    .map(({ orderIds, ...row }) => ({ ...row, orderCount: orderIds.size }))
    .sort(
      (a, b) =>
        b.orderCount - a.orderCount ||
        b.unitsSold - a.unitsSold ||
        b.revenue - a.revenue
    )
}

export type MethodStats = {
  attempts: number
  paidCount: number
  paidRevenue: number
  pendingVolume: number
  conversion: number
}

export function methodStats(
  orders: DashboardOrderRow[],
  method: 'pix' | 'credit_card',
  paymentColumnsAvailable: boolean
): MethodStats {
  const matched = orders.filter((o) => o.payment_method === method)
  const paid = matched.filter((o) => isSoldOrder(o, paymentColumnsAvailable))
  const pendingVolume = matched
    .filter((o) => o.status === 'pending' || o.payment_status === 'pending')
    .reduce((sum, o) => sum + o.total, 0)

  return {
    attempts: matched.length,
    paidCount: paid.length,
    paidRevenue: paid.reduce((sum, o) => sum + o.total, 0),
    pendingVolume,
    conversion: matched.length > 0 ? (paid.length / matched.length) * 100 : 0,
  }
}

export type DailyRevenuePoint = {
  dateKey: string
  label: string
  revenue: number
}

export function buildDailyRevenue(
  soldOrders: DashboardOrderRow[],
  range: DateRange,
  now = new Date()
): DailyRevenuePoint[] {
  const to = range.to ?? endOfDay(now)
  let from = range.from
  if (!from) {
    if (soldOrders.length === 0) {
      from = daysAgoStart(30, now)
    } else {
      const oldest = soldOrders.reduce(
        (min, o) => Math.min(min, new Date(o.created_at).getTime()),
        Infinity
      )
      from = startOfDay(new Date(oldest))
      const maxSpan = daysAgoStart(60, now)
      if (from < maxSpan) from = maxSpan
    }
  }

  const days: DailyRevenuePoint[] = []
  const cursor = new Date(from)
  while (cursor <= to) {
    const key = toDateKey(cursor)
    days.push({
      dateKey: key,
      label: cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      revenue: 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const index = new Map(days.map((d, i) => [d.dateKey, i]))
  for (const order of soldOrders) {
    const key = toDateKey(new Date(order.created_at))
    const i = index.get(key)
    if (i == null) continue
    days[i].revenue += order.total
  }

  return days
}

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function statusBreakdown(
  orders: DashboardOrderRow[]
): { status: string; count: number }[] {
  const map = new Map<string, number>()
  for (const order of orders) {
    map.set(order.status, (map.get(order.status) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
}
