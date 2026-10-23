import { createPublicClient } from '@/lib/supabase/public'
import { buildProductCardSrcSet } from '@/lib/media/resolve-display-url'
import { getPrimaryProductImage } from '@/lib/products/product-images'
import { attachReviewSummaries } from '@/lib/products/reviews'
import {
  escapeLikePattern,
  normalizeSearchText,
  sanitizeSearchQuery,
  searchTokens,
} from '@/lib/text/normalize-search'
import type { ProductCardData } from '@/types/product'

const SEARCH_SELECT = `
  id, name, slug, price, original_price,
  brand:brands(name),
  product_images(sort_order, media:media_assets(public_url, thumb_url, medium_url, alt_text))
`

const SEARCH_LIMIT = 8

function mapSearchResult(row: Record<string, unknown>): ProductCardData {
  const image = getPrimaryProductImage(row.product_images, row.name as string)
  const brand = row.brand as { name?: string } | null | undefined

  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    brandName: brand?.name?.trim() || null,
    price: Number(row.price),
    originalPrice: row.original_price != null ? Number(row.original_price) : null,
    imageUrl: image.url,
    imageSrcSet: buildProductCardSrcSet(image.url, image.storedThumbUrl),
    imageAlt: image.alt ?? (row.name as string),
  }
}

function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const order = new Map(ids.map((id, index) => [id, index]))
  return [...rows].sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
}

async function fetchProductsByIds(ids: string[]): Promise<ProductCardData[]> {
  if (ids.length === 0) return []

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('products')
    .select(SEARCH_SELECT)
    .in('id', ids)
    .eq('active', true)

  if (error || !data) return []
  return attachReviewSummaries(
    orderByIds(
      data.map((row) => mapSearchResult(row as Record<string, unknown>)),
      ids
    )
  )
}

function textHasToken(value: string, token: string) {
  const words = normalizeSearchText(value.replace(/[-/]/g, ' '))
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  return words.some(
    (word) => word === token || (token.length >= 4 && (word === `${token}s` || word === `${token}es`))
  )
}

async function searchProductIds(query: string, limit: number): Promise<string[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('search_store_products', {
    search_query: query,
    result_limit: limit,
  })

  if (!error && Array.isArray(data)) {
    return data.filter((id): id is string => typeof id === 'string')
  }

  const tokens = searchTokens(query)
  if (tokens.length === 0) return []

  const clauses = tokens.flatMap((token) => {
    const pattern = `%${escapeLikePattern(token)}%`
    return [`name.ilike.${pattern}`, `sku.ilike.${pattern}`]
  })

  const { data: fallbackRows, error: fallbackError } = await supabase
    .from('products')
    .select('id, name, sku, product_type')
    .eq('active', true)
    .or(clauses.join(','))
    .limit(80)

  if (fallbackError || !fallbackRows) return []

  const ranked = fallbackRows
    .map((row) => {
      const name = String(row.name ?? '')
      const sku = String(row.sku ?? '')
      const hits = tokens.filter((token) => textHasToken(name, token) || textHasToken(sku, token)).length
      return {
        id: row.id as string,
        name,
        productType: row.product_type as string | null,
        hits,
      }
    })
    .filter((row) => row.hits > 0 && row.productType !== 'variation')

  const best = ranked.reduce((max, row) => Math.max(max, row.hits), 0)
  const floor = best >= 2 ? 2 : 1

  return ranked
    .filter((row) => row.hits >= floor)
    .sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, limit)
    .map((row) => row.id)
}

export async function searchProducts(query: string): Promise<ProductCardData[]> {
  const term = sanitizeSearchQuery(query)
  if (term.length < 2) return []

  const ids = await searchProductIds(term, SEARCH_LIMIT)
  return fetchProductsByIds(ids)
}

export async function searchProductsPage(
  query: string,
  limit = 24
): Promise<ProductCardData[]> {
  const term = sanitizeSearchQuery(query)
  if (term.length < 2) return []

  const ids = await searchProductIds(term, limit)
  return fetchProductsByIds(ids)
}
