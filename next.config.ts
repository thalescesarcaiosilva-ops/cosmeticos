import type { NextConfig } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 80],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
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
