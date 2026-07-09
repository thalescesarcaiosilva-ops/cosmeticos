'use client'

import { ProductPricingBlock } from '@/components/product/ProductPricingBlock'
import { ProductPurchaseBar } from '@/components/product/ProductPurchaseBar'
import { ShippingCalculator } from '@/components/shipping/ShippingCalculator'
import type { CheckoutPaymentSettings, PaymentSettings } from '@/types/payment'

type ProductBuyPanelProps = {
  productId: string
  stock: number
  price: number
  originalPrice: number | null
  paymentSettings: PaymentSettings
  checkoutSettings: CheckoutPaymentSettings
}

export function ProductBuyPanel({
  productId,
  stock,
  price,
  originalPrice,
  paymentSettings,
  checkoutSettings,
}: ProductBuyPanelProps) {
  return (
    <div className="space-y-6">
      <ProductPricingBlock
        price={price}
        originalPrice={originalPrice}
        paymentSettings={paymentSettings}
        checkoutSettings={checkoutSettings}
      />

      <ProductPurchaseBar productId={productId} stock={stock} />

      <ShippingCalculator subtotal={price} variant="product" />
    </div>
  )
}
