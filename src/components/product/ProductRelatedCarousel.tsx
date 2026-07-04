'use client'

import { useRef } from 'react'
import { IconChevronLeft } from '@/components/icons/DotIcons'
import { ProductCard } from '@/components/product/ProductCard'
import type { InstallmentDisplay } from '@/types/payment'
import type { ProductCardData } from '@/types/product'

type ProductRelatedCarouselProps = {
  products: ProductCardData[]
  installments: Map<string, InstallmentDisplay | null>
}

export function ProductRelatedCarousel({ products, installments }: ProductRelatedCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (products.length === 0) return null

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-carousel-item]')
    const step = card ? card.offsetWidth + 12 : el.clientWidth * 0.8
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' })
  }

  return (
    <section className="mt-12 overflow-hidden border-t border-border pt-10" aria-label="Produtos relacionados">
      <h2 className="mb-6 text-center text-xl font-bold text-text-primary md:text-2xl">
        Produtos relacionados
      </h2>

      <div className="relative">
        <button
          type="button"
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white shadow-md transition-opacity hover:opacity-90 md:flex"
          aria-label="Produtos anteriores"
        >
          <IconChevronLeft className="size-5" />
        </button>

        <button
          type="button"
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white shadow-md transition-opacity hover:opacity-90 md:flex"
          aria-label="Próximos produtos"
        >
          <IconChevronLeft className="size-5 rotate-180" />
        </button>

        <div className="overflow-hidden px-0 md:px-10">
          <div
            ref={scrollRef}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-4"
          >
            {products.map((product) => (
              <div
                key={product.id}
                data-carousel-item
                className="w-[calc(50%-6px)] shrink-0 snap-start sm:w-[calc(33.333%-11px)] md:w-[calc(25%-12px)] lg:w-[calc(20%-13px)]"
              >
                <ProductCard
                  product={product}
                  installment={installments.get(product.id) ?? null}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
