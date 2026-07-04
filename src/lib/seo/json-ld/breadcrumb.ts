import { absoluteUrl } from '@/lib/seo/site-url'

export type BreadcrumbItem = {
  name: string
  path?: string
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  const homeUrl = absoluteUrl('/')
  if (!homeUrl) return null

  const itemListElement = items.map((item, index) => {
    const position = index + 1
    const itemUrl = item.path ? absoluteUrl(item.path) : undefined

    return {
      '@type': 'ListItem',
      position,
      name: item.name,
      ...(itemUrl ? { item: itemUrl } : {}),
    }
  })

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  }
}
