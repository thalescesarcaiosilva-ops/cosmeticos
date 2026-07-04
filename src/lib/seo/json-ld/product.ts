import type { MerchantSeoContext } from '@/lib/seo/get-merchant-seo-context'
import { absoluteUrl } from '@/lib/seo/site-url'
import {
  buildMerchantReturnPolicy,
  buildOfferShippingDetails,
  buildPriceValidUntil,
} from '@/lib/seo/json-ld/merchant-schemas'
import type { ProductDetail } from '@/types/product'

function formatSchemaPrice(price: number): string {
  return price.toFixed(2)
}

function availabilityUrl(stock: number): string {
  return stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
}

export function buildProductJsonLd(
  product: ProductDetail,
  merchant?: MerchantSeoContext | null
) {
  const url = absoluteUrl(`/produto/${product.slug}`)
  if (!url) return null

  const images = product.images.map((img) => img.url).filter(Boolean)
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
    sku: product.sku ?? undefined,
    image: images.length > 0 ? images : undefined,
    offers: offer,
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

  return jsonLd
}
