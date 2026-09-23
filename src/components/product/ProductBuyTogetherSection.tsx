'use client'

import { SiteImage } from '@/components/ui/SiteImage'
import Link from 'next/link' // usado em ProductThumb para link do produto acompanhante
import { useState } from 'react'
import { CreditCard } from 'lucide-react'
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
  price,
  imageUrl,
  imageAlt,
  href,
  compact,
  caption,
}: {
  name: string
  /** Preço unitário do produto — exibido abaixo do nome. */
  price: number
  imageUrl: string | null
  imageAlt: string | null
  href?: string
  compact?: boolean
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
      </div>
      <p
        className={`line-clamp-2 leading-snug text-text-primary ${compact ? 'text-[11px]' : 'text-[13px]'}`}
      >
        {name}
      </p>
      <p
        className={`font-semibold tabular-nums text-text-secondary ${compact ? 'text-[11px]' : 'text-[12px]'}`}
      >
        {formatCurrency(price)}
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
  // Economia do Compre junto = só o desconto do combo (não mistura com Pix).
  const savings = Math.max(0, originalTotal - bundlePrice)

  // Desconto Pix sobre o preço já com desconto do combo — igual ao checkout.
  const pixEnabled = checkoutSettings?.pixEnabled !== false
  const pixDiscountPercent = pixEnabled ? Math.max(0, Number(checkoutSettings?.pixDiscount) || 0) : 0
  const showPix = pixDiscountPercent > 0
  const pixBundlePrice = showPix ? calcPixPrice(bundlePrice, pixDiscountPercent) : bundlePrice
  // Economia total vs separado pagando no Pix (combo + Pix) — valor real no checkout.
  const pixSavings = Math.max(0, originalTotal - pixBundlePrice)

  const installment = calcInstallmentDisplay(bundlePrice, paymentSettings)
  const cardEnabled = checkoutSettings?.cardEnabled !== false
  const showInstallments =
    cardEnabled && installment != null && installment.count > 1

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

      <header className={compact ? 'mb-3' : 'mb-4 border-b border-border/80 pb-3'}>
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
        {bundle.discountPercent > 0 && (
          <p
            className={`bt-subtitle mt-1 leading-snug text-text-secondary ${compact ? 'text-[12px]' : 'text-sm'}`}
            style={{ color: cssVars['--bt-subtitle'] || undefined }}
          >
            Compre junto e ganhe{' '}
            <span className="font-bold text-claret">{bundle.discountPercent}% de desconto</span>
          </p>
        )}
      </header>

      <div className="rounded-lg bg-surface/60 p-3">
        <div className="flex items-start gap-2">
          <ProductThumb
            name={primaryProduct.name}
            price={primaryProduct.price}
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
            price={bundle.companion.price}
            imageUrl={bundle.companion.imageUrl}
            imageAlt={bundle.companion.imageAlt}
            href={`/produto/${bundle.companion.slug}`}
            compact={compact}
            caption="Sugestão"
          />
        </div>

        {/* Hierarquia igual à do produto: referência → Pix (destaque) → cartão → parcelas → economia */}
        <div className={`border-t border-dashed border-border ${compact ? 'mt-3 pt-3' : 'mt-4 pt-4'}`}>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[13px] font-semibold text-text-secondary">
              Comprando separado
            </span>
            <span
              className={`font-bold tabular-nums text-text-muted line-through ${compact ? 'text-[15px]' : 'text-[16px]'}`}
            >
              {formatCurrency(originalTotal)}
            </span>
          </div>

          {showPix ? (
            <div
              className="mt-2 flex flex-wrap items-end gap-x-2 gap-y-1"
              aria-label={`Pix com ${pixDiscountPercent}% de desconto: ${formatCurrency(pixBundlePrice)}`}
            >
              <span
                className={`bt-price flex items-center gap-1.5 font-black leading-none tracking-tight text-claret tabular-nums ${compact ? 'text-[22px]' : 'text-[26px]'}`}
                style={{ color: cssVars['--bt-price'] || undefined }}
              >
                <PixIcon className="size-5 shrink-0" />
                {formatCurrency(pixBundlePrice)}
              </span>
              <span className="rounded-md bg-claret/10 px-2 py-0.5 text-[11px] font-bold text-claret">
                no Pix
              </span>
            </div>
          ) : null}

          <p
            className={
              showPix
                ? 'mt-1.5 text-[15px] font-medium leading-none text-text-secondary tabular-nums'
                : `bt-price mt-1.5 font-bold leading-none tracking-tight text-text-primary tabular-nums ${compact ? 'text-[20px]' : 'text-[24px]'}`
            }
            style={!showPix ? { color: cssVars['--bt-price'] || undefined } : undefined}
            aria-label={`Comprando junto: ${formatCurrency(bundlePrice)}`}
          >
            {formatCurrency(bundlePrice)}
            {showPix ? (
              <span className="ml-1.5 text-[12px] font-medium text-text-muted">no cartão</span>
            ) : null}
          </p>

          {showInstallments && installment && (
            <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-text-secondary">
              <CreditCard className="mt-0.5 size-3.5 shrink-0 text-text-muted" aria-hidden />
              <span>
                ou{' '}
                <span className="font-semibold text-text-primary tabular-nums">
                  {formatCurrency(installment.interestFree ? bundlePrice : installment.total)}
                </span>{' '}
                em até{' '}
                <span className="font-semibold text-text-primary">
                  {installment.count}x de {formatCurrency(installment.value)}
                </span>{' '}
                {installment.interestFree ? 'sem juros' : 'com juros'} no cartão
              </span>
            </p>
          )}

          {savings > 0 && (
            <p
              className="bt-savings mt-2 text-[12px] font-semibold text-claret"
              style={{ color: cssVars['--bt-savings'] || undefined }}
            >
              Economize {formatCurrency(savings)} comprando os dois juntos
              {showPix && pixSavings > savings
                ? ` · até ${formatCurrency(pixSavings)} no Pix`
                : ''}
            </p>
          )}

          <p className="mt-1 text-[10px] leading-snug text-text-muted">
            Valores dos produtos, sem frete.
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
