import { resolvePublicSiteUrl } from '@/lib/seo/site-url'
import {
  buildSitemapIndexEntries,
  buildSitemapIndexXml,
  buildSitemapXml,
  collectSitemapUrls,
  collectSitemapUrlsByType,
  sitemapNotConfiguredResponse,
  sitemapXmlResponse,
  type SitemapUrl,
} from '@/lib/seo/seo-sitemap'

export async function renderSitemapIndexResponse() {
  const siteUrl = await resolvePublicSiteUrl()
  if (!siteUrl) return sitemapNotConfiguredResponse()

  const group = await collectSitemapUrlsByType()
  const indexEntries = buildSitemapIndexEntries(group)

  if (indexEntries.length === 0) {
    const fallback = await collectSitemapUrls()
    return sitemapXmlResponse(buildSitemapXml(fallback, siteUrl))
  }

  if (indexEntries.length === 1) {
    const only = indexEntries[0]!.path
    const urls: SitemapUrl[] = only.endsWith('pages.xml')
      ? group.pages
      : only.endsWith('products.xml')
        ? group.products
        : group.collections
    return sitemapXmlResponse(buildSitemapXml(urls, siteUrl))
  }

  return sitemapXmlResponse(buildSitemapIndexXml(indexEntries, siteUrl))
}

export async function renderSitemapSectionResponse(section: 'pages' | 'products' | 'collections') {
  const siteUrl = await resolvePublicSiteUrl()
  if (!siteUrl) return sitemapNotConfiguredResponse()

  const group = await collectSitemapUrlsByType()
  const urls = group[section]
  return sitemapXmlResponse(buildSitemapXml(urls, siteUrl))
}
