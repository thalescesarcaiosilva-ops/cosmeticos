import type { ProductCardData } from '@/types/product'

export type BuyTogetherBundle = {
  id: string
  companion: ProductCardData
  discountPercent: number
}

export type BuyTogetherPrimaryProduct = {
  id: string
  name: string
  price: number
  imageUrl: string | null
  imageAlt: string | null
  brandName: string | null
}

export const DEFAULT_BUNDLE_DISCOUNT_PERCENT = 5

/** Valor máximo do combo (após desconto Compre Junto). */
export const MAX_BUNDLE_TOTAL = 498

export function calcBundlePricing(
  primaryPrice: number,
  companionPrice: number,
  discountPercent: number
) {
  const originalTotal = primaryPrice + companionPrice
  const bundlePrice = Math.round(originalTotal * (1 - discountPercent / 100) * 100) / 100
  return { originalTotal, bundlePrice }
}

export function isBundleWithinMaxTotal(
  primaryPrice: number,
  companionPrice: number,
  discountPercent: number,
  maxTotal: number = MAX_BUNDLE_TOTAL
): boolean {
  return calcBundlePricing(primaryPrice, companionPrice, discountPercent).bundlePrice <= maxTotal
}

export function filterBundlesByMaxTotal(
  primaryPrice: number,
  bundles: BuyTogetherBundle[],
  maxTotal: number = MAX_BUNDLE_TOTAL
): BuyTogetherBundle[] {
  return bundles.filter((bundle) =>
    isBundleWithinMaxTotal(primaryPrice, bundle.companion.price, bundle.discountPercent, maxTotal)
  )
}
