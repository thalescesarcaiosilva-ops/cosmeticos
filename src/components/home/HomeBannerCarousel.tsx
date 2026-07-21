'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { HomeBannerPublic } from '@/types/home-banner'

type HomeBannerCarouselProps = {
  banners: HomeBannerPublic[]
  className?: string
  /** Só o carrossel visível no viewport LCP deve ser true (evita preload duplo mobile+desktop). */
  prioritizeFirst?: boolean
}

export function HomeBannerCarousel({
  banners,
  className = '',
  prioritizeFirst = false,
}: HomeBannerCarouselProps) {
  const [index, setIndex] = useState(0)
  const count = banners.length
  const ratioW = banners[0]?.width ?? 1920
  const ratioH = banners[0]?.height ?? 720

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
      style={{ aspectRatio: `${ratioW} / ${ratioH}` }}
    >
      {/* Track absoluto: cada slide ocupa 100% da largura do viewport do carrossel */}
      <div
        className="absolute inset-0 flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((banner, slideIndex) => {
          const alt = banner.alt_text?.trim() || banner.title || 'Banner promocional'
          const isLcp = prioritizeFirst && slideIndex === 0

          const image = (
            <Image
              src={banner.image_url}
              alt={alt}
              fill
              sizes="100vw"
              quality={75}
              priority={isLcp}
              fetchPriority={isLcp ? 'high' : 'auto'}
              {...(!isLcp ? { loading: 'lazy' as const } : {})}
              className="object-cover object-center"
            />
          )

          const slideClass =
            'relative h-full w-full min-w-full shrink-0 basis-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

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
            <div
              key={banner.id}
              className={slideClass}
              aria-hidden={slideIndex !== index}
            >
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
