'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { IconChevronLeft } from '@/components/icons/DotIcons'
import { calcBundlePricing, type BuyTogetherBundle, type BuyTogetherPrimaryProduct } from '@/lib/products/buy-together'
import { formatCurrency } from '@/lib/products/format'
import { calcInstallmentDisplay } from '@/lib/payment/installments'
import { useCart } from '@/providers/CartProvider'
import type { PaymentSettings } from '@/types/payment'

type ProductBuyTogetherSectionProps = {
  primaryProduct: BuyTogetherPrimaryProduct
  bundles: BuyTogetherBundle[]
  paymentSettings: PaymentSettings
}

function ProductThumb({
  name,
  imageUrl,
  imageAlt,
  href,
}: {
  name: string
  imageUrl: string | null
  imageAlt: string | null
  href?: string
}) {
  const content = (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <div className="relative aspect-square w-full max-w-[140px]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt ?? name}
            fill
            sizes="140px"
            className="object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-sm bg-surface-strong text-xs text-text-muted">
            Sem imagem
          </div>
        )}
      </div>
      <p className="line-clamp-2 w-full text-left text-[12px] leading-snug text-text-primary">
        {name}
      </p>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="min-w-0 flex-1 transition-opacity hover:opacity-80">
        {content}
      </Link>
    )
  }

  return content
}

export function ProductBuyTogetherSection({
  primaryProduct,
  bundles,
  paymentSettings,
}: ProductBuyTogetherSectionProps) {
  const { addItem } = useCart()
  const [activeIndex, setActiveIndex] = useState(0)
  const [added, setAdded] = useState(false)

  if (bundles.length === 0) return null

  const bundle = bundles[activeIndex] ?? bundles[0]
  const { originalTotal, bundlePrice } = calcBundlePricing(
    primaryProduct.price,
    bundle.companion.price,
    bundle.discountPercent
  )
  const installment = calcInstallmentDisplay(bundlePrice, paymentSettings)

  function goTo(index: number) {
    setActiveIndex((index + bundles.length) % bundles.length)
    setAdded(false)
  }

  function handleBuyBoth() {
    addItem(primaryProduct.id, 1)
    addItem(bundle.companion.id, 1)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 2500)
  }

  const brandHint = primaryProduct.brandName?.trim()
  const subtitle = brandHint
    ? `Aproveite e combine seu ${brandHint} com outros produtos.`
    : 'Aproveite e combine este produto com outros da loja.'

  return (
    <section
      className="rounded-xl bg-surface-strong p-4"
      aria-label="Compre junto"
    >
      <header className="mb-4">
        <h2 className="text-[17px] font-bold text-text-primary">Compre Junto</h2>
        <p className="mt-1 text-[13px] leading-snug text-text-secondary">{subtitle}</p>
      </header>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start gap-3">
          <ProductThumb
            name={primaryProduct.name}
            imageUrl={primaryProduct.imageUrl}
            imageAlt={primaryProduct.imageAlt}
          />

          <div
            className="flex size-7 shrink-0 items-center justify-center self-center rounded-full border border-border text-sm font-bold text-text-secondary"
            aria-hidden
          >
            +
          </div>

          <ProductThumb
            name={bundle.companion.name}
            imageUrl={bundle.companion.imageUrl}
            imageAlt={bundle.companion.imageAlt}
            href={`/produto/${bundle.companion.slug}`}
          />
        </div>

        <div className="my-4 border-t border-dashed border-border" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="text-[22px] font-bold leading-none text-text-primary">
                {formatCurrency(bundlePrice)}
              </p>
              {originalTotal > bundlePrice && (
                <p className="text-[14px] text-text-muted line-through">
                  {formatCurrency(originalTotal)}
                </p>
              )}
            </div>
            {installment && (
              <p className="mt-1.5 text-[13px] text-text-secondary">
                {installment.count}x de {formatCurrency(installment.value)} no cartão
              </p>
            )}
            {bundle.discountPercent > 0 && (
              <p className="mt-1 text-[12px] font-medium text-brand">
                Economize {bundle.discountPercent}% comprando os 2 juntos
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleBuyBoth}
            className="shrink-0 rounded-sm bg-brand px-5 py-3 text-sm font-bold text-white transition-opacity duration-[400ms] hover:opacity-90"
          >
            {added ? 'Adicionados!' : 'Comprar os 2 itens'}
          </button>
        </div>
      </div>

      {bundles.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            className="flex size-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
            aria-label="Sugestão anterior"
          >
            <IconChevronLeft className="size-4" />
          </button>

          <div className="flex items-center gap-2">
            {bundles.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(index)}
                className={
                  index === activeIndex
                    ? 'h-1.5 w-6 rounded-full bg-brand transition-all'
                    : 'size-1.5 rounded-full bg-text-muted/40 transition-all hover:bg-text-muted/70'
                }
                aria-label={`Sugestão ${index + 1}`}
                aria-current={index === activeIndex ? 'true' : undefined}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            className="flex size-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
            aria-label="Próxima sugestão"
          >
            <IconChevronLeft className="size-4 rotate-180" />
          </button>
        </div>
      )}

      {added && (
        <Link
          href="/carrinho"
          className="mt-3 block text-center text-sm font-bold text-brand hover:underline"
        >
          Ver carrinho
        </Link>
      )}
    </section>
  )
}
