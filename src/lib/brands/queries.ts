import { createPublicClient } from '@/lib/supabase/public'
import { getPrimaryProductImage } from '@/lib/products/product-images'
import type { Brand, ProductCardData } from '@/types/product'

const BRAND_PRODUCT_SELECT = `
  id, name, slug, price, original_price,
  brand:brands(name),
  product_images(sort_order, media:media_assets(public_url, alt_text))
`

function mapProductCard(row: Record<string, unknown>): ProductCardData {
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

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('brands')
    .select('id, name, slug, active')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (error || !data) return null
  return data as Brand
}

export async function getBrandProducts(brandId: string, limit = 48): Promise<ProductCardData[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('products')
    .select(BRAND_PRODUCT_SELECT)
    .eq('brand_id', brandId)
    .eq('active', true)
    .order('name', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return data.map((row) => mapProductCard(row as Record<string, unknown>))
}
