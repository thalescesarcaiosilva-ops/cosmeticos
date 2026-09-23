import { createPublicClient } from '@/lib/supabase/public'

export type BestSellerRow = {
  productId: string
  unitsSold: number
}

type CachedBestSellers = {
  data: BestSellerRow[]
  expiresAt: number
}

let cache: CachedBestSellers | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Ranking real de mais vendidos, calculado a partir de pedidos efetivamente
 * pagos (confirmed/shipped/delivered) — nunca um "mais vendido" fictício.
 * Usado como base para sugerir combos de "Compre junto" só com produtos que
 * de fato já venderam na loja.
 */
export async function getBestSellingProductIds(limit = 60): Promise<BestSellerRow[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.data

  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_best_selling_products', {
    p_limit: limit,
  })

  if (error || !data) return cache?.data ?? []

  const rows = (data as Array<{ product_id: string; units_sold: number | string }>).map(
    (row) => ({
      productId: row.product_id,
      unitsSold: Number(row.units_sold) || 0,
    })
  )

  cache = { data: rows, expiresAt: Date.now() + CACHE_TTL_MS }
  return rows
}
