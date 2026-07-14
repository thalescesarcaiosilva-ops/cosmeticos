import type { MerchantSeoContext } from '@/lib/seo/get-merchant-seo-context'
import { toAbsoluteSiteMediaUrl } from '@/lib/media/public-url'
import { absoluteUrl } from '@/lib/seo/site-url'
import {
  buildMerchantReturnPolicy,
  buildOfferShippingDetails,
  buildPriceValidUntil,
} from '@/lib/seo/json-ld/merchant-schemas'
import type { ApprovedProductReview } from '@/lib/products/reviews'
import type { ProductDetail } from '@/types/product'

function formatSchemaPrice(price: number): string {
  return price.toFixed(2)
}

function availabilityUrl(stock: number): string {
  return stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
}

type ProductJsonLdOptions = {
  reviewSummary?: { average: number; count: number }
  reviews?: ApprovedProductReview[]
}

export function buildProductJsonLd(
  product: ProductDetail,
  merchant?: MerchantSeoContext | null,
  options?: ProductJsonLdOptions
) {
  const url = absoluteUrl(`/produto/${product.slug}`)
  if (!url) return null

  const images = product.images
    .map((img) => toAbsoluteSiteMediaUrl(img.url))
    .filter((url): url is string => Boolean(url))
  const description =
    product.meta_description?.trim() ||
    product.description?.trim()?.slice(0, 5000) ||
    product.name

  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    url,
    priceCurrency: 'BRL',
    price: formatSchemaPrice(product.price),
    availability: availabilityUrl(product.stock),
    itemCondition: 'https://schema.org/NewCondition',
    priceValidUntil: buildPriceValidUntil(),
  }

  if (merchant) {
    offer.shippingDetails = buildOfferShippingDetails(merchant)
    const returnPolicy = buildMerchantReturnPolicy(merchant)
    if (returnPolicy) {
      offer.hasMerchantReturnPolicy = returnPolicy
    }
  }

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    url,
    image: images.length > 0 ? images : undefined,
    offers: offer,
  }

  if (product.sku) {
    jsonLd.sku = product.sku
    jsonLd.mpn = product.sku
  }

  if (product.gtin) {
    jsonLd.gtin = product.gtin
  }

  if (product.brandName) {
    jsonLd.brand = {
      '@type': 'Brand',
      name: product.brandName,
    }
  }

  const reviewSummary = options?.reviewSummary
  if (reviewSummary && reviewSummary.count > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviewSummary.average,
      reviewCount: reviewSummary.count,
      bestRating: 5,
      worstRating: 1,
    }
  }

  const reviews = options?.reviews
  if (reviews && reviews.length > 0) {
    jsonLd.review = reviews.slice(0, 5).map((review) => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: review.author_name,
      },
      datePublished: review.created_at.slice(0, 10),
      reviewBody: review.comment,
      name: review.title ?? undefined,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
    }))
  }

  return jsonLd
}
