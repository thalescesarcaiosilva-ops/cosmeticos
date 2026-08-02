import type {
  DashboardOrderItemRow,
  DashboardOrderRow,
  NotFoundPathRow,
  ProductViewRow,
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

export type ShippingMethodStat = {
  name: string
  orders: number
  revenue: number
  share: number
}

export function shippingMethodBreakdown(
  soldOrders: DashboardOrderRow[]
): ShippingMethodStat[] {
  const map = new Map<string, { orders: number; revenue: number }>()
  for (const order of soldOrders) {
    const name = order.shipping_method_name?.trim() || 'Não informado'
    const existing = map.get(name) ?? { orders: 0, revenue: 0 }
    existing.orders += 1
    existing.revenue += order.total
    map.set(name, existing)
  }
  const total = soldOrders.length || 1
  return Array.from(map.entries())
    .map(([name, stat]) => ({
      name,
      orders: stat.orders,
      revenue: stat.revenue,
      share: (stat.orders / total) * 100,
    }))
    .sort((a, b) => b.orders - a.orders)
}

export type FunnelStep = {
  key: string
  label: string
  count: number
}

export function buildOrderFunnel(
  orders: DashboardOrderRow[],
  paymentColumnsAvailable: boolean
): FunnelStep[] {
  const created = orders.length
  const paid = orders.filter((o) => isSoldOrder(o, paymentColumnsAvailable)).length
  const shipped = orders.filter((o) => o.status === 'shipped' || o.status === 'delivered').length
  const delivered = orders.filter((o) => o.status === 'delivered').length
  return [
    { key: 'created', label: 'Pedidos criados', count: created },
    { key: 'paid', label: 'Pagos', count: paid },
    { key: 'shipped', label: 'Enviados', count: shipped },
    { key: 'delivered', label: 'Entregues', count: delivered },
  ]
}

export type KitSuggestion = {
  productAId: string
  productAName: string
  productASlug: string
  productBId: string
  productBName: string
  productBSlug: string
  togetherCount: number
}

export function suggestKitsFromOrders(
  items: DashboardOrderItemRow[],
  soldOrderIds: Set<string>,
  limit = 8
): KitSuggestion[] {
  const byOrder = new Map<string, DashboardOrderItemRow[]>()
  for (const item of items) {
    if (!soldOrderIds.has(item.orderId)) continue
    const list = byOrder.get(item.orderId) ?? []
    list.push(item)
    byOrder.set(item.orderId, list)
  }

  const pairMap = new Map<string, KitSuggestion & { orderIds: Set<string> }>()

  for (const [orderId, orderItems] of byOrder) {
    const unique = new Map<string, DashboardOrderItemRow>()
    for (const item of orderItems) unique.set(item.productId, item)
    const products = Array.from(unique.values())
    if (products.length < 2) continue

    for (let i = 0; i < products.length; i++) {
      for (let j = i + 1; j < products.length; j++) {
        const a = products[i]
        const b = products[j]
        const [left, right] = a.productId < b.productId ? [a, b] : [b, a]
        const key = `${left.productId}::${right.productId}`
        const existing = pairMap.get(key)
        if (existing) {
          existing.orderIds.add(orderId)
        } else {
          pairMap.set(key, {
            productAId: left.productId,
            productAName: left.productName,
            productASlug: left.productSlug,
            productBId: right.productId,
            productBName: right.productName,
            productBSlug: right.productSlug,
            togetherCount: 0,
            orderIds: new Set([orderId]),
          })
        }
      }
    }
  }

  return Array.from(pairMap.values())
    .map(({ orderIds, ...row }) => ({ ...row, togetherCount: orderIds.size }))
    .filter((row) => row.togetherCount >= 2)
    .sort((a, b) => b.togetherCount - a.togetherCount)
    .slice(0, limit)
}

export type OpportunityRow = {
  productId: string
  name: string
  slug: string
  views: number
  unitsSold: number
  conversion: number
}

export function highViewLowConversion(
  views: ProductViewRow[],
  sales: ProductSalesRow[],
  range: DateRange,
  limit = 8
): OpportunityRow[] {
  const viewsByProduct = new Map<string, { views: number; name: string; slug: string }>()

  for (const row of views) {
    const dayDate = new Date(`${row.day}T12:00:00`)
    if (range.from && dayDate < range.from) continue
    if (range.to && dayDate > range.to) continue
    const existing = viewsByProduct.get(row.productId)
    if (existing) {
      existing.views += row.views
    } else {
      viewsByProduct.set(row.productId, {
        views: row.views,
        name: row.productName,
        slug: row.productSlug,
      })
    }
  }

  const salesMap = new Map(sales.map((s) => [s.productId, s]))

  return Array.from(viewsByProduct.entries())
    .map(([productId, meta]) => {
      const sold = salesMap.get(productId)
      const unitsSold = sold?.unitsSold ?? 0
      return {
        productId,
        name: meta.name,
        slug: meta.slug,
        views: meta.views,
        unitsSold,
        conversion: meta.views > 0 ? (unitsSold / meta.views) * 100 : 0,
      }
    })
    .filter((row) => row.views >= 5)
    .sort((a, b) => a.conversion - b.conversion || b.views - a.views)
    .slice(0, limit)
}

export function filterNotFoundPaths(
  rows: NotFoundPathRow[],
  range: DateRange
): NotFoundPathRow[] {
  if (!range.from && !range.to) return rows
  return rows.filter((row) => inRange(row.lastSeenAt, range))
}
