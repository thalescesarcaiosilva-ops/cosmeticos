import { absoluteUrl } from '@/lib/seo/site-url'
import { organizationId } from '@/lib/seo/json-ld/merchant-schemas'

type WebsiteJsonLdInput = {
  storeName: string
}

export function buildWebsiteJsonLd({ storeName }: WebsiteJsonLdInput) {
  const siteUrl = absoluteUrl('/')
  if (!siteUrl) return null

  const searchUrl = absoluteUrl('/busca?q={search_term_string}')
  if (!searchUrl) return null

  const orgId = organizationId()

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: storeName,
    url: siteUrl,
    publisher: orgId ? { '@id': orgId } : { '@type': 'Organization', name: storeName },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: searchUrl,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}
