'use client'

import Image, { type ImageProps } from 'next/image'

type SiteImageProps = ImageProps & {
  /** Padrão true: evita custo de Image Optimization da Vercel (arquivos já são WebP). */
  bypassOptimizer?: boolean
}

/**
 * Imagem da loja: serve o arquivo já otimizado no storage.
 * Mantém fill/priority/lazy do next/image para LCP e layout, sem /_next/image.
 */
export function SiteImage({
  bypassOptimizer = true,
  alt,
  quality: _quality,
  ...props
}: SiteImageProps) {
  return <Image {...props} alt={alt} unoptimized={bypassOptimizer} />
}
