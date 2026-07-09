import { absoluteUrl, getSiteUrl } from '@/lib/seo/site-url'

const STORAGE_PUBLIC_PREFIX = '/storage/v1/object/public/'

/** Extrai o caminho público do storage, independente do domínio salvo no banco. */
export function extractStoragePublicPath(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  if (trimmed.startsWith(STORAGE_PUBLIC_PREFIX)) {
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.pathname.startsWith(STORAGE_PUBLIC_PREFIX)) {
      return `${parsed.pathname}${parsed.search}`
    }
  } catch {
    // ignore
  }

  return null
}

/**
 * Normaliza URLs de mídia do storage para caminho relativo na loja.
 * Funciona com URLs antigas (vercel.app), Supabase (*.supabase.co) ou domínio atual.
 * Ex.: https://cosmeticos-tawny.vercel.app/storage/v1/object/public/banners/x.png
 *   -> /storage/v1/object/public/banners/x.png
 */
export function toSiteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null

  const storagePath = extractStoragePublicPath(trimmed)
  if (storagePath) return storagePath

  return trimmed
}

/** URL absoluta para feeds, JSON-LD e Open Graph. */
export function toAbsoluteSiteMediaUrl(url: string | null | undefined): string | null {
  const normalized = toSiteMediaUrl(url)
  if (!normalized) return null

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized
  }

  if (normalized.startsWith('/')) {
    return absoluteUrl(normalized) ?? normalized
  }

  const siteUrl = getSiteUrl()
  return siteUrl ? `${siteUrl}/${normalized.replace(/^\/+/, '')}` : normalized
}
