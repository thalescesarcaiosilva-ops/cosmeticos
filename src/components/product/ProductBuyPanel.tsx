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
  buyTogetherPrimary: BuyTogetherPrimaryProduct
  buyTogetherBundles: BuyTogetherBundle[]
  buyTogetherSettings: BuyTogetherSettings
  assurances: ProductPurchaseAssurances
}

export function ProductBuyPanel({
  productId,
  stock,
  price,
  originalPrice,
  paymentSettings,
  checkoutSettings,
  buyTogetherPrimary,
  buyTogetherBundles,
  buyTogetherSettings,
  assurances,
}: ProductBuyPanelProps) {
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

      {buyTogetherSettings.enabled && buyTogetherBundles.length > 0 && (
        <ProductBuyTogetherSection
          primaryProduct={buyTogetherPrimary}
          bundles={buyTogetherBundles}
          paymentSettings={paymentSettings}
          settings={buyTogetherSettings}
          compact
        />
      )}
    </div>
  )
}
