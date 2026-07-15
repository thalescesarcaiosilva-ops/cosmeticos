import { ProductBreadcrumb } from '@/components/product/ProductBreadcrumb'
import { ProductBuyPanel } from '@/components/product/ProductBuyPanel'
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

      {/*
        Mobile (1 col): galeria → marca/categoria → compra → descrição
        Desktop (2 col): esquerda galeria+meta+descrição | direita sticky até o fim da descrição
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

        <div className="min-w-0 lg:row-span-2 lg:sticky lg:top-[calc(var(--shop-header-height,168px)+0.75rem)] lg:self-start">
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
            buyTogetherPrimary={{
              id: product.id,
              name: product.name,
              price: product.price,
              imageUrl: product.images[0]?.url ?? null,
              imageAlt: product.images[0]?.alt ?? product.name,
              brandName: product.brandName,
            }}
            buyTogetherBundles={buyTogetherBundles}
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

      <ProductReviewsSection
        productSlug={product.slug}
        reviews={approvedReviews}
        reviewSummary={reviewSummary}
      />

      <ProductRelatedCarousel
        products={relatedProducts}
        installments={relatedInstallments}
      />
    </div>
  )
}
