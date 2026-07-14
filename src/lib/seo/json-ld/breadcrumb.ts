import { absoluteUrl } from '@/lib/seo/site-url'

export type BreadcrumbItem = {
  name: string
  /** Required for every crumb except the last (current page). */
  path?: string
}

/**
 * Builds BreadcrumbList JSON-LD.
 * Google requires `item` (URL) on every ListItem except the last.
 */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  const homeUrl = absoluteUrl('/')
  if (!homeUrl || items.length === 0) return null

  const lastIndex = items.length - 1

  const itemListElement = items.map((item, index) => {
    const position = index + 1
    const isLast = index === lastIndex
    const itemUrl = item.path ? absoluteUrl(item.path) : undefined

    const listItem: Record<string, unknown> = {
      '@type': 'ListItem',
      position,
      name: item.name,
    }

    if (itemUrl) {
      listItem.item = itemUrl
    } else if (!isLast) {
      // Non-final crumbs without a path are invalid for Rich Results.
      // Callers must pass `path` for every crumb except the last.
      listItem.item = homeUrl
    }

    return listItem
  })

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  }
}
