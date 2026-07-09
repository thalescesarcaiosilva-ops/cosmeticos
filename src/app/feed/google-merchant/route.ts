import { createPublicClient, isSupabasePublicConfigured } from '@/lib/supabase/public'
import { toAbsoluteSiteMediaUrl } from '@/lib/media/public-url'
import { getPrimaryProductImage, readBrandName } from '@/lib/products/product-images'
import { absoluteUrl } from '@/lib/seo/site-url'

export const revalidate = 3600

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
      id, name, slug, description, price, stock, sku, gtin, updated_at,
      brand:brands(name),
      product_images(sort_order, media:media_assets(public_url))
    `
    )
    .eq('active', true)
    .order('updated_at', { ascending: false })

  const items = (products ?? []).map((row) => {
    const imageUrl =
      toAbsoluteSiteMediaUrl(getPrimaryProductImage(row.product_images, row.name).url) ?? ''
    const link = absoluteUrl(`/produto/${row.slug}`) ?? ''
    const brand = readBrandName(row.brand)
    const description = stripHtml(row.description ?? row.name).slice(0, 5000)
    const availability = row.stock > 0 ? 'in_stock' : 'out_of_stock'
    const price = `${Number(row.price).toFixed(2)} BRL`

    return `
    <item>
      <g:id>${escapeXml(row.id)}</g:id>
      <title>${escapeXml(row.name)}</title>
      <description>${escapeXml(description)}</description>
      <link>${escapeXml(link)}</link>
      <g:link>${escapeXml(link)}</g:link>
      ${imageUrl ? `<g:image_link>${escapeXml(imageUrl)}</g:image_link>` : ''}
      <g:availability>${availability}</g:availability>
      <g:price>${price}</g:price>
      <g:condition>new</g:condition>
      ${brand ? `<g:brand>${escapeXml(brand)}</g:brand>` : ''}
      ${row.gtin ? `<g:gtin>${escapeXml(row.gtin)}</g:gtin>` : ''}
      ${row.sku ? `<g:mpn>${escapeXml(row.sku)}</g:mpn>` : ''}
      <g:identifier_exists>${row.gtin || row.sku ? 'yes' : 'no'}</g:identifier_exists>
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
