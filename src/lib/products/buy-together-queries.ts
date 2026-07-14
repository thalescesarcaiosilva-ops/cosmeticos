import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_BUNDLE_DISCOUNT_PERCENT,
  filterBundlesByMaxTotal,
  type BuyTogetherBundle,
} from '@/lib/products/buy-together'
import { mapProductCard, getRelatedProducts, PRODUCT_SELECT } from '@/lib/products/queries'

type BundleRow = {
  id: string
  companion_product_id: string
  discount_percent: number
  sort_order: number
}

async function getCuratedBundles(
  productId: string,
  limit: number
): Promise<BuyTogetherBundle[] | null> {
  const supabase = await createClient()

  const { data: bundleRows, error } = await supabase
    .from('product_bundles')
    .select('id, companion_product_id, discount_percent, sort_order')
    .eq('primary_product_id', productId)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .limit(limit)

  if (error) {
    const code = (error as { code?: string }).code ?? ''
    if (code === '42P01' || error.message.includes('product_bundles')) {
      return null
    }
    return []
  }

  const rows = (bundleRows ?? []) as BundleRow[]
  if (rows.length === 0) return []

  const companionIds = rows.map((row) => row.companion_product_id)

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .in('id', companionIds)
    .eq('active', true)
    .gt('stock', 0)

  if (productsError || !products) return []

  const productMap = new Map(
    products.map((row) => [row.id as string, mapProductCard(row as Record<string, unknown>)])
  )

  return rows
    .map((row) => {
      const companion = productMap.get(row.companion_product_id)
      if (!companion) return null
      return {
        id: row.id,
        companion,
        discountPercent: Number(row.discount_percent) || DEFAULT_BUNDLE_DISCOUNT_PERCENT,
      }
    })
    .filter((bundle): bundle is BuyTogetherBundle => bundle !== null)
}

export async function getBuyTogetherBundles(
  productId: string,
  categoryIds: string[],
  primaryPrice: number,
  limit = 3
): Promise<BuyTogetherBundle[]> {
  const curated = await getCuratedBundles(productId, Math.max(limit * 4, 12))
  if (curated !== null) {
    return filterBundlesByMaxTotal(primaryPrice, curated).slice(0, limit)
  }

  const related = await getRelatedProducts(productId, categoryIds, Math.max(limit * 4, 12), {
    inStockOnly: true,
  })
  const bundles = related.map((companion) => ({
    id: `${productId}-${companion.id}`,
    companion,
    discountPercent: DEFAULT_BUNDLE_DISCOUNT_PERCENT,
  }))

  return filterBundlesByMaxTotal(primaryPrice, bundles).slice(0, limit)
}
