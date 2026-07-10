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

export function calcBundlePricing(
  primaryPrice: number,
  companionPrice: number,
  discountPercent: number
) {
  const originalTotal = primaryPrice + companionPrice
  const bundlePrice = Math.round(originalTotal * (1 - discountPercent / 100) * 100) / 100
  return { originalTotal, bundlePrice }
}
