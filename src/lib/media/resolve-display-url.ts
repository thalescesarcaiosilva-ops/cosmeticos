import { toSiteMediaUrl } from '@/lib/media/public-url'

/**
 * Resolve URL thumb (~400px) para cards/listas.
 * Nunca altera a URL canônica usada no feed / JSON-LD / atributo src.
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

  // Legado import/xxx.webp → import/xxx.thumb.webp (gerado pelo backfill no storage)
  if (
    /\/product-images\//.test(canonical) &&
    /\.webp$/i.test(canonical) &&
    !canonical.includes('.thumb.') &&
    !canonical.includes('.medium.')
  ) {
    return canonical.replace(/\.webp$/i, '.thumb.webp')
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

  if (
    /\/product-images\//.test(canonical) &&
    /\.webp$/i.test(canonical) &&
    !canonical.includes('.medium.') &&
    !canonical.includes('.thumb.')
  ) {
    return canonical.replace(/\.webp$/i, '.medium.webp')
  }

  return canonical
}

/** srcSet só com thumb confirmada no banco (evita 404 antes do backfill). */
export function buildProductCardSrcSet(
  canonicalUrl: string | null | undefined,
  explicitThumbUrl: string | null | undefined
): string | null {
  const canonical = toSiteMediaUrl(canonicalUrl ?? null)
  const thumb = toSiteMediaUrl(explicitThumbUrl ?? null)
  if (!canonical || !thumb || thumb === canonical) return null

  return `${thumb} 400w, ${canonical} 1000w`
}
