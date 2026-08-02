import { renderSitemapSectionResponse } from '@/lib/seo/sitemap-route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  return renderSitemapSectionResponse('collections')
}
