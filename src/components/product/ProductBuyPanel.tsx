'use client'

import { useEffect, useState } from 'react'
import { QuantityControl } from '@/components/cart/QuantityControl'
import { FavoriteButton } from '@/components/product/FavoriteButton'
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
  brandName?: string | null
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
  brandName = null,
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

  const maxQty = Math.min(99, Math.max(stock, 0))
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    setQuantity((current) => {
      if (maxQty <= 0) return 1
      return Math.min(Math.max(1, current), maxQty)
    })
  }, [maxQty])

  const lineTotal = Math.round(price * Math.min(quantity, Math.max(maxQty, 1)) * 100) / 100

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[1.35rem] border border-[#efe6ea] bg-white shadow-[0_10px_32px_rgba(211,52,100,0.05)]">
        <div className="space-y-5 px-4 py-5 sm:px-6">
          <header className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {brandName ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                  {brandName}
                </p>
              ) : null}
              <h1 className="mt-1 text-[22px] font-bold leading-tight text-text-primary md:text-[26px]">
                {productName}
              </h1>
            </div>
            <FavoriteButton
              productId={productId}
              variant="product"
              className="!size-10 !rounded-full !bg-white !text-[#e11d48] !ring-1 !ring-[#e8dde2] hover:!bg-[#fff4f8] hover:!text-[#e11d48]"
            />
          </header>

          <ProductPricingBlock
            price={price}
            originalPrice={originalPrice}
            paymentSettings={paymentSettings}
            checkoutSettings={checkoutSettings}
          />

          {sizeLabel ? (
            <div className="flex items-center gap-3 border-t border-dashed border-[#e8dde2] pt-4">
              <span className="text-sm text-text-secondary">Tamanho</span>
              <span className="pointer-events-none inline-flex size-12 select-none items-center justify-center rounded-full border-2 border-brand bg-white px-1 text-center text-[12px] font-bold leading-tight text-brand">
                <span className="sr-only">Conteúdo: </span>
                {formatSizeLabel(sizeLabel)}
              </span>
            </div>
          ) : null}

          {stock > 0 ? (
            <div className="flex items-center gap-3 border-t border-dashed border-[#e8dde2] pt-4">
              <span className="text-sm text-text-secondary">Quantidade</span>
              <QuantityControl
                value={quantity}
                max={maxQty}
                onChange={setQuantity}
                label={productName}
              />
            </div>
          ) : null}

          <ProductPurchaseBar
            productId={productId}
            stock={stock}
            quantity={quantity}
            productName={productName}
            price={lineTotal}
            imageUrl={imageUrl}
            imageAlt={imageAlt}
          />

          <ProductTrustSignals assurances={assurances} inStock={stock > 0} />

          <ShippingCalculator subtotal={lineTotal} variant="product" />
        </div>
      </section>

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

      <ProductPurchaseFaq assurances={assurances} />
    </div>
  )
}
