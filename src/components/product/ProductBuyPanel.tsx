'use client'

import { ProductBuyTogetherSection } from '@/components/product/ProductBuyTogetherSection'
import { ProductPricingBlock } from '@/components/product/ProductPricingBlock'
import { ProductPurchaseBar } from '@/components/product/ProductPurchaseBar'
import { ShippingCalculator } from '@/components/shipping/ShippingCalculator'
import type { BuyTogetherBundle, BuyTogetherPrimaryProduct } from '@/lib/products/buy-together'
import type { CheckoutPaymentSettings, PaymentSettings } from '@/types/payment'
import type { BuyTogetherSettings } from '@/types/buy-together-settings'

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
}: ProductBuyPanelProps) {
  return (
    <div className="space-y-5">
      <ProductPricingBlock
        price={price}
        originalPrice={originalPrice}
        paymentSettings={paymentSettings}
        checkoutSettings={checkoutSettings}
      />

      <ProductPurchaseBar productId={productId} stock={stock} />

      <ShippingCalculator subtotal={price} variant="product" />

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
