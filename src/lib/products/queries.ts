import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPublicClient } from '@/lib/supabase/public'
import { getPrimaryProductImage } from '@/lib/products/product-images'
import type { ProductCardData, ProductDetail } from '@/types/product'

const PRODUCT_MEDIA_WITH_VARIANTS =
  'id, public_url, thumb_url, medium_url, alt_text, filename'
const PRODUCT_MEDIA_LEGACY = 'id, public_url, alt_text, filename'

function buildProductSelect(mediaCols: string) {
  return `
  id, name, slug, description, short_description, benefits,
  price, original_price, stock, sku, gtin,
  meta_title, meta_description, active, brand_id, created_at, updated_at,
  brand:brands(id, name, slug, active),
  product_categories(category_id, categories(id, name, slug)),
  product_images(id, sort_order, media:media_assets(${mediaCols}))
`
}

let cachedMediaCols = PRODUCT_MEDIA_WITH_VARIANTS

function isMissingVariantColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message) return false
  return (
    error.message.includes('thumb_url') ||
    error.message.includes('medium_url') ||
    error.code === '42703'
  )
}

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
      return {
        id,
        url: image.url,
        thumbUrl: image.thumbUrl ?? image.url,
        mediumUrl: image.mediumUrl ?? image.url,
        alt: image.alt ?? (row.name as string),
      }
    })
    .filter(
      (
        image
      ): image is {
        id: string
        url: string
        thumbUrl: string
        mediumUrl: string
        alt: string
      } => image !== null
    )

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
    imageUrl: primary.thumbUrl ?? primary.url,
    imageAlt: primary.alt ?? (row.name as string),
  }
}

export const getProductBySlug = cache(async (slug: string): Promise<ProductDetail | null> => {
  const supabase = createPublicClient()
  let { data, error } = await supabase
    .from('products')
    .select(buildProductSelect(cachedMediaCols))
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (error && isMissingVariantColumn(error)) {
    cachedMediaCols = PRODUCT_MEDIA_LEGACY
    const retry = await supabase
      .from('products')
      .select(buildProductSelect(PRODUCT_MEDIA_LEGACY))
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle()
    data = retry.data
    error = retry.error
  }

  if (error || !data) return null
  return mapProductDetail(data as unknown as Record<string, unknown>)
})

export async function getProductsForCards(options?: {
  limit?: number
  categorySlug?: string
}): Promise<ProductCardData[]> {
  const supabase = createPublicClient()
  const limit = options?.limit ?? 24
  const select = buildProductSelect(cachedMediaCols)

  async function runSelect(mediaCols: string) {
    const sel = buildProductSelect(mediaCols)
    if (options?.categorySlug) {
      const { data: category } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', options.categorySlug)
        .eq('active', true)
        .maybeSingle()

      if (!category) return { data: [] as unknown[], error: null }

      const { data: links } = await supabase
        .from('product_categories')
        .select('product_id')
        .eq('category_id', category.id)

      const ids = links?.map((l) => l.product_id) ?? []
      if (ids.length === 0) return { data: [] as unknown[], error: null }

      return supabase
        .from('products')
        .select(sel)
        .in('id', ids)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(limit)
    }

    return supabase
      .from('products')
      .select(sel)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(limit)
  }

  let { data, error } = await runSelect(cachedMediaCols)

  if (error && isMissingVariantColumn(error)) {
    cachedMediaCols = PRODUCT_MEDIA_LEGACY
    ;({ data, error } = await runSelect(PRODUCT_MEDIA_LEGACY))
  }

  if (error || !data) return []
  return data.map((row) => mapProductCard(row as unknown as Record<string, unknown>))
}

export async function getRelatedProducts(
  productId: string,
  categoryIds: string[],
  limit = 8,
  options?: { inStockOnly?: boolean }
): Promise<ProductCardData[]> {
  if (categoryIds.length === 0) return []

  const supabase = createPublicClient()

  const { data: links } = await supabase
    .from('product_categories')
    .select('product_id')
    .in('category_id', categoryIds)
    .neq('product_id', productId)

  const relatedIds = [...new Set(links?.map((l) => l.product_id) ?? [])]
  if (relatedIds.length === 0) return []

  async function run(mediaCols: string) {
    let query = supabase
      .from('products')
      .select(buildProductSelect(mediaCols))
      .in('id', relatedIds.slice(0, limit * 2))
      .eq('active', true)

    if (options?.inStockOnly) {
      query = query.gt('stock', 0)
    }

    return query.order('created_at', { ascending: false }).limit(limit)
  }

  let { data, error } = await run(cachedMediaCols)
  if (error && isMissingVariantColumn(error)) {
    cachedMediaCols = PRODUCT_MEDIA_LEGACY
    ;({ data, error } = await run(PRODUCT_MEDIA_LEGACY))
  }

  if (error || !data) return []
  return data.map((row) => mapProductCard(row as unknown as Record<string, unknown>))
}

export { buildProductSelect, PRODUCT_MEDIA_WITH_VARIANTS, PRODUCT_MEDIA_LEGACY }

/** Select padrão (com variantes quando a migration estiver aplicada). */
export const PRODUCT_SELECT = buildProductSelect(PRODUCT_MEDIA_WITH_VARIANTS)

export { mapProductDetail }

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

