/** URL pública da loja (sem barra final). Ex.: https://www.sualoja.com.br */
export function getSiteUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/+$/, '')
}

/** Usado em sitemap/robots: env em produção; host da requisição em dev local. */
export async function resolvePublicSiteUrl(): Promise<string | null> {
  const configured = getSiteUrl()
  if (configured) return configured

  if (process.env.NODE_ENV !== 'development') return null

  try {
    const { headers } = await import('next/headers')
    const headerList = await headers()
    const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
    if (!host) return null
    const protocol = headerList.get('x-forwarded-proto') ?? 'http'
    return `${protocol}://${host}`.replace(/\/+$/, '')
  } catch {
    return null
  }
}

export function absoluteUrl(path: string, base?: string | null): string | null {
  const resolvedBase = base ?? getSiteUrl()
  if (!resolvedBase) return null
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${resolvedBase}${normalized}`
}
