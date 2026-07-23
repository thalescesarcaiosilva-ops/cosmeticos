import { absoluteUrl, getSiteUrl } from '@/lib/seo/site-url'

/**
 * URL canônica limpa (sem query string). Usar em listagens/coleções/busca
 * que aceitam filtros, ordenação ou UTM — o Google consolida pelo canonical,
 * não pelo robots.txt.
 */
export function getCanonicalUrl(pathname: string, siteUrl?: string | null): string {
  const base = siteUrl ?? getSiteUrl()
  const path = pathname.split('?')[0] || '/'
  return absoluteUrl(path, base) ?? ''
}
