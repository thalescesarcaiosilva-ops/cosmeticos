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

const nextConfig: NextConfig = {
  images: {
    // URLs diretas (/storage/..., /loja.png) — sem proxy /_next/image
    unoptimized: true,
    qualities: [75, 80],
    remotePatterns,
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
