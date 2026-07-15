import { ProductBreadcrumb } from '@/components/product/ProductBreadcrumb'
import { ProductBuyPanel } from '@/components/product/ProductBuyPanel'
import { ProductBuyTogetherSection } from '@/components/product/ProductBuyTogetherSection'
import { ProductDetailTabs } from '@/components/product/ProductDetailTabs'
import { ProductGallery } from '@/components/product/ProductGallery'
import { ProductGalleryMeta } from '@/components/product/ProductGalleryMeta'
import { ProductRatingStars } from '@/components/product/ProductRatingStars'
import { ProductRelatedCarousel } from '@/components/product/ProductRelatedCarousel'
import { ProductReviewsSection } from '@/components/product/ProductReviewsSection'
import { FavoriteButton } from '@/components/product/FavoriteButton'
import { calcDiscountPercent } from '@/lib/products/format'
import type { BuyTogetherBundle } from '@/lib/products/buy-together'
import type { ApprovedProductReview } from '@/lib/products/reviews'
import type { CheckoutPaymentSettings, InstallmentDisplay, PaymentSettings } from '@/types/payment'
import type { ProductCardData, ProductDetail } from '@/types/product'

type ProductPageViewProps = {
  product: ProductDetail
  reviewSummary: { average: number; count: number }
  approvedReviews: ApprovedProductReview[]
  paymentSettings: PaymentSettings
  checkoutSettings: CheckoutPaymentSettings
  relatedProducts: ProductCardData[]
  relatedInstallments: Map<string, InstallmentDisplay | null>
  buyTogetherBundles: BuyTogetherBundle[]
}

export function ProductPageView({
  product,
  reviewSummary,
  approvedReviews,
  paymentSettings,
  checkoutSettings,
  relatedProducts,
  relatedInstallments,
  buyTogetherBundles,
}: ProductPageViewProps) {
  const discount = calcDiscountPercent(product.price, product.original_price)
  const primaryCategory = product.categories[0] ?? null

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-5 md:px-6 md:py-8">
      <ProductBreadcrumb
        category={primaryCategory}
        brandName={product.brandName}
        brandSlug={product.brandSlug}
        productName={product.name}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-12">
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

        <div className="min-w-0 lg:sticky lg:top-[calc(var(--shop-header-height,168px)+1rem)] lg:self-start">
          <header className="mb-5 border-b border-border pb-5">
            <div className="flex items-start gap-3">
              <h1 className="min-w-0 flex-1 text-[21px] font-bold leading-snug text-text-primary md:text-[26px]">
                {product.name}
              </h1>
              <FavoriteButton productId={product.id} variant="product" />
            </div>
            <ProductRatingStars average={reviewSummary.average} count={reviewSummary.count} />

            {product.brandName && (
              <p className="mt-3 text-[13px] font-semibold tracking-wide text-text-secondary">
                {product.brandName}
              </p>
            )}
          </header>

          <ProductBuyPanel
            productId={product.id}
            stock={product.stock}
            price={product.price}
            originalPrice={product.original_price}
            paymentSettings={paymentSettings}
            checkoutSettings={checkoutSettings}
          />
        </div>
      </div>

      {buyTogetherBundles.length > 0 && (
        <div className="mt-10 md:mt-12">
          <ProductBuyTogetherSection
            primaryProduct={{
              id: product.id,
              name: product.name,
              price: product.price,
              imageUrl: product.images[0]?.url ?? null,
              imageAlt: product.images[0]?.alt ?? product.name,
              brandName: product.brandName,
            }}
            bundles={buyTogetherBundles}
            paymentSettings={paymentSettings}
          />
        </div>
      )}

      <ProductDetailTabs description={product.description} />
      <ProductReviewsSection productSlug={product.slug} reviews={approvedReviews} />

      <ProductRelatedCarousel
        products={relatedProducts}
        installments={relatedInstallments}
      />
    </div>
  )
}
