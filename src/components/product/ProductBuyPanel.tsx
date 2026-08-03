'use client'

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

      <div className="space-y-3">
        <ProductPurchaseBar productId={productId} stock={stock} />
        <ProductTrustSignals assurances={assurances} />
      </div>

      <ShippingCalculator subtotal={price} variant="product" />

      <ProductPurchaseFaq assurances={assurances} />

      {showBuyTogether && buyTogetherSettings && buyTogetherPrimary ? (
        <ProductBuyTogetherSection
          primaryProduct={buyTogetherPrimary}
          bundles={buyTogetherBundles}
          paymentSettings={paymentSettings}
          settings={buyTogetherSettings}
          compact
        />
      ) : null}
    </div>
  )
}
