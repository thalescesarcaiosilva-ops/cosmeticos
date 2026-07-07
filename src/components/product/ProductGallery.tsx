'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { IconChevronLeft } from '@/components/icons/DotIcons'

const THUMB_SIZE = 72
const THUMB_GAP = 8
const VISIBLE_THUMBS = 4

type ProductGalleryProps = {
  images: { id: string; url: string; alt: string }[]
  productName: string
  discountPercent: number | null
}

export function ProductGallery({ images, productName, discountPercent }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const thumbListRef = useRef<HTMLDivElement>(null)
  const active = images[activeIndex]
  const thumbViewportHeight = VISIBLE_THUMBS * THUMB_SIZE + (VISIBLE_THUMBS - 1) * THUMB_GAP

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-sm border border-border text-sm text-text-muted">
        Sem imagem
      </div>
    )
  }

  function scrollThumbs(direction: 'down' | 'up') {
    const el = thumbListRef.current
    if (!el) return
    const step = THUMB_SIZE + THUMB_GAP
    el.scrollBy({ top: direction === 'down' ? step : -step, behavior: 'smooth' })
  }

  return (
    <div className="flex gap-3 md:gap-4">
      {images.length > 1 && (
        <div className="flex w-[72px] shrink-0 flex-col">
          <div
            ref={thumbListRef}
            className="flex flex-col gap-2 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ maxHeight: thumbViewportHeight }}
          >
            {images.map((img, index) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`relative size-[72px] shrink-0 overflow-hidden rounded-sm border transition-colors duration-[400ms] ${
                  index === activeIndex
                    ? 'border-text-primary'
                    : 'border-border hover:border-text-primary/40'
                }`}
                aria-label={`Ver imagem ${index + 1}`}
                aria-current={index === activeIndex}
              >
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="72px"
                  loading="lazy"
                  className="object-contain p-1.5"
                />
              </button>
            ))}
          </div>
          {images.length > VISIBLE_THUMBS && (
            <button
              type="button"
              onClick={() => scrollThumbs('down')}
              className="mt-2 flex size-9 items-center justify-center self-center rounded-sm border border-border bg-surface text-text-primary transition-opacity duration-[400ms] hover:opacity-80"
              aria-label="Ver mais miniaturas"
            >
              <ChevronDown className="size-5" aria-hidden />
            </button>
          )}
        </div>
      )}

      <div className="relative min-w-0 flex-1">
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

          <Image
            key={active.id}
            src={active.url}
            alt={active.alt || productName}
            fill
            priority={activeIndex === 0}
            fetchPriority={activeIndex === 0 ? 'high' : 'auto'}
            sizes="(max-width: 768px) 88vw, (max-width: 1024px) 50vw, 560px"
            className="object-contain p-4 md:p-6"
          />
        </div>

        {images.length > 1 && (
          <div className="mt-3 flex justify-center gap-2">
            {images.map((img, index) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`size-2 rounded-full transition-colors duration-[400ms] ${
                  index === activeIndex ? 'bg-text-primary' : 'bg-border hover:bg-text-muted'
                }`}
                aria-label={`Ir para imagem ${index + 1}`}
                aria-current={index === activeIndex}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
