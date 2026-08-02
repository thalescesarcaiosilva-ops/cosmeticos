import { renderSitemapSectionResponse } from '@/lib/seo/sitemap-route'

/** Catálogo muda com frequência — não servir snapshot ISR antigo. */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  return renderSitemapSectionResponse('products')
}
