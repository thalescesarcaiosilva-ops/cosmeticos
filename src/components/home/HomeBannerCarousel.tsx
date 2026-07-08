'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { HomeBannerPublic } from '@/types/home-banner'

type HomeBannerCarouselProps = {
  banners: HomeBannerPublic[]
  className?: string
}

export function HomeBannerCarousel({ banners, className = '' }: HomeBannerCarouselProps) {
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
      className={`relative w-full overflow-hidden bg-transparent ${className}`}
      aria-label="Destaques da loja"
      aria-roledescription="carrossel"
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((banner, slideIndex) => {
          const alt = banner.alt_text?.trim() || banner.title || 'Banner promocional'
          const isFirst = slideIndex === 0
          const aspectStyle =
            banner.width && banner.height
              ? { aspectRatio: `${banner.width} / ${banner.height}` }
              : undefined

          const image = (
            <Image
              src={banner.image_url}
              alt={alt}
              width={banner.width ?? 1920}
              height={banner.height ?? 720}
              sizes="100vw"
              quality={80}
              priority={isFirst}
              fetchPriority={isFirst ? 'high' : 'auto'}
              className="block h-full w-full object-cover"
              style={aspectStyle}
            />
          )

          const slide = (
            <div
              key={banner.id}
              className="relative w-full shrink-0"
              style={aspectStyle ?? { aspectRatio: '21 / 9' }}
              aria-hidden={slideIndex !== index}
            >
              {image}
            </div>
          )

          return banner.link_href ? (
            <Link
              key={banner.id}
              href={banner.link_href}
              className="relative block w-full shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              style={aspectStyle ?? { aspectRatio: '21 / 9' }}
              aria-label={alt}
              tabIndex={slideIndex === index ? 0 : -1}
            >
              {image}
            </Link>
          ) : (
            slide
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
