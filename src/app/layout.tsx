import type { Metadata } from 'next'
import { Fraunces, IBM_Plex_Mono, Jost } from 'next/font/google'
import { buildFaviconIcons } from '@/lib/seo/build-metadata-icons'
import { getSeoSettings } from '@/lib/seo/get-seo-settings'
import { getSiteUrl } from '@/lib/seo/site-url'
import './globals.css'

export const revalidate = 60

/** Variável = 1 arquivo no caminho crítico (antes: 400/600/700 = vários woff2 em cadeia após o CSS). */
const jost = Jost({
  variable: '--font-jost',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
})

/** Só páginas editoriais; sem preload para não competir com LCP/CSS da home. */
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  preload: false,
  adjustFontFallback: true,
})

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  preload: false,
  adjustFontFallback: true,
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
    twitter: {
      card: seo.ogImageUrl ? 'summary_large_image' : 'summary',
      title: seo.defaultTitle,
      description: seo.description,
      ...(seo.ogImageUrl ? { images: [seo.ogImageUrl] } : {}),
    },
    ...buildFaviconIcons(seo.faviconUrl),
  }
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${jost.variable} ${fraunces.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className={`${jost.className} min-h-full`}>{children}</body>
    </html>
  )
}
