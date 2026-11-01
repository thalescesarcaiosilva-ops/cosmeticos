'use client'

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

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-[#f3d0dc] bg-white shadow-[0_10px_32px_rgba(211,52,100,0.06)]">
        {stock > 0 ? (
          <div className="bg-[#1a1014] px-5 py-4 sm:px-6">
            <p className="text-[13px] font-bold tracking-[0.16em] text-brand">PRÉ BLACK FRIDAY</p>
            <p className="mt-1 text-[12.5px] text-[#f6c9d8]">
              Válido enquanto durarem os estoques
            </p>
          </div>
        ) : null}

        <div className="space-y-5 px-5 py-5 sm:px-6">
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
              className="!size-10 !rounded-full !bg-transparent !text-text-muted !ring-0 hover:!text-brand"
            />
          </header>

          <ProductPricingBlock
            price={price}
            originalPrice={originalPrice}
            paymentSettings={paymentSettings}
            checkoutSettings={checkoutSettings}
          />

          {sizeLabel ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary">Tamanho</span>
              <span className="pointer-events-none inline-flex size-12 select-none items-center justify-center rounded-full border-2 border-brand bg-white px-1 text-center text-[12px] font-bold leading-tight text-brand">
                <span className="sr-only">Conteúdo: </span>
                {formatSizeLabel(sizeLabel)}
              </span>
            </div>
          ) : null}

          <ProductPurchaseBar
            productId={productId}
            stock={stock}
            productName={productName}
            price={price}
            imageUrl={imageUrl}
            imageAlt={imageAlt}
          />
        </div>
      </section>

      <ProductTrustSignals assurances={assurances} inStock={stock > 0} />

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
