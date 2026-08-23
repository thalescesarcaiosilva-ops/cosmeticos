'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { HomeBannerPublic } from '@/types/home-banner'

type HomeBannerCarouselProps = {
  banners: HomeBannerPublic[]
  className?: string
  variant?: 'mobile' | 'desktop'
  /** Primeiro slide eager + fetchPriority high (candidato a LCP neste carrossel). */
  prioritizeFirst?: boolean
}

/**
 * Carrossel fluido: a imagem define a altura (`width: 100%` + `height: auto`).
 * width/height no <img> são só metadados intrínsecos (CLS) — não limitam o tamanho na tela.
 */
export function HomeBannerCarousel({
  banners,
  className = '',
  prioritizeFirst = false,
}: HomeBannerCarouselProps) {
  // `variant` fica na API para o ResponsiveHomeBanners (mobile/desktop CSS),
  // mas o layout é o mesmo: imagem 100% de largura, altura automática.
  const [index, setIndex] = useState(0)
  const count = banners.length

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return
      setIndex(((next % count) + count) % count)
    },
    [count]
  )

  useEffect(() => {
    if (count <= 1) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [count])

  if (count === 0) return null

  return (
    <section
      className={`home-banner-carousel relative w-full overflow-hidden bg-surface-muted ${className}`}
      aria-label="Destaques da loja"
      aria-roledescription="carrossel"
    >
      <div
        className="flex w-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((banner, slideIndex) => {
          const alt = banner.alt_text?.trim() || banner.title || 'Banner promocional'
          const isLcp = prioritizeFirst && slideIndex === 0
          const slideClass =
            'relative w-full min-w-full shrink-0 basis-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

          const image = (
            // eslint-disable-next-line @next/next/no-img-element -- banner no HTML do SSR para o bot; sem /_next/image
            <img
              src={banner.image_url}
              alt={alt}
              width={banner.width ?? undefined}
              height={banner.height ?? undefined}
              fetchPriority={isLcp ? 'high' : 'auto'}
              loading={isLcp ? 'eager' : 'lazy'}
              decoding={isLcp ? 'async' : 'async'}
              className="block h-auto w-full max-w-full"
            />
          )

          return banner.link_href ? (
            <Link
              key={banner.id}
              href={banner.link_href}
              className={slideClass}
              aria-label={alt}
              tabIndex={slideIndex === index ? 0 : -1}
            >
              {image}
            </Link>
          ) : (
            <div key={banner.id} className={slideClass} aria-hidden={slideIndex !== index}>
              {image}
            </div>
          )
        })}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/55 md:flex"
            aria-label="Banner anterior"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/55 md:flex"
            aria-label="Próximo banner"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>

          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {banners.map((banner, dotIndex) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => goTo(dotIndex)}
                className={`size-2.5 rounded-full transition ${
                  dotIndex === index ? 'bg-white' : 'bg-white/50 hover:bg-white/75'
                }`}
                aria-label={`Ir para banner ${dotIndex + 1}`}
                aria-current={dotIndex === index}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
