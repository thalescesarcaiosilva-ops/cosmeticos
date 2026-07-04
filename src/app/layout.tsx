import type { Metadata } from 'next'
import { Jost } from 'next/font/google'
import { getSeoSettings } from '@/lib/seo/get-seo-settings'
import { getSiteUrl } from '@/lib/seo/site-url'
import './globals.css'

export const revalidate = 60

const jost = Jost({
  variable: '--font-jost',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${jost.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
