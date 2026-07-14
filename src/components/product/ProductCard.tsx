'use client'

import Image from 'next/image'
import Link from 'next/link'
import { IconBag } from '@/components/icons/DotIcons'
import { FavoriteButton } from '@/components/product/FavoriteButton'
import { InstallmentLine } from '@/components/product/InstallmentLine'
import { calcDiscountPercent, formatCurrency } from '@/lib/products/format'
import type { InstallmentDisplay } from '@/types/payment'
import type { ProductCardData } from '@/types/product'

type ProductCardProps = {
  product: ProductCardData
  installment?: InstallmentDisplay | null
}

export function ProductCard({ product, installment }: ProductCardProps) {
  const discount = calcDiscountPercent(product.price, product.originalPrice)
  const hasDiscount = product.originalPrice != null && product.originalPrice > product.price
  const productHref = `/produto/${product.slug}`

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface  transition-shadow hover:shadow-md">
      <div className="relative aspect-square bg-white">
        <Link href={productHref} className="relative block h-full w-full">
          {discount != null && (
            <span className="absolute left-2 top-2 z-10 rounded-md bg-[#FFC107] px-2 py-0.5 text-[11px] font-bold text-text-primary">
              -{discount}%
            </span>
          )}
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt ?? product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              quality={70}
              className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-text-muted">
              Sem imagem
            </div>
          )}
        </Link>

        <FavoriteButton productId={product.id} className="absolute right-2 top-2 z-10" />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {product.brandName && (
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-primary md:text-xs">
            {product.brandName}
          </p>
        )}

        <Link href={productHref} className="block min-h-[2.5rem]">
          <h3 className="line-clamp-2 text-[13px] leading-snug text-text-primary md:text-sm">
            {product.name}
          </h3>
        </Link>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="min-w-0 flex-1 space-y-0.5">
            {hasDiscount && (
              <p className="text-xs text-text-muted line-through">
                {formatCurrency(product.originalPrice!)}
              </p>
            )}
            <p className="text-base font-bold text-brand md:text-lg ">
              {formatCurrency(product.price)}
            </p>
            <InstallmentLine display={installment ?? null} />
          </div>

          <Link
            href={productHref}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition hover:opacity-90"
            aria-label={`Ver ${product.name}`}
          >
            <IconBag className="size-5" />
          </Link>
        </div>
      </div>
    </article>
  )
}
