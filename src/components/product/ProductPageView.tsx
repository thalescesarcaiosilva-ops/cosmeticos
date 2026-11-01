import { ProductBreadcrumb } from '@/components/product/ProductBreadcrumb'
import { ProductBuyPanel } from '@/components/product/ProductBuyPanel'
import { ProductDetailTabs } from '@/components/product/ProductDetailTabs'
import { ProductGallery } from '@/components/product/ProductGallery'
import { ProductGalleryMeta } from '@/components/product/ProductGalleryMeta'
import { ProductRelatedCarousel } from '@/components/product/ProductRelatedCarousel'
import { TrackProductView } from '@/components/product/TrackProductView'
import { calcDiscountPercent } from '@/lib/products/format'
import type { BuyTogetherBundle } from '@/lib/products/buy-together'
import type { CheckoutPaymentSettings, InstallmentDisplay, PaymentSettings } from '@/types/payment'
import type { BuyTogetherSettings } from '@/types/buy-together-settings'
import type { ProductPurchaseAssurances } from '@/types/product-assurances'
import type { ProductCardData, ProductDetail } from '@/types/product'

type ProductPageViewProps = {
  product: ProductDetail
  paymentSettings: PaymentSettings
  checkoutSettings: CheckoutPaymentSettings
  relatedProducts: ProductCardData[]
  relatedInstallments: Map<string, InstallmentDisplay | null>
  buyTogetherBundles?: BuyTogetherBundle[]
  buyTogetherSettings?: BuyTogetherSettings | null
  assurances: ProductPurchaseAssurances
  listPrice: number | null
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
  listPrice,
}: ProductPageViewProps) {
  const discount = calcDiscountPercent(Number(product.price), listPrice)
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
          <ProductBuyPanel
            productId={product.id}
            productName={product.name}
            brandName={product.brandName}
            imageUrl={product.images[0]?.url ?? null}
            imageAlt={product.images[0]?.alt ?? product.name}
            stock={product.stock}
            sizeLabel={product.size_label}
            price={Number(product.price)}
            originalPrice={listPrice}
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
