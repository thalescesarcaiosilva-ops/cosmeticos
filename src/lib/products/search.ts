import { createPublicClient } from '@/lib/supabase/public'
import { getPrimaryProductImage } from '@/lib/products/product-images'
import type { ProductCardData } from '@/types/product'

const SEARCH_SELECT = `
  id, name, slug, price, original_price,
  brand:brands(name),
  product_images(sort_order, media:media_assets(public_url, alt_text))
`

const SEARCH_LIMIT = 8

function sanitizeSearchTerm(query: string): string {
  return query
    .trim()
    .replace(/[,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 100)
}

function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&')
}

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

export async function searchProducts(query: string): Promise<ProductCardData[]> {
  const term = escapeIlike(sanitizeSearchTerm(query))
  if (term.length < 2) return []

  const supabase = createPublicClient()
  const pattern = `%${term}%`

  const { data, error } = await supabase
    .from('products')
    .select(SEARCH_SELECT)
    .eq('active', true)
    .or(`name.ilike.${pattern},sku.ilike.${pattern}`)
    .order('name', { ascending: true })
    .limit(SEARCH_LIMIT)

  if (error || !data) return []
  return data.map((row) => mapSearchResult(row as Record<string, unknown>))
}

export async function searchProductsPage(
  query: string,
  limit = 24
): Promise<ProductCardData[]> {
  const term = escapeIlike(sanitizeSearchTerm(query))
  if (term.length < 2) return []

  const supabase = createPublicClient()
  const pattern = `%${term}%`

  const { data, error } = await supabase
    .from('products')
    .select(SEARCH_SELECT)
    .eq('active', true)
    .or(`name.ilike.${pattern},sku.ilike.${pattern}`)
    .order('name', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return data.map((row) => mapSearchResult(row as Record<string, unknown>))
}
