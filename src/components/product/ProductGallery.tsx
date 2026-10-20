'use client'

import { useEffect, useRef, useState } from 'react'
import { IconChevronLeft } from '@/components/icons/DotIcons'
import { SiteImage } from '@/components/ui/SiteImage'

type ProductGalleryProps = {
  images: {
    id: string
    url: string
    thumbUrl?: string
    mediumUrl?: string
    alt: string
  }[]
  productName: string
  discountPercent: number | null
}

export function ProductGallery({ images, productName, discountPercent }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const thumbListRef = useRef<HTMLDivElement>(null)
  const active = images[activeIndex]

  useEffect(() => {
    const root = thumbListRef.current
    if (!root) return
    const thumb = root.querySelector<HTMLElement>('[aria-current="true"]')
    thumb?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeIndex])

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-sm border border-border text-sm text-text-muted">
        Sem imagem
      </div>
    )
  }

  return (
    <div>
      <div className="relative min-w-0">
        <div className="relative aspect-square overflow-hidden rounded-sm border border-border">
          {discountPercent != null && (
            <span className="absolute left-3 top-3 z-10 rounded-sm border border-claret bg-surface px-2.5 py-1 text-[12px] font-bold text-claret">
              -{discountPercent}%
            </span>
          )}

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setActiveIndex((i) => (i === 0 ? images.length - 1 : i - 1))
                }
                className="absolute left-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-sm border border-border bg-surface/95 text-text-primary shadow-[rgba(74,32,42,0.08)_0px_1px_2px_0px] transition-opacity duration-[400ms] hover:opacity-80"
                aria-label="Imagem anterior"
              >
                <IconChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveIndex((i) => (i === images.length - 1 ? 0 : i + 1))
                }
                className="absolute right-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-sm border border-border bg-surface/95 text-text-primary shadow-[rgba(74,32,42,0.08)_0px_1px_2px_0px] transition-opacity duration-[400ms] hover:opacity-80"
                aria-label="Próxima imagem"
              >
                <IconChevronLeft className="size-5 rotate-180" />
              </button>
            </>
          )}

          <SiteImage
            key={active.id}
            src={active.mediumUrl || active.url}
            alt={active.alt || productName}
            fill
            priority={activeIndex === 0}
            fetchPriority={activeIndex === 0 ? 'high' : 'auto'}
            bypassOptimizer={false}
            sizes="(max-width: 768px) 92vw, (max-width: 1024px) 50vw, 560px"
            className="object-contain p-4 md:p-6"
          />
        </div>
      </div>

      {images.length > 1 && (
        <div
          ref={thumbListRef}
          className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, index) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative size-16 shrink-0 overflow-hidden rounded-sm border transition-colors duration-[400ms] md:size-[72px] ${
                index === activeIndex
                  ? 'border-text-primary'
                  : 'border-border hover:border-text-primary/40'
              }`}
              aria-label={`Ver imagem ${index + 1}`}
              aria-current={index === activeIndex}
            >
              <SiteImage
                src={img.thumbUrl || img.url}
                alt=""
                fill
                sizes="72px"
                loading="lazy"
                bypassOptimizer={false}
                className="object-contain p-1.5"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
