import { toSiteMediaUrl } from '@/lib/media/public-url'

/**
 * Resolve URL de exibição (card/lista) sem alterar a URL canônica do Merchant.
 * Só infere `.thumb.webp` quando o arquivo canônico segue o padrão `.large.webp`
 * (variante gerada no upload) — evita 404 em assets legados de nome único.
 */
export function resolveThumbDisplayUrl(
  publicUrl: string | null | undefined,
  thumbUrl: string | null | undefined
): string | null {
  const thumb = toSiteMediaUrl(thumbUrl ?? null)
  if (thumb) return thumb

  const canonical = toSiteMediaUrl(publicUrl ?? null)
  if (!canonical) return null

  if (canonical.includes('.large.webp')) {
    return canonical.replace('.large.webp', '.thumb.webp')
  }

  return canonical
}

export function resolveMediumDisplayUrl(
  publicUrl: string | null | undefined,
  mediumUrl: string | null | undefined
): string | null {
  const medium = toSiteMediaUrl(mediumUrl ?? null)
  if (medium) return medium

  const canonical = toSiteMediaUrl(publicUrl ?? null)
  if (!canonical) return null

  if (canonical.includes('.large.webp')) {
    return canonical.replace('.large.webp', '.medium.webp')
  }

  return canonical
}
