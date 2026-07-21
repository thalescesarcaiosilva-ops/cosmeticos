import { createAdminClient } from '@/lib/supabase/admin'

const PAID_STATUSES = ['confirmed', 'shipped', 'delivered'] as const

export type ProductSalesRow = {
  productId: string
  name: string
  slug: string
  unitsSold: number
  revenue: number
  orderCount: number
}

export type RecentOrderRow = {
  id: string
  status: string
  payment_status?: string | null
  payment_method?: string | null
  total: number
  created_at: string
  shipping_method_name?: string | null
  customer_name?: string | null
  profiles?: { name?: string } | null
}

export type LowStockRow = {
  id: string
  name: string
  stock: number
  slug: string
}

export type DashboardAnalytics = {
  paymentColumnsAvailable: boolean
  productsActive: number
  categoriesCount: number
  totalOrders: number
  pendingOrders: number
  paidOrders: number
  cancelledOrders: number
  confirmedOrders: number
  pixOrders: number
  cardOrders: number
  otherPaymentOrders: number
  pixRevenue: number
  cardRevenue: number
  confirmedRevenue: number
  averageTicket: number
  totalUnitsSold: number
  shippingRevenue: number
  discountTotal: number
  statusBreakdown: { status: string; count: number }[]
  topProducts: ProductSalesRow[]
  productSales: ProductSalesRow[]
  recentOrders: RecentOrderRow[]
  lowStock: LowStockRow[]
}

type OrderAnalyticsRow = {
  id: string
  status: string
  payment_status?: string | null
  payment_method?: string | null
  total: number | null
  shipping_price?: number | null
  discount_amount?: number | null
}

type OrderItemRow = {
  product_id: string | null
  quantity: number | null
  unit_price: number | null
  subtotal: number | null
  order_id: string
  products?: { name?: string | null; slug?: string | null } | null
}

function isSoldOrder(order: OrderAnalyticsRow, paymentColumnsAvailable: boolean): boolean {
  if (!PAID_STATUSES.includes(order.status as (typeof PAID_STATUSES)[number])) return false
  if (!paymentColumnsAvailable) return true
  return order.payment_status === 'paid'
}

