'use client'

import { SiteImage } from '@/components/ui/SiteImage'
import Link from 'next/link' // usado em ProductThumb para link do produto acompanhante
import { useState } from 'react'
import { IconChevronLeft } from '@/components/icons/DotIcons'
import {
  calcBundlePricing,
  filterBundlesByMaxTotal,
  type BuyTogetherBundle,
  type BuyTogetherPrimaryProduct,
} from '@/lib/products/buy-together'
import {
  buildBuyTogetherCssVars,
  sanitizeBuyTogetherCustomCss,
} from '@/lib/products/buy-together-css'
import { formatCurrency } from '@/lib/products/format'
import { calcInstallmentDisplay } from '@/lib/payment/installments'
import { calcPixPrice } from '@/lib/payment/product-payment-summary'
import { PixIcon } from '@/components/product/PixDiscountBadge'
import { useCart } from '@/providers/CartProvider'
import type { CheckoutPaymentSettings, PaymentSettings } from '@/types/payment'
import type { BuyTogetherSettings } from '@/types/buy-together-settings'

type ProductBuyTogetherSectionProps = {
  primaryProduct: BuyTogetherPrimaryProduct
  bundles: BuyTogetherBundle[]
  paymentSettings: PaymentSettings
  checkoutSettings?: CheckoutPaymentSettings | null
  settings: BuyTogetherSettings
  compact?: boolean
}

