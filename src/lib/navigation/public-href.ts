import { absoluteUrl } from '@/lib/seo/site-url'

/** Caminho interno ou URL já absoluta → href público completo quando possível. */
export function toPublicHref(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim()
  if (!trimmed) return trimmed

  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    return trimmed
  }

  if (trimmed.startsWith('/')) {
    return absoluteUrl(trimmed) ?? trimmed
  }

  return trimmed
}
