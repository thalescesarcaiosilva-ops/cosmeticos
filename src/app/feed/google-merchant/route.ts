import { createPublicClient, isSupabasePublicConfigured } from '@/lib/supabase/public'
import { toAbsoluteSiteMediaUrl } from '@/lib/media/public-url'
import { getPrimaryProductImage, readBrandName } from '@/lib/products/product-images'
import { absoluteUrl } from '@/lib/seo/site-url'
import { resolveGoogleProductCategory } from '@/lib/seo/google-product-taxonomy'

export const revalidate = 3600

/** Máximo de imagens adicionais aceitas pelo Google Merchant Center. */
const MAX_ADDITIONAL_IMAGES = 10

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

type ProductImageRow = {
  sort_order: number
  media: { public_url: string } | { public_url: string }[] | null
}

function readImageUrl(media: ProductImageRow['media']): string | null {
  const item = Array.isArray(media) ? media[0] : media
  return item?.public_url ?? null
}

/** Retorna todas as imagens do produto (ordenadas), já em URL absoluta. */
function collectAbsoluteImageUrls(productImages: ProductImageRow[] | null | undefined): string[] {
  if (!Array.isArray(productImages)) return []

  const sorted = [...productImages].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const urls: string[] = []

  for (const item of sorted) {
    const raw = readImageUrl(item.media)
    if (!raw) continue
    const absolute = toAbsoluteSiteMediaUrl(raw)
    if (absolute && !urls.includes(absolute)) urls.push(absolute)
  }

  return urls
}

export async function GET() {
  const siteBase = absoluteUrl('/')
  if (!siteBase) {
    return new Response('NEXT_PUBLIC_SITE_URL não configurada', { status: 503 })
  }

  if (!isSupabasePublicConfigured()) {
    return new Response('Supabase não configurado', { status: 503 })
  }

  const supabase = createPublicClient()
  const { data: products } = await supabase
    .from('products')
    .select(
      `
      id, name, slug, description, price, original_price, stock, sku, gtin, updated_at,
      brand:brands(name),
      product_images(sort_order, media:media_assets(public_url)),
      product_categories(categories(name, slug))
    `
    )
    .eq('active', true)
    .order('updated_at', { ascending: false })

  const items = (products ?? []).map((row) => {
    const imageUrls = collectAbsoluteImageUrls(row.product_images as ProductImageRow[])
    const imageUrl =
      imageUrls[0] ??
      toAbsoluteSiteMediaUrl(getPrimaryProductImage(row.product_images, row.name).url) ??
      ''
    const additionalImageUrls = imageUrls.slice(1, 1 + MAX_ADDITIONAL_IMAGES)

    const link = absoluteUrl(`/produto/${row.slug}`) ?? ''
    const brand = readBrandName(row.brand)
    const description = stripHtml(row.description ?? row.name).slice(0, 5000)
    const availability = row.stock > 0 ? 'in_stock' : 'out_of_stock'
    const price = `${Number(row.price).toFixed(2)} BRL`
    const hasSale =
      row.original_price != null && Number(row.original_price) > Number(row.price)
    const salePrice = hasSale ? `${Number(row.price).toFixed(2)} BRL` : null
    const regularPrice = hasSale ? `${Number(row.original_price).toFixed(2)} BRL` : price

    const categoryRows = (row.product_categories ?? []) as Array<{
      categories: { name: string; slug: string } | { name: string; slug: string }[] | null
    }>
    const categories = categoryRows
      .map((pc) => (Array.isArray(pc.categories) ? pc.categories[0] : pc.categories))
      .filter((c): c is { name: string; slug: string } => Boolean(c?.slug))

    const googleCategory = resolveGoogleProductCategory(categories.map((c) => c.slug))
    const storeCategoryPath = categories.map((c) => c.name).join(' > ') || null

    return `
    <item>
      <g:id>${escapeXml(row.id)}</g:id>
      <title>${escapeXml(row.name)}</title>
      <description>${escapeXml(description)}</description>
      <link>${escapeXml(link)}</link>
      <g:link>${escapeXml(link)}</g:link>
      ${imageUrl ? `<g:image_link>${escapeXml(imageUrl)}</g:image_link>` : ''}
      ${additionalImageUrls.map((url) => `<g:additional_image_link>${escapeXml(url)}</g:additional_image_link>`).join('\n      ')}
      <g:availability>${availability}</g:availability>
      <g:price>${escapeXml(regularPrice)}</g:price>
      ${salePrice ? `<g:sale_price>${escapeXml(salePrice)}</g:sale_price>` : ''}
      <g:condition>new</g:condition>
      ${brand ? `<g:brand>${escapeXml(brand)}</g:brand>` : ''}
      ${row.gtin ? `<g:gtin>${escapeXml(row.gtin)}</g:gtin>` : ''}
      ${row.sku ? `<g:mpn>${escapeXml(row.sku)}</g:mpn>` : ''}
      <g:identifier_exists>${row.gtin || row.sku ? 'yes' : 'no'}</g:identifier_exists>
      <g:google_product_category>${googleCategory.id}</g:google_product_category>
      ${storeCategoryPath ? `<g:product_type>${escapeXml(storeCategoryPath)}</g:product_type>` : ''}
    </item>`
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml('Catálogo de produtos')}</title>
    <link>${escapeXml(siteBase)}</link>
    <description>Feed de produtos para Google Merchant Center</description>
    ${items.join('\n')}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  })
}
