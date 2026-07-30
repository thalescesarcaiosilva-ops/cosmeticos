import { getSeoSettings } from '@/lib/seo/get-seo-settings'

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

/** Serve o favicon do admin (ou PNG transparente se não configurado). */
export async function serveFaviconResponse(): Promise<Response> {
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
