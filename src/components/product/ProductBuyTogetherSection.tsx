'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { IconChevronLeft } from '@/components/icons/DotIcons'
import {
  calcBundlePricing,
  filterBundlesByMaxTotal,
  type BuyTogetherBundle,
  type BuyTogetherPrimaryProduct,
} from '@/lib/products/buy-together'
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
    <div className="flex min-w-0 flex-1 flex-col gap-2.5">
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-surface-strong/60">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt ?? name}
            fill
            sizes="160px"
            className="object-contain p-2"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">
            Sem imagem
          </div>
        )}
      </div>
      <p className="line-clamp-2 text-[13px] leading-snug text-text-primary">{name}</p>
    </div>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="min-w-0 flex-1 transition-opacity duration-200 hover:opacity-80"
      >
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
  const { addItem, addBundlePair } = useCart()
  const eligibleBundles = filterBundlesByMaxTotal(primaryProduct.price, bundles)
  const [activeIndex, setActiveIndex] = useState(0)
  const [added, setAdded] = useState(false)

  if (eligibleBundles.length === 0) return null

  const safeIndex = Math.min(activeIndex, eligibleBundles.length - 1)
  const bundle = eligibleBundles[safeIndex]!
  const { originalTotal, bundlePrice } = calcBundlePricing(
    primaryProduct.price,
    bundle.companion.price,
    bundle.discountPercent
  )
  const installment = calcInstallmentDisplay(bundlePrice, paymentSettings)
  const savings = Math.max(0, originalTotal - bundlePrice)

  function goTo(index: number) {
    setActiveIndex((index + eligibleBundles.length) % eligibleBundles.length)
    setAdded(false)
  }

  function handleBuyBoth() {
    addBundlePair({
      primaryProductId: primaryProduct.id,
      companionProductId: bundle.companion.id,
      discountPercent: bundle.discountPercent,
    })
    addItem(primaryProduct.id, 1)
    addItem(bundle.companion.id, 1)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 2500)
  }

  const brandHint = primaryProduct.brandName?.trim()
  const subtitle = brandHint
    ? `Combine ${brandHint} com outro produto e ganhe um desconto exclusivo.`
    : 'Combine este produto com outro e ganhe um desconto exclusivo.'

  return (
    <section
      className="rounded-xl border border-border bg-cream/80 p-5 md:p-6"
      aria-label="Compre junto"
    >
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Oferta
          </p>
          <h2 className="mt-1 text-lg font-bold text-text-primary md:text-xl">Compre junto</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-text-secondary">{subtitle}</p>
        </div>
        {bundle.discountPercent > 0 && (
          <span className="rounded-full bg-coffee px-3 py-1 text-[12px] font-semibold text-text-on-dark">
            −{bundle.discountPercent}% no kit
          </span>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-center">
        <div className="flex items-start gap-3 md:gap-4">
          <ProductThumb
            name={primaryProduct.name}
            imageUrl={primaryProduct.imageUrl}
            imageAlt={primaryProduct.imageAlt}
          />

          <div
            className="mt-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold text-text-secondary"
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

        <div className="rounded-lg border border-border bg-surface p-4 md:p-5">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-[26px] font-bold leading-none tracking-tight text-text-primary tabular-nums">
              {formatCurrency(bundlePrice)}
            </p>
            {originalTotal > bundlePrice && (
              <p className="text-sm text-text-muted line-through tabular-nums">
                {formatCurrency(originalTotal)}
              </p>
            )}
          </div>

          {installment && (
            <p className="mt-2 text-[13px] text-text-secondary">
              ou {installment.count}x de {formatCurrency(installment.value)} no cartão
            </p>
          )}

          {savings > 0 && (
            <p className="mt-2 text-[13px] font-medium text-claret">
              Você economiza {formatCurrency(savings)}
            </p>
          )}

          <button
            type="button"
            onClick={handleBuyBoth}
            className="mt-4 w-full rounded-md bg-coffee px-5 py-3 text-sm font-bold text-text-on-dark transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.99]"
          >
            {added ? 'Adicionados ao carrinho' : 'Comprar os 2 itens'}
          </button>

          {added && (
            <Link
              href="/carrinho"
              className="mt-2.5 block text-center text-sm font-semibold text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
            >
              Ver carrinho
            </Link>
          )}
        </div>
      </div>

      {eligibleBundles.length > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3 border-t border-border/80 pt-4">
          <button
            type="button"
            onClick={() => goTo(safeIndex - 1)}
            className="flex size-8 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-strong hover:text-text-primary"
            aria-label="Sugestão anterior"
          >
            <IconChevronLeft className="size-4" />
          </button>

          <div className="flex items-center gap-1.5">
            {eligibleBundles.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(index)}
                className={
                  index === safeIndex
                    ? 'h-1.5 w-5 rounded-full bg-coffee transition-all'
                    : 'size-1.5 rounded-full bg-border transition-all hover:bg-text-muted'
                }
                aria-label={`Sugestão ${index + 1}`}
                aria-current={index === safeIndex ? 'true' : undefined}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => goTo(safeIndex + 1)}
            className="flex size-8 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-strong hover:text-text-primary"
            aria-label="Próxima sugestão"
          >
            <IconChevronLeft className="size-4 rotate-180" />
          </button>
        </div>
      )}
    </section>
  )
}
