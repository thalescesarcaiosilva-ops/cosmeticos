import { absoluteUrl, getSiteUrl } from '@/lib/seo/site-url'

function getSupabaseOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

/** Normaliza URL pública do storage para usar o domínio da loja quando possível. */
export function toSiteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null

  const siteUrl = getSiteUrl()
  if (trimmed.startsWith('/storage/v1/object/public/')) {
    return siteUrl ? absoluteUrl(trimmed, siteUrl) ?? trimmed : trimmed
  }

  if (!siteUrl) {
    try {
      const parsed = new URL(trimmed)
      const supabaseOrigin = getSupabaseOrigin()
      if (supabaseOrigin && parsed.origin === supabaseOrigin && parsed.pathname.startsWith('/storage/v1/object/public/')) {
        return `${parsed.pathname}${parsed.search}`
      }
    } catch {
      // ignore
    }
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    const supabaseOrigin = getSupabaseOrigin()
    if (!supabaseOrigin || parsed.origin !== supabaseOrigin) {
      return trimmed
    }
    if (!parsed.pathname.startsWith('/storage/v1/object/public/')) {
      return trimmed
    }
    return `${siteUrl}${parsed.pathname}${parsed.search}`
  } catch {
    return trimmed
  }
}
