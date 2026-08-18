type ProductCardImageProps = {
  src: string
  srcSet?: string | null
  alt: string
  sizes?: string
}

/**
 * Card de produto: src canônico (Merchant) + srcSet opcional com thumb do storage.
 * Usa <img> nativo quando há srcSet — next/image com fill não expõe srcSet tipado.
 */
export function ProductCardImage({ src, srcSet, alt, sizes }: ProductCardImageProps) {
  const className =
    'absolute inset-0 h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]'

  if (srcSet) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- srcSet + src canônico sem /_next/image
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={className}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
    />
  )
}
