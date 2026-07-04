import { renderSitemapSectionResponse } from '@/lib/seo/sitemap-route'

export const revalidate = 3600

export async function GET() {
  return renderSitemapSectionResponse('pages')
}