function aggregateProductSales(
  items: OrderItemRow[],
  soldOrderIds: Set<string>
): ProductSalesRow[] {
  const map = new Map<
    string,
    ProductSalesRow & { orderIds: Set<string> }
  >()

  for (const item of items) {
    if (!soldOrderIds.has(item.order_id) || !item.product_id) continue

    const qty = Number(item.quantity ?? 0)
    const lineRevenue =
      item.subtotal != null
        ? Number(item.subtotal)
        : qty * Number(item.unit_price ?? 0)

    const existing = map.get(item.product_id)
    if (existing) {
      existing.unitsSold += qty
      existing.revenue += lineRevenue
      existing.orderIds.add(item.order_id)
    } else {
      map.set(item.product_id, {
        productId: item.product_id,
        name: item.products?.name?.trim() || 'Produto removido',
        slug: item.products?.slug ?? '',
        unitsSold: qty,
        revenue: lineRevenue,
        orderCount: 0,
        orderIds: new Set([item.order_id]),
      })
    }
  }

  return Array.from(map.values())
    .map(({ orderIds, ...row }) => ({
      ...row,
      orderCount: orderIds.size,
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  const admin = createAdminClient()

  const [products, categories, pendingOrders, cancelledOrders, lowStock] =
    await Promise.all([
      admin.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
      admin.from('categories').select('id', { count: 'exact', head: true }),
      admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'cancelled'),
      admin
        .from('products')
        .select('id, name, stock, slug')
        .eq('active', true)
        .lte('stock', 3)
        .order('stock', { ascending: true })
        .limit(8),
    ])

  let paymentColumnsAvailable = true

  const ordersExtended = await admin
    .from('orders')
    .select(
      'id, status, payment_status, payment_method, total, shipping_price, discount_amount, created_at, shipping_method_name, customer_name, profiles(name)'
    )
    .order('created_at', { ascending: false })

  let ordersData: OrderAnalyticsRow[] = []
  let recentOrders: RecentOrderRow[] = []

  if (ordersExtended.error) {
    const withoutOptional = await admin
      .from('orders')
      .select(
        'id, status, payment_status, payment_method, total, shipping_price, created_at, shipping_method_name, profiles(name)'
      )
      .order('created_at', { ascending: false })

    if (withoutOptional.error) {
      paymentColumnsAvailable = false
      const legacy = await admin
        .from('orders')
        .select('id, status, total, shipping_price, created_at, shipping_method_name')
        .order('created_at', { ascending: false })

      ordersData = (legacy.data ?? []) as OrderAnalyticsRow[]
      recentOrders = ordersData.slice(0, 8) as RecentOrderRow[]
    } else {
      const rows = (withoutOptional.data ?? []) as (OrderAnalyticsRow & RecentOrderRow)[]
      ordersData = rows
      recentOrders = rows.slice(0, 8)
    }
  } else {
    const rows = (ordersExtended.data ?? []) as (OrderAnalyticsRow & RecentOrderRow)[]
    ordersData = rows
    recentOrders = rows.slice(0, 8)
  }

  const soldOrders = ordersData.filter((o) => isSoldOrder(o, paymentColumnsAvailable))
  const soldOrderIds = new Set(soldOrders.map((o) => o.id))

  const confirmedRevenue = soldOrders.reduce(
    (sum, o) => sum + Number(o.total ?? 0),
    0
  )
  const shippingRevenue = soldOrders.reduce(
    (sum, o) => sum + Number(o.shipping_price ?? 0),
    0
  )
  const discountTotal = soldOrders.reduce(
    (sum, o) => sum + Number(o.discount_amount ?? 0),
    0
  )

  const pixOrdersList = ordersData.filter((o) => o.payment_method === 'pix')
  const cardOrdersList = ordersData.filter((o) => o.payment_method === 'credit_card')
  const otherPaymentOrders = ordersData.filter(
    (o) =>
      o.payment_method &&
      o.payment_method !== 'pix' &&
      o.payment_method !== 'credit_card'
  ).length

  const pixRevenue = pixOrdersList
    .filter((o) => isSoldOrder(o, paymentColumnsAvailable))
    .reduce((sum, o) => sum + Number(o.total ?? 0), 0)
  const cardRevenue = cardOrdersList
    .filter((o) => isSoldOrder(o, paymentColumnsAvailable))
    .reduce((sum, o) => sum + Number(o.total ?? 0), 0)

  const paidOrders = paymentColumnsAvailable
    ? ordersData.filter((o) => o.payment_status === 'paid').length
    : soldOrders.length

  const statusCounts = new Map<string, number>()
  for (const order of ordersData) {
    statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1)
  }

  const statusBreakdown = Array.from(statusCounts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)

  let productSales: ProductSalesRow[] = []
  let totalUnitsSold = 0

  if (soldOrderIds.size > 0) {
    const orderIdList = Array.from(soldOrderIds)
    const itemRows: OrderItemRow[] = []
    const chunkSize = 100

    for (let i = 0; i < orderIdList.length; i += chunkSize) {
      const chunk = orderIdList.slice(i, i + chunkSize)
      const itemsResult = await admin
        .from('order_items')
        .select('product_id, quantity, unit_price, subtotal, order_id, products(name, slug)')
        .in('order_id', chunk)

      if (!itemsResult.error && itemsResult.data) {
        itemRows.push(...(itemsResult.data as OrderItemRow[]))
      }
    }

    productSales = aggregateProductSales(itemRows, soldOrderIds)
    totalUnitsSold = productSales.reduce((sum, row) => sum + row.unitsSold, 0)
  }

  return {
    paymentColumnsAvailable,
    productsActive: products.count ?? 0,
    categoriesCount: categories.count ?? 0,
    totalOrders: ordersData.length,
    pendingOrders: pendingOrders.count ?? 0,
    paidOrders,
    cancelledOrders: cancelledOrders.count ?? 0,
    confirmedOrders: soldOrders.length,
    pixOrders: pixOrdersList.length,
    cardOrders: cardOrdersList.length,
    otherPaymentOrders,
    pixRevenue,
    cardRevenue,
    confirmedRevenue,
    averageTicket:
      soldOrders.length > 0 ? confirmedRevenue / soldOrders.length : 0,
    totalUnitsSold,
    shippingRevenue,
    discountTotal,
    statusBreakdown,
    topProducts: productSales.slice(0, 10),
    productSales,
    recentOrders,
    lowStock: (lowStock.data ?? []) as LowStockRow[],
  }
}
