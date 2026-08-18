'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SiteImage } from '@/components/ui/SiteImage'
import type { HomeBannerPublic } from '@/types/home-banner'

type HomeBannerCarouselProps = {
  banners: HomeBannerPublic[]
  className?: string
  variant?: 'mobile' | 'desktop'
  prioritizeFirst?: boolean
  /** Primeiro slide eager sem fetchpriority (desktop oculto no mobile + preload no head). */
  eagerFirstSlide?: boolean
}

function resolveAspectRatio(
  banners: HomeBannerPublic[],
  variant: 'mobile' | 'desktop'
): string {
  const first = banners[0]
  if (first?.width && first?.height) {
    return `${first.width} / ${first.height}`
  }
  return variant === 'mobile' ? '1080 / 1350' : '1920 / 720'
}

export function HomeBannerCarousel({
  banners,
  className = '',
  variant = 'desktop',
  prioritizeFirst = false,
  eagerFirstSlide = false,
}: HomeBannerCarouselProps) {
  const [index, setIndex] = useState(0)
  const count = banners.length
  const aspectRatio = resolveAspectRatio(banners, variant)

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
      style={{ aspectRatio }}
    >
      <div
        className="absolute inset-0 flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((banner, slideIndex) => {
          const alt = banner.alt_text?.trim() || banner.title || 'Banner promocional'
          const isPriorityLcp = prioritizeFirst && slideIndex === 0
          const isEagerFirst = eagerFirstSlide && slideIndex === 0
          const shouldLoad =
            slideIndex === index ||
            slideIndex === (index + 1) % count ||
            slideIndex === (index - 1 + count) % count ||
            isPriorityLcp ||
            isEagerFirst

          const image = shouldLoad ? (
            <SiteImage
              src={banner.image_url}
              alt={alt}
              fill
              sizes="100vw"
              priority={isPriorityLcp}
              fetchPriority={isPriorityLcp ? 'high' : 'auto'}
              {...(!isPriorityLcp && !isEagerFirst ? { loading: 'lazy' as const } : {})}
              className="object-contain object-center"
            />
          ) : null

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
