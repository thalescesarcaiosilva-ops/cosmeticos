import type { Metadata } from 'next'
import { CartProvider } from '@/providers/CartProvider'
import { FavoritesProvider } from '@/providers/FavoritesProvider'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { AnalyticsScripts } from '@/components/seo/AnalyticsScripts'
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
    ...(seo.faviconUrl
      ? {
          icons: {
            icon: seo.faviconUrl,
            shortcut: seo.faviconUrl,
            apple: seo.faviconUrl,
          },
        }
      : {}),
  }
}

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const storeProfile = await getPublicStoreProfile()

  return (
    <CartProvider>
      <FavoritesProvider>
        <AnalyticsScripts profile={storeProfile} />
        <SiteLayout>{children}</SiteLayout>
      </FavoritesProvider>
    </CartProvider>
  )
}
