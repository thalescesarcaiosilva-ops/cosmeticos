import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPrimaryProductImage } from '@/lib/products/product-images'
import type { ProductCardData, ProductDetail } from '@/types/product'

const PRODUCT_SELECT = `
  id, name, slug, description, short_description, benefits,
  price, original_price, stock, sku, gtin,
  meta_title, meta_description, active, brand_id, created_at, updated_at,
  brand:brands(id, name, slug, active),
  product_categories(category_id, categories(id, name, slug)),
  product_images(id, sort_order, media:media_assets(id, public_url, alt_text, filename))
`

function mapProductDetail(row: Record<string, unknown>): ProductDetail {
  const productImages = Array.isArray(row.product_images) ? row.product_images : []
  const sorted = [...productImages].sort((a, b) => {
    const aOrder =
      a && typeof a === 'object' && 'sort_order' in a ? Number(a.sort_order) : 0
    const bOrder =
      b && typeof b === 'object' && 'sort_order' in b ? Number(b.sort_order) : 0
    return aOrder - bOrder
  })

  const images = sorted
    .map((item) => {
      if (!item || typeof item !== 'object' || !('media' in item)) return null
      const image = getPrimaryProductImage([item], row.name as string)
      if (!image.url) return null
      const id =
        'id' in item && typeof item.id === 'string'
          ? item.id
          : image.url
      return { id, url: image.url, alt: image.alt ?? (row.name as string) }
    })
    .filter((image): image is { id: string; url: string; alt: string } => image !== null)

  const categories =
    (row.product_categories as ProductDetail['product_categories'])
      ?.map((pc) => pc.categories)
      .filter((c): c is { id: string; name: string; slug: string } => Boolean(c?.slug))
      .map((c) => ({ name: c.name, slug: c.slug })) ?? []

  const categorySlugs = categories.map((c) => c.slug)

  const brand = row.brand as ProductDetail['brand']

  return {
    ...(row as ProductDetail),
    images,
    categories,
    categorySlugs,
    brandName: brand?.name ?? null,
    brandSlug: brand?.slug ?? null,
  }
}

export function mapProductCard(row: Record<string, unknown>): ProductCardData {
  const primary = getPrimaryProductImage(row.product_images, row.name as string)
  const brand = row.brand as { name?: string } | null | undefined

  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    brandName: brand?.name?.trim() || null,
    price: Number(row.price),
    originalPrice: row.original_price != null ? Number(row.original_price) : null,
    imageUrl: primary.url,
    imageAlt: primary.alt ?? (row.name as string),
  }
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (error || !data) return null
  return mapProductDetail(data as Record<string, unknown>)
}

export async function getProductsForCards(options?: {
  limit?: number
  categorySlug?: string
}): Promise<ProductCardData[]> {
  const supabase = await createClient()
  const limit = options?.limit ?? 24

  if (options?.categorySlug) {
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', options.categorySlug)
      .eq('active', true)
      .maybeSingle()

    if (!category) return []

    const { data: links } = await supabase
      .from('product_categories')
      .select('product_id')
      .eq('category_id', category.id)

    const ids = links?.map((l) => l.product_id) ?? []
    if (ids.length === 0) return []

    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .in('id', ids)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data.map((row) => mapProductCard(row as Record<string, unknown>))
  }

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data.map((row) => mapProductCard(row as Record<string, unknown>))
}

export async function getRelatedProducts(
  productId: string,
  categoryIds: string[],
  limit = 8,
  options?: { inStockOnly?: boolean }
): Promise<ProductCardData[]> {
  if (categoryIds.length === 0) return []

  const supabase = await createClient()

  const { data: links } = await supabase
    .from('product_categories')
    .select('product_id')
    .in('category_id', categoryIds)
    .neq('product_id', productId)

  const relatedIds = [...new Set(links?.map((l) => l.product_id) ?? [])]
  if (relatedIds.length === 0) return []

  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .in('id', relatedIds.slice(0, limit * 2))
    .eq('active', true)

  if (options?.inStockOnly) {
    query = query.gt('stock', 0)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data.map((row) => mapProductCard(row as Record<string, unknown>))
}

export async function syncProductRelations(
  productId: string,
  categoryIds: string[] | undefined,
  mediaIds: string[] | undefined
) {
  const admin = createAdminClient()

  if (categoryIds !== undefined) {
    await admin.from('product_categories').delete().eq('product_id', productId)
    if (categoryIds.length > 0) {
      await admin.from('product_categories').insert(
        categoryIds.map((category_id) => ({ product_id: productId, category_id }))
      )
    }
  }

  if (mediaIds !== undefined) {
    await admin.from('product_images').delete().eq('product_id', productId)
    if (mediaIds.length > 0) {
      await admin.from('product_images').insert(
        mediaIds.map((media_id, index) => ({
          product_id: productId,
          media_id,
          sort_order: index,
        }))
      )
    }
  }
}

export { PRODUCT_SELECT, mapProductDetail }
