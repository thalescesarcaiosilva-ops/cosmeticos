import { getSeoSettings } from '@/lib/seo/get-seo-settings'

export const revalidate = 60

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

/** Substitui o favicon padrão do Next.js pelo configurado no admin. */
export default async function Icon() {
  const { faviconUrl } = await getSeoSettings()

  if (!faviconUrl) {
    return new Response(TRANSPARENT_PNG, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60, must-revalidate',
      },
    })
  }

  const response = await fetch(faviconUrl, { next: { revalidate: 60 } })
  if (!response.ok) {
    return new Response(TRANSPARENT_PNG, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60, must-revalidate',
      },
    })
  }

  const bytes = await response.arrayBuffer()
  return new Response(bytes, {
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'image/png',
      'Cache-Control': 'public, max-age=60, must-revalidate',
    },
  })
}

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'