function ProductThumb({
  name,
  imageUrl,
  imageAlt,
  href,
  compact,
  badgeLabel,
  caption,
}: {
  name: string
  imageUrl: string | null
  imageAlt: string | null
  href?: string
  compact?: boolean
  /** Selo curto e verídico (ex.: "Mais vendido") — só exibido quando comprovado. */
  badgeLabel?: string | null
  /** Legenda pequena acima da imagem, ex.: "Este produto" / "Sugestão". */
  caption?: string
}) {
  const content = (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      {caption && (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {caption}
        </p>
      )}
      <div
        className={`relative aspect-square w-full overflow-hidden rounded-lg border border-border/70 bg-white ${compact ? 'max-w-none' : 'max-w-[140px]'}`}
      >
        {imageUrl ? (
          <SiteImage
            src={imageUrl}
            alt={imageAlt ?? name}
            fill
            sizes={compact ? '120px' : '160px'}
            className="object-contain p-2"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">
            Sem imagem
          </div>
        )}
        {badgeLabel && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-text-primary/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
            {badgeLabel}
          </span>
        )}
      </div>
      <p
        className={`line-clamp-2 leading-snug text-text-primary ${compact ? 'text-[11px]' : 'text-[13px]'}`}
      >
        {name}
      </p>
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
  checkoutSettings,
  settings,
  compact = false,
}: ProductBuyTogetherSectionProps) {
  const { addItem, addBundlePair, openCartDrawer } = useCart()
  const eligibleBundles = filterBundlesByMaxTotal(
    primaryProduct.price,
    bundles,
    settings.maxBundleTotal
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const [added, setAdded] = useState(false)

  if (!settings.enabled || eligibleBundles.length === 0) return null

  const safeIndex = Math.min(activeIndex, eligibleBundles.length - 1)
  const bundle = eligibleBundles[safeIndex]!
  const { originalTotal, bundlePrice } = calcBundlePricing(
    primaryProduct.price,
    bundle.companion.price,
    bundle.discountPercent
  )
  const installment = calcInstallmentDisplay(bundlePrice, paymentSettings)
  const savings = Math.max(0, originalTotal - bundlePrice)

  // Desconto Pix (mesma % configurada no checkout) aplicado sobre o preço já
  // reduzido do combo — mesma lógica usada no preço de um produto único, e é
  // exatamente o que o checkout cobra (sem frete, calculado só no carrinho).
  const pixEnabled = checkoutSettings?.pixEnabled !== false
  const pixDiscountPercent = pixEnabled ? Math.max(0, Number(checkoutSettings?.pixDiscount) || 0) : 0
  const showPix = pixDiscountPercent > 0
  const pixBundlePrice = showPix ? calcPixPrice(bundlePrice, pixDiscountPercent) : bundlePrice
  const pixSavings = Math.max(0, originalTotal - pixBundlePrice)

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
    openCartDrawer()
    window.setTimeout(() => setAdded(false), 2500)
  }

  const brandHint = primaryProduct.brandName?.trim()
  const subtitle = brandHint
    ? `Combine ${brandHint} com outro produto.`
    : settings.subtitleFallback

  const cssVars = buildBuyTogetherCssVars(settings.css)
  const customCss = sanitizeBuyTogetherCustomCss(settings.css.customCss)

  return (
    <section
      className={`buy-together-block rounded-xl border border-border bg-cream/80 ${compact ? 'p-3.5' : 'p-5 md:p-6'}`}
      aria-label={settings.title}
      style={{
        ...cssVars,
        background: cssVars['--bt-bg'] || undefined,
        borderColor: cssVars['--bt-border'] || undefined,
        borderRadius: cssVars['--bt-radius'] || undefined,
      }}
    >
      {customCss ? <style>{customCss}</style> : null}

      <header
        className={`flex items-start justify-between gap-2 ${compact ? 'mb-3' : 'mb-5 border-b border-border/80 pb-4'}`}
      >
        <div className="min-w-0">
          {!compact && settings.eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {settings.eyebrow}
            </p>
          )}
          <h2
            className={`bt-title font-bold text-text-primary ${compact ? 'text-[15px]' : 'mt-1 text-lg md:text-xl'}`}
            style={{ color: cssVars['--bt-title'] || undefined }}
          >
            {settings.title}
          </h2>
          <p
            className={`bt-subtitle mt-0.5 leading-snug text-text-secondary ${compact ? 'text-[12px]' : 'text-sm'}`}
            style={{ color: cssVars['--bt-subtitle'] || undefined }}
          >
            {subtitle}
          </p>
          <p className="mt-1 text-[12px] font-semibold text-text-primary">
            Compre junto e ganhe {bundle.discountPercent}% de desconto na sua compra
          </p>
        </div>
        {bundle.discountPercent > 0 && (
          <span
            className="bt-badge shrink-0 rounded-full bg-coffee px-2.5 py-1 text-[11px] font-semibold text-text-on-dark"
            style={{
              background: cssVars['--bt-badge-bg'] || undefined,
              color: cssVars['--bt-badge-text'] || undefined,
            }}
          >
            −{bundle.discountPercent}%
          </span>
        )}
      </header>

      <div className="rounded-lg bg-surface/60 p-3">
        <div className="flex items-start gap-2">
          <ProductThumb
            name={primaryProduct.name}
            imageUrl={primaryProduct.imageUrl}
            imageAlt={primaryProduct.imageAlt}
            compact={compact}
            caption="Este produto"
          />

          <div
            className={`flex shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold text-text-secondary ${compact ? 'mt-8 size-6' : 'mt-10 size-8'}`}
            aria-hidden
          >
            +
          </div>

          <ProductThumb
            name={bundle.companion.name}
            imageUrl={bundle.companion.imageUrl}
            imageAlt={bundle.companion.imageAlt}
            href={`/produto/${bundle.companion.slug}`}
            compact={compact}
            caption="Sugestão"
            badgeLabel={bundle.companionIsBestSeller ? 'Mais vendido' : null}
          />
        </div>

        <div className={`border-t border-dashed border-border ${compact ? 'mt-3 pt-3' : 'mt-4 pt-4'}`}>
          <div className="flex items-baseline justify-between gap-2 text-[12px] text-text-secondary">
            <span>Comprando separado</span>
            <span className="text-text-muted line-through tabular-nums">
              {formatCurrency(originalTotal)}
            </span>
          </div>

          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-text-secondary">
              No compre junto{showPix ? ' (cartão / à vista)' : ''}
            </span>
            <p
              className={`bt-price font-bold leading-none tracking-tight text-text-primary tabular-nums ${compact ? 'text-[18px]' : 'text-[22px]'}`}
              style={{ color: cssVars['--bt-price'] || undefined }}
            >
              {formatCurrency(bundlePrice)}
            </p>
          </div>

          {showPix && (
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded-md bg-claret/5 px-2.5 py-1.5">
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-claret">
                <PixIcon className="size-4 shrink-0" />
                No Pix (mais {pixDiscountPercent}% de desconto)
              </span>
              <span
                className={`font-black tabular-nums text-claret ${compact ? 'text-[20px]' : 'text-[24px]'}`}
                style={{ color: cssVars['--bt-price'] || undefined }}
              >
                {formatCurrency(pixBundlePrice)}
              </span>
            </div>
          )}

          {installment && (
            <p className="mt-1.5 text-[12px] text-text-secondary">
              ou {installment.count}x de {formatCurrency(installment.value)} no cartão
            </p>
          )}

          {savings > 0 && (
            <p
              className="bt-savings mt-1.5 text-[12px] font-medium text-claret"
              style={{ color: cssVars['--bt-savings'] || undefined }}
            >
              Economize {formatCurrency(savings)} comprando os dois juntos
              {showPix && pixSavings > savings
                ? ` (até ${formatCurrency(pixSavings)} pagando no Pix)`
                : ''}
            </p>
          )}

          <p className="mt-1 text-[10px] leading-snug text-text-muted">
            Valores dos produtos, sem frete. O frete é calculado no carrinho e cobrado à parte.
          </p>

          <button
            type="button"
            onClick={handleBuyBoth}
            className="bt-cta mt-3 w-full rounded-md bg-coffee px-4 py-2.5 text-sm font-bold text-text-on-dark transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.99]"
            style={{
              background: cssVars['--bt-btn-bg'] || undefined,
              color: cssVars['--bt-btn-text'] || undefined,
            }}
          >
            {added ? settings.ctaAddedLabel : settings.ctaLabel}
          </button>

          {added && (
            <p className="mt-2 text-center text-[12px] font-semibold text-success">
              ✓ Adicionados ao carrinho
            </p>
          )}
        </div>
      </div>

      {eligibleBundles.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => goTo(safeIndex - 1)}
            className="flex size-7 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-strong hover:text-text-primary"
            aria-label="Sugestão anterior"
          >
            <IconChevronLeft className="size-3.5" />
          </button>

          <div className="flex items-center gap-1.5">
            {eligibleBundles.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(index)}
                className={
                  index === safeIndex
                    ? 'h-1.5 w-4 rounded-full bg-coffee transition-all'
                    : 'size-1.5 rounded-full bg-border transition-all hover:bg-text-muted'
                }
                style={
                  index === safeIndex && cssVars['--bt-btn-bg']
                    ? { background: cssVars['--bt-btn-bg'] }
                    : undefined
                }
                aria-label={`Sugestão ${index + 1}`}
                aria-current={index === safeIndex ? 'true' : undefined}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => goTo(safeIndex + 1)}
            className="flex size-7 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-strong hover:text-text-primary"
            aria-label="Próxima sugestão"
          >
            <IconChevronLeft className="size-3.5 rotate-180" />
          </button>
        </div>
      )}
    </section>
  )
}
