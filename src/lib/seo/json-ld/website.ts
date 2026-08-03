import { absoluteUrl } from '@/lib/seo/site-url'
import { organizationId } from '@/lib/seo/json-ld/merchant-schemas'

type WebsiteJsonLdInput = {
  storeName: string
}

export function buildWebsiteJsonLd({ storeName }: WebsiteJsonLdInput) {
  const siteUrl = absoluteUrl('/')
  if (!siteUrl) return null

  const orgId = organizationId()

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: storeName,
    url: siteUrl,
    publisher: orgId ? { '@id': orgId } : { '@type': 'Organization', name: storeName },
  }
}
