import { NextResponse } from 'next/server'

export const revalidate = 2592000

const ALLOWED_BUCKETS = new Set(['product-images'])
const FOLDER = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,80}$/
const FILE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}\.(webp|png|jpe?g|gif|avif)$/i

function isSafeObjectPath(path: string[]): boolean {
  if (path.length < 2 || path.length > 6) return false
  if (!ALLOWED_BUCKETS.has(path[0] ?? '')) return false
  const file = path[path.length - 1] ?? ''
  if (!FILE.test(file)) return false
  return path.slice(0, -1).every((part) => FOLDER.test(part))
}

/**
 * O Storage público do Supabase manda `X-Robots-Tag: none`. O Google Merchant
 * não baixa a imagem e reprova o produto. Esta rota entrega o mesmo arquivo
 * sem essa tag e sem cookie.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params
  if (!isSafeObjectPath(path)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  if (!supabaseUrl) {
    return new NextResponse('Not configured', { status: 503 })
  }

  const objectPath = path.map((part) => encodeURIComponent(part)).join('/')
  const upstream = await fetch(`${supabaseUrl}/storage/v1/object/public/${objectPath}`)
  const contentType = upstream.headers.get('content-type') ?? ''

  if (!upstream.ok || !upstream.body || !contentType.startsWith('image/')) {
    return new NextResponse('Not found', { status: 404 })
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=86400',
      'X-Robots-Tag': 'all',
    },
  })
}
