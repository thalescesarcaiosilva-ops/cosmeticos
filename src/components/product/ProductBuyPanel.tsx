'use client'

import { Truck } from 'lucide-react'
import { ProductBuyTogetherSection } from '@/components/product/ProductBuyTogetherSection'
import { ProductPricingBlock } from '@/components/product/ProductPricingBlock'
import { ProductPurchaseBar } from '@/components/product/ProductPurchaseBar'
import { ProductPurchaseFaq } from '@/components/product/ProductPurchaseFaq'
import { ProductTrustSignals } from '@/components/product/ProductTrustSignals'
import { ShippingCalculator } from '@/components/shipping/ShippingCalculator'
import type { BuyTogetherBundle, BuyTogetherPrimaryProduct } from '@/lib/products/buy-together'
import type { CheckoutPaymentSettings, PaymentSettings } from '@/types/payment'
import type { BuyTogetherSettings } from '@/types/buy-together-settings'
import type { ProductPurchaseAssurances } from '@/types/product-assurances'

function formatSizeLabel(label: string) {
  return label
    .trim()
    .replace(/\bml\b/gi, 'mL')
    .replace(/\bkg\b/gi, 'kg')
    .replace(/\bg\b/gi, 'g')
}

type ProductBuyPanelProps = {
  productId: string
  productName: string
  imageUrl?: string | null
  imageAlt?: string
  stock: number
  sizeLabel?: string | null
  price: number
  originalPrice: number | null
  paymentSettings: PaymentSettings
  checkoutSettings: CheckoutPaymentSettings
  assurances: ProductPurchaseAssurances
  buyTogetherPrimary?: BuyTogetherPrimaryProduct | null
  buyTogetherBundles?: BuyTogetherBundle[]
  buyTogetherSettings?: BuyTogetherSettings | null
}

export function ProductBuyPanel({
  productId,
  productName,
  imageUrl,
  imageAlt,
  stock,
  sizeLabel = null,
  price,
  originalPrice,
  paymentSettings,
  checkoutSettings,
  assurances,
  buyTogetherPrimary = null,
  buyTogetherBundles = [],
  buyTogetherSettings = null,
}: ProductBuyPanelProps) {
  const showBuyTogether =
    Boolean(buyTogetherSettings?.enabled) &&
    Boolean(buyTogetherPrimary) &&
    buyTogetherBundles.length > 0

  return (
    <div className="space-y-5">
      <ProductPricingBlock
        price={price}
        originalPrice={originalPrice}
        paymentSettings={paymentSettings}
        checkoutSettings={checkoutSettings}
      />

      {stock > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-surface-strong px-4 py-3 text-[13px]">
          <Truck className="size-5 shrink-0 text-brand" aria-hidden />
          <span className="font-bold tracking-wide text-brand">PRONTA ENTREGA</span>
          <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
          <span className="text-text-secondary">Entregamos em todo o Brasil</span>
        </div>
      ) : null}

      {sizeLabel ? (
        <div className="pointer-events-none select-none">
          <span className="inline-flex size-[4.5rem] items-center justify-center rounded-full border-2 border-brand bg-brand px-2 text-center text-[11px] font-bold leading-tight text-white ring-2 ring-brand/25 ring-offset-2">
            <span className="sr-only">Conteúdo: </span>
            {formatSizeLabel(sizeLabel)}
          </span>
        </div>
      ) : null}

      <div className="space-y-3">
        <ProductPurchaseBar
          productId={productId}
          stock={stock}
          productName={productName}
          price={price}
          imageUrl={imageUrl}
          imageAlt={imageAlt}
        />
        <ProductTrustSignals assurances={assurances} />
      </div>

      {showBuyTogether && buyTogetherSettings && buyTogetherPrimary ? (
        <ProductBuyTogetherSection
          primaryProduct={buyTogetherPrimary}
          bundles={buyTogetherBundles}
          paymentSettings={paymentSettings}
          checkoutSettings={checkoutSettings}
          settings={buyTogetherSettings}
          compact
        />
      ) : null}

      <ShippingCalculator subtotal={price} variant="product" />

      <ProductPurchaseFaq assurances={assurances} />
    </div>
  )
}
