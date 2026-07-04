import { renderSitemapIndexResponse } from '@/lib/seo/sitemap-route'

export const revalidate = 3600

export async function GET() {
  return renderSitemapIndexResponse()
}
