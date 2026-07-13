import { createPublicClient } from '@/lib/supabase/public'
import { getPrimaryProductImage } from '@/lib/products/product-images'
import {
  escapeLikePattern,
  normalizeSearchText,
  sanitizeSearchQuery,
} from '@/lib/text/normalize-search'
import type { ProductCardData } from '@/types/product'

const SEARCH_SELECT = `
  id, name, slug, price, original_price,
  brand:brands(name),
  product_images(sort_order, media:media_assets(public_url, alt_text))
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
  return orderByIds(
    data.map((row) => mapSearchResult(row as Record<string, unknown>)),
    ids
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

  const term = escapeLikePattern(sanitizeSearchQuery(query))
  if (term.length < 2) return []

  const pattern = `%${term}%`
  const { data: fallbackRows, error: fallbackError } = await supabase
    .from('products')
    .select('id, name, sku')
    .eq('active', true)
    .or(`name.ilike.${pattern},sku.ilike.${pattern}`)
    .order('name', { ascending: true })
    .limit(limit)

  if (fallbackError || !fallbackRows) return []

  const normalizedTerm = normalizeSearchText(term)
  return fallbackRows
    .filter((row) => {
      const name = normalizeSearchText(String(row.name ?? ''))
      const sku = normalizeSearchText(String(row.sku ?? ''))
      return name.includes(normalizedTerm) || sku.includes(normalizedTerm)
    })
    .map((row) => row.id as string)
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
