import { absoluteUrl } from '@/lib/seo/site-url'

export type BreadcrumbItem = {
  name: string
  /** Absolute path for this crumb (required for every crumb including the current page). */
  path?: string
}

/**
 * Builds BreadcrumbList JSON-LD.
 * Search Console (Merchant listings) treats missing `item` on any ListItem
 * as a critical rich-result error — including the current page crumb.
 * Always emit an absolute URL for every crumb.
 */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  const homeUrl = absoluteUrl('/')
  if (!homeUrl || items.length === 0) return null

  const itemListElement = items.map((item, index) => {
    const position = index + 1
    const itemUrl = item.path ? absoluteUrl(item.path) : null

    return {
      '@type': 'ListItem',
      position,
      name: item.name,
      // Fallback to home only if a caller forgot `path` — never omit `item`.
      item: itemUrl ?? homeUrl,
    }
  })

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  }
}
