import { resolvePublicSiteUrl } from '@/lib/seo/site-url'
import {
  buildRobotsTxt,
  robotsTxtResponse,
} from '@/lib/seo/seo-sitemap'

export const revalidate = 86400

export async function GET() {
  const siteUrl = await resolvePublicSiteUrl()
  return robotsTxtResponse(buildRobotsTxt(siteUrl))
}
