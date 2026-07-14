import type { NextConfig } from 'next'

type RemotePattern = {
  protocol: 'http' | 'https'
  hostname: string
  pathname: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')

function siteRemotePattern(): RemotePattern | null {
  if (!siteUrl) return null
  try {
    const { protocol, hostname } = new URL(siteUrl)
    return {
      protocol: protocol.replace(':', '') === 'http' ? 'http' : 'https',
      hostname,
      pathname: '/storage/**',
    }
  } catch {
    return null
  }
}

const remotePatterns: RemotePattern[] = [
  {
    protocol: 'https',
    hostname: '*.supabase.co',
    pathname: '/storage/v1/object/public/**',
  },
]

const sitePattern = siteRemotePattern()
if (sitePattern) remotePatterns.push(sitePattern)

/** Cache longo para assets estáticos e mídia versionada por nome (hash no arquivo). */
const LONG_CACHE = 'public, max-age=31536000, immutable'
const MONTH_CACHE = 'public, max-age=2592000, stale-while-revalidate=86400'

const nextConfig: NextConfig = {
  images: {
    // Gera WebP/AVIF e redimensiona conforme `sizes` (cards ~263px, não 1000px).
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    qualities: [70, 75, 80],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 160, 256, 384],
    remotePatterns,
  },
  async headers() {
    return [
      {
        source: '/storage/:path*',
        headers: [{ key: 'Cache-Control', value: MONTH_CACHE }],
      },
      {
        source: '/loja.webp',
        headers: [{ key: 'Cache-Control', value: LONG_CACHE }],
      },
      {
        source: '/pagamento.png',
        headers: [{ key: 'Cache-Control', value: LONG_CACHE }],
      },
      {
        source: '/:path*.webp',
        headers: [{ key: 'Cache-Control', value: LONG_CACHE }],
      },
      {
        source: '/:path*.png',
        headers: [{ key: 'Cache-Control', value: MONTH_CACHE }],
      },
      {
        source: '/:path*.jpg',
        headers: [{ key: 'Cache-Control', value: MONTH_CACHE }],
      },
      {
        source: '/:path*.jpeg',
        headers: [{ key: 'Cache-Control', value: MONTH_CACHE }],
      },
      {
        source: '/:path*.avif',
        headers: [{ key: 'Cache-Control', value: LONG_CACHE }],
      },
    ]
  },
  async rewrites() {
    if (!supabaseUrl) return []
    return [
      {
        source: '/storage/v1/object/public/:path*',
        destination: `${supabaseUrl}/storage/v1/object/public/:path*`,
      },
    ]
  },
}

export default nextConfig
