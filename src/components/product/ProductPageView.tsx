import { ProductBreadcrumb } from '@/components/product/ProductBreadcrumb'
import { ProductBuyPanel } from '@/components/product/ProductBuyPanel'
import { ProductDetailTabs } from '@/components/product/ProductDetailTabs'
import { ProductGallery } from '@/components/product/ProductGallery'
import { ProductGalleryMeta } from '@/components/product/ProductGalleryMeta'
import { ProductRelatedCarousel } from '@/components/product/ProductRelatedCarousel'
import { FavoriteButton } from '@/components/product/FavoriteButton'
import { TrackProductView } from '@/components/product/TrackProductView'
import { calcDiscountPercent } from '@/lib/products/format'
import type { BuyTogetherBundle } from '@/lib/products/buy-together'
import type { CheckoutPaymentSettings, InstallmentDisplay, PaymentSettings } from '@/types/payment'
import type { BuyTogetherSettings } from '@/types/buy-together-settings'
import type { ProductPurchaseAssurances } from '@/types/product-assurances'
import type { ProductCardData, ProductDetail } from '@/types/product'

function formatSizeLabel(label: string) {
  return label
    .trim()
    .replace(/\bml\b/gi, 'mL')
    .replace(/\bkg\b/gi, 'kg')
    .replace(/\bg\b/gi, 'g')
}

type ProductPageViewProps = {
  product: ProductDetail
  paymentSettings: PaymentSettings
  checkoutSettings: CheckoutPaymentSettings
  relatedProducts: ProductCardData[]
  relatedInstallments: Map<string, InstallmentDisplay | null>
  buyTogetherBundles?: BuyTogetherBundle[]
  buyTogetherSettings?: BuyTogetherSettings | null
  assurances: ProductPurchaseAssurances
}

export function ProductPageView({
  product,
  paymentSettings,
  checkoutSettings,
  relatedProducts,
  relatedInstallments,
  buyTogetherBundles = [],
  buyTogetherSettings = null,
  assurances,
}: ProductPageViewProps) {
  const discount = calcDiscountPercent(product.price, product.original_price)
  const primaryCategory = product.categories[0] ?? null
  const showBuyTogether =
    Boolean(buyTogetherSettings?.enabled) && buyTogetherBundles.length > 0

  return (
    <div className="mx-auto max-w-[1300px] px-4 pt-5 pb-28 md:px-6 md:pt-8 lg:pb-8">
      <TrackProductView productId={product.id} />
      <ProductBreadcrumb
        category={primaryCategory}
        brandName={product.brandName}
        brandSlug={product.brandSlug}
        productName={product.name}
      />

      {/*
        Mobile (1 col): galeria → marca/categoria → compra → descrição
        Desktop (2 col): esquerda galeria+meta+descrição | direita compra (fluxo normal, sem sticky)
      */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-x-12 lg:gap-y-0">
        <div className="min-w-0">
          <ProductGallery
            images={product.images}
            productName={product.name}
            discountPercent={discount}
          />
          <ProductGalleryMeta
            categories={product.categories}
            brandName={product.brandName}
            brandSlug={product.brandSlug}
          />
        </div>

        <div className="min-w-0 lg:row-span-2">
          <header className="mb-5 border-b border-border pb-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {product.brandName && (
                  <p className="text-[13px] font-medium text-text-muted">{product.brandName}</p>
                )}
                <h1 className="mt-1 text-[22px] font-bold leading-tight text-text-primary md:text-[28px]">
                  {product.name}
                  {product.size_label ? (
                    <span className="whitespace-nowrap"> — {formatSizeLabel(product.size_label)}</span>
                  ) : null}
                </h1>
                {product.size_label ? (
                  <p className="mt-3">
                    <span className="inline-flex rounded-full bg-brand px-3 py-1 text-[12px] font-bold leading-none text-white">
                      <span className="sr-only">Conteúdo: </span>
                      {formatSizeLabel(product.size_label)}
                    </span>
                  </p>
                ) : null}
              </div>
              <FavoriteButton productId={product.id} variant="product" />
            </div>
          </header>

          <ProductBuyPanel
            productId={product.id}
            productName={product.name}
            imageUrl={product.images[0]?.url ?? null}
            imageAlt={product.images[0]?.alt ?? product.name}
            stock={product.stock}
            price={product.price}
            originalPrice={product.original_price}
            paymentSettings={paymentSettings}
            checkoutSettings={checkoutSettings}
            assurances={assurances}
            buyTogetherSettings={showBuyTogether ? buyTogetherSettings : null}
            buyTogetherBundles={showBuyTogether ? buyTogetherBundles : []}
            buyTogetherPrimary={
              showBuyTogether
                ? {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    imageUrl: product.images[0]?.url ?? null,
                    imageAlt: product.images[0]?.alt ?? product.name,
                    brandName: product.brandName,
                  }
                : null
            }
          />
        </div>

        <div className="min-w-0">
          <ProductDetailTabs
            productName={product.name}
            description={product.description}
            shortDescription={product.short_description}
            benefits={product.benefits}
          />
        </div>
      </div>

      <ProductRelatedCarousel
        products={relatedProducts}
        installments={relatedInstallments}
      />
    </div>
  )
}
