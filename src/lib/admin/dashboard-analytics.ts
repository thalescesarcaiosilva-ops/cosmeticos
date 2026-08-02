import { createAdminClient } from '@/lib/supabase/admin'

export type DashboardOrderRow = {
  id: string
  status: string
  payment_status: string | null
  payment_method: string | null
  total: number
  shipping_price: number
  discount_amount: number
  created_at: string
  customer_name: string | null
  shipping_method_name: string | null
  profile_name: string | null
}

export type DashboardOrderItemRow = {
  orderId: string
  productId: string
  quantity: number
  unitPrice: number
  subtotal: number
  productName: string
  productSlug: string
}

export type LowStockRow = {
  id: string
  name: string
  stock: number
  slug: string
}

export type ProductViewRow = {
  productId: string
  day: string
  views: number
  productName: string
  productSlug: string
}

export type NotFoundPathRow = {
  path: string
  hits: number
  lastSeenAt: string
  sampleReferrer: string | null
}

export type DashboardPayload = {
  paymentColumnsAvailable: boolean
  productsCount: number
  customersCount: number
  categoriesCount: number
  orders: DashboardOrderRow[]
  orderItems: DashboardOrderItemRow[]
  lowStock: LowStockRow[]
  productViews: ProductViewRow[]
  notFoundPaths: NotFoundPathRow[]
}

type RawOrder = {
  id: string
  status: string
  payment_status?: string | null
  payment_method?: string | null
  total?: number | null
  shipping_price?: number | null
  discount_amount?: number | null
  created_at: string
  customer_name?: string | null
  shipping_method_name?: string | null
  profiles?: { name?: string | null } | null
}

type RawItem = {
  order_id: string
  product_id: string | null
  quantity: number | null
  unit_price: number | null
  subtotal: number | null
  products?: { name?: string | null; slug?: string | null } | null
}

function mapOrder(row: RawOrder): DashboardOrderRow {
  const profile = row.profiles
  return {
    id: row.id,
    status: row.status,
    payment_status: row.payment_status ?? null,
    payment_method: row.payment_method ?? null,
    total: Number(row.total ?? 0),
    shipping_price: Number(row.shipping_price ?? 0),
    discount_amount: Number(row.discount_amount ?? 0),
    created_at: row.created_at,
    customer_name: row.customer_name ?? null,
    shipping_method_name: row.shipping_method_name ?? null,
    profile_name: profile?.name ?? null,
  }
}

export async function getDashboardPayload(): Promise<DashboardPayload> {
  const admin = createAdminClient()

  const [products, categories, customers, lowStock, viewsResult, notFoundResult] =
    await Promise.all([
      admin.from('products').select('id', { count: 'exact', head: true }),
      admin.from('categories').select('id', { count: 'exact', head: true }),
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin
        .from('products')
        .select('id, name, stock, slug')
        .eq('active', true)
        .lte('stock', 3)
        .order('stock', { ascending: true })
        .limit(8),
      admin
        .from('product_views_daily')
        .select('product_id, day, views, products(name, slug)')
        .order('day', { ascending: false })
        .limit(5000),
      admin
        .from('not_found_paths')
        .select('path, hits, last_seen_at, sample_referrer')
        .order('hits', { ascending: false })
        .limit(30),
    ])

  let paymentColumnsAvailable = true
  let rawOrders: RawOrder[] = []

  const full = await admin
    .from('orders')
    .select(
      'id, status, payment_status, payment_method, total, shipping_price, discount_amount, created_at, shipping_method_name, customer_name, profiles(name)'
    )
    .order('created_at', { ascending: false })

  if (full.error) {
    const mid = await admin
      .from('orders')
      .select(
        'id, status, payment_status, payment_method, total, shipping_price, created_at, shipping_method_name, profiles(name)'
      )
      .order('created_at', { ascending: false })

    if (mid.error) {
      paymentColumnsAvailable = false
      const legacy = await admin
        .from('orders')
        .select('id, status, total, shipping_price, created_at, shipping_method_name')
        .order('created_at', { ascending: false })
      rawOrders = (legacy.data ?? []) as RawOrder[]
    } else {
      rawOrders = (mid.data ?? []) as RawOrder[]
    }
  } else {
    rawOrders = (full.data ?? []) as RawOrder[]
  }

  const orders = rawOrders.map(mapOrder)
  const orderIds = orders.map((o) => o.id)
  const orderItems: DashboardOrderItemRow[] = []

  const chunkSize = 100
  for (let i = 0; i < orderIds.length; i += chunkSize) {
    const chunk = orderIds.slice(i, i + chunkSize)
    const itemsResult = await admin
      .from('order_items')
      .select('order_id, product_id, quantity, unit_price, subtotal, products(name, slug)')
      .in('order_id', chunk)

    if (itemsResult.error || !itemsResult.data) continue

    for (const item of itemsResult.data as RawItem[]) {
      if (!item.product_id) continue
      const qty = Number(item.quantity ?? 0)
      const unitPrice = Number(item.unit_price ?? 0)
      orderItems.push({
        orderId: item.order_id,
        productId: item.product_id,
        quantity: qty,
        unitPrice,
        subtotal: item.subtotal != null ? Number(item.subtotal) : qty * unitPrice,
        productName: item.products?.name?.trim() || 'Produto removido',
        productSlug: item.products?.slug ?? '',
      })
    }
  }

  type RawView = {
    product_id: string
    day: string
    views: number
    products?: { name?: string | null; slug?: string | null } | null
  }

  const productViews: ProductViewRow[] = viewsResult.error
    ? []
    : ((viewsResult.data ?? []) as RawView[]).map((row) => ({
        productId: row.product_id,
        day: row.day,
        views: Number(row.views ?? 0),
        productName: row.products?.name?.trim() || 'Produto',
        productSlug: row.products?.slug ?? '',
      }))

  type Raw404 = {
    path: string
    hits: number
    last_seen_at: string
    sample_referrer: string | null
  }

  const notFoundPaths: NotFoundPathRow[] = notFoundResult.error
    ? []
    : ((notFoundResult.data ?? []) as Raw404[]).map((row) => ({
        path: row.path,
        hits: Number(row.hits ?? 0),
        lastSeenAt: row.last_seen_at,
        sampleReferrer: row.sample_referrer,
      }))

  return {
    paymentColumnsAvailable,
    productsCount: products.count ?? 0,
    customersCount: customers.count ?? 0,
    categoriesCount: categories.count ?? 0,
    orders,
    orderItems,
    lowStock: (lowStock.data ?? []) as LowStockRow[],
    productViews,
    notFoundPaths,
  }
}
