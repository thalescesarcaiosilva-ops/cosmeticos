import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/seo/site-url'

type BuildPageMetadataInput = {
  title: string | { absolute: string }
  description?: string | null
  path: string
  imageUrl?: string | null
  imageAlt?: string | null
  noindex?: boolean
  type?: 'website' | 'article'
}

export function buildPageMetadata({
  title,
  description,
  path,
  imageUrl,
  imageAlt,
  noindex = false,
  type = 'website',
}: BuildPageMetadataInput): Metadata {
  const canonical = absoluteUrl(path)
  const titleText = typeof title === 'string' ? title : title.absolute

  const metadata: Metadata = {
    title,
    description: description ?? undefined,
    robots: noindex
      ? { index: false, follow: true, googleBot: { index: false, follow: true } }
      : { index: true, follow: true },
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: titleText,
      description: description ?? undefined,
      url: canonical ?? undefined,
      locale: 'pt_BR',
      type,
      ...(imageUrl
        ? {
            images: [{ url: imageUrl, alt: imageAlt ?? titleText }],
          }
        : {}),
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title: titleText,
      description: description ?? undefined,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  }

  return metadata
}
