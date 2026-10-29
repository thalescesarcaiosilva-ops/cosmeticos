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

type ProductBuyPanelProps = {
  productId: string
  productName: string
  imageUrl?: string | null
  imageAlt?: string
  stock: number
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
