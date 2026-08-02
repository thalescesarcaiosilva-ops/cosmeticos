import type { Metadata } from 'next'
import { ShopShell } from '@/components/layout/ShopShell'
import { TrackingScripts } from '@/components/seo/TrackingScripts'
import { buildFaviconIcons } from '@/lib/seo/build-metadata-icons'
import { getSeoSettings } from '@/lib/seo/get-seo-settings'
import { getSiteUrl } from '@/lib/seo/site-url'
import { getPublicStoreProfile } from '@/lib/store-profile/public'

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings()
  const siteUrl = getSiteUrl()

  return {
    metadataBase: siteUrl ? new URL(siteUrl) : undefined,
    title: {
      default: seo.defaultTitle,
      template: seo.titleTemplate,
    },
    description: seo.description,
    robots: { index: true, follow: true },
    openGraph: {
      locale: 'pt_BR',
      type: 'website',
      siteName: seo.siteName,
      title: seo.defaultTitle,
      description: seo.description,
      ...(seo.ogImageUrl ? { images: [{ url: seo.ogImageUrl, alt: seo.siteName }] } : {}),
    },
    twitter: {
      card: seo.ogImageUrl ? 'summary_large_image' : 'summary',
      title: seo.defaultTitle,
      description: seo.description,
      ...(seo.ogImageUrl ? { images: [seo.ogImageUrl] } : {}),
    },
    ...buildFaviconIcons(seo.faviconUrl),
  }
}

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const profile = await getPublicStoreProfile()

  return (
    <>
      <TrackingScripts profile={profile} placement="head" />
      <TrackingScripts profile={profile} placement="body" />
      <ShopShell>{children}</ShopShell>
    </>
  )
}
