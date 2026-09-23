import { createPublicClient } from '@/lib/supabase/public'
import { getBestSellingProductIds } from '@/lib/products/best-sellers'
import {
  DEFAULT_BUNDLE_DISCOUNT_PERCENT,
  filterBundlesByMaxTotal,
  MAX_BUNDLE_TOTAL,
  type BuyTogetherBundle,
} from '@/lib/products/buy-together'
import { mapProductCard, getRelatedProducts, PRODUCT_SELECT } from '@/lib/products/queries'
import { attachReviewSummaries } from '@/lib/products/reviews'
import type { BuyTogetherSettings } from '@/types/buy-together-settings'

type BundleRow = {
  id: string
  companion_product_id: string
  discount_percent: number
  sort_order: number
}

async function getCuratedBundles(
  productId: string,
  limit: number,
  defaultDiscountPercent: number,
  bestSellerIds: Set<string>
): Promise<BuyTogetherBundle[] | null> {
  const supabase = createPublicClient()

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

  const cards = await attachReviewSummaries(
    products.map((row) => mapProductCard(row as unknown as Record<string, unknown>))
  )
  const productMap = new Map(cards.map((card) => [card.id, card]))

  return rows
    .map((row): BuyTogetherBundle | null => {
      const companion = productMap.get(row.companion_product_id)
      if (!companion) return null
      return {
        id: row.id,
        companion,
        discountPercent: Number(row.discount_percent) || defaultDiscountPercent,
        companionIsBestSeller: bestSellerIds.has(row.companion_product_id),
      }
    })
    .filter((bundle): bundle is BuyTogetherBundle => bundle !== null)
}

/**
 * Fallback sem curadoria manual: sugere como acompanhante apenas produtos
 * que realmente já venderam na loja (ranking de `get_best_selling_products`),
 * priorizando os que também são da mesma categoria do produto principal.
 * Nunca inclui um produto "mais vendido" que não tenha venda de verdade.
 */
async function getBestSellerFallbackBundles(
  productId: string,
  categoryIds: string[],
  limit: number,
  defaultDiscountPercent: number,
  rankedIds: string[]
): Promise<BuyTogetherBundle[]> {
  if (rankedIds.length === 0) return []

  const supabase = createPublicClient()
  const { data: products } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .in('id', rankedIds)
    .eq('active', true)
    .gt('stock', 0)

  if (!products?.length) return []

  const cards = await attachReviewSummaries(
    products.map((row) => mapProductCard(row as unknown as Record<string, unknown>))
  )
  const cardMap = new Map(cards.map((card) => [card.id, card]))

  let sameCategoryIds = new Set<string>()
  if (categoryIds.length > 0) {
    const { data: links } = await supabase
      .from('product_categories')
      .select('product_id')
      .in('category_id', categoryIds)
      .in('product_id', rankedIds)
    sameCategoryIds = new Set((links ?? []).map((l) => l.product_id as string))
  }

  // rankedIds já vem ordenado por unidades vendidas (desc); só reordenamos
  // para priorizar mesma categoria, mantendo a ordem de vendas dentro de cada grupo.
  const ordered = rankedIds
    .filter((id) => cardMap.has(id))
    .sort((a, b) => {
      const aSame = sameCategoryIds.has(a) ? 0 : 1
      const bSame = sameCategoryIds.has(b) ? 0 : 1
      return aSame - bSame
    })

  return ordered.slice(0, limit).map((id) => ({
    id: `${productId}-${id}`,
    companion: cardMap.get(id)!,
    discountPercent: defaultDiscountPercent,
    companionIsBestSeller: true,
  }))
}

export async function getBuyTogetherBundles(
  productId: string,
  categoryIds: string[],
  primaryPrice: number,
  limit = 3,
  settings?: Pick<BuyTogetherSettings, 'defaultDiscountPercent' | 'maxBundleTotal'>
): Promise<BuyTogetherBundle[]> {
  const defaultDiscountPercent =
    settings?.defaultDiscountPercent ?? DEFAULT_BUNDLE_DISCOUNT_PERCENT
  const maxBundleTotal = settings?.maxBundleTotal ?? MAX_BUNDLE_TOTAL

  // Ranking real de mais vendidos (cacheado ~5min, sem custo de imagens/reviews).
  const bestSellers = await getBestSellingProductIds(60)
  const rankedIds = bestSellers.map((row) => row.productId).filter((id) => id !== productId)
  const bestSellerIds = new Set(rankedIds)

  const curated = await getCuratedBundles(
    productId,
    Math.max(limit * 4, 12),
    defaultDiscountPercent,
    bestSellerIds
  )

  if (curated !== null && curated.length > 0) {
    return filterBundlesByMaxTotal(primaryPrice, curated, maxBundleTotal).slice(0, limit)
  }

  // Sem pares curados: usa produtos com venda real comprovada na loja.
  const bestSellerBundles = await getBestSellerFallbackBundles(
    productId,
    categoryIds,
    Math.max(limit * 4, 12),
    defaultDiscountPercent,
    rankedIds
  )
  if (bestSellerBundles.length > 0) {
    const filtered = filterBundlesByMaxTotal(primaryPrice, bestSellerBundles, maxBundleTotal)
    if (filtered.length > 0) return filtered.slice(0, limit)
  }

  // Loja nova / sem vendas suficientes ainda: cai para produtos relacionados por categoria.
  const related = await getRelatedProducts(productId, categoryIds, Math.max(limit * 4, 12), {
    inStockOnly: true,
  })
  const bundles = related.map((companion) => ({
    id: `${productId}-${companion.id}`,
    companion,
    discountPercent: defaultDiscountPercent,
    companionIsBestSeller: false,
  }))

  return filterBundlesByMaxTotal(primaryPrice, bundles, maxBundleTotal).slice(0, limit)
}
