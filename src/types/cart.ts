/** Item persistido localmente — preços vêm sempre do servidor. */
export type StoredCartItem = {
  productId: string
  quantity: number
}

export type StoredCartBundlePair = {
  primaryProductId: string
  companionProductId: string
  discountPercent: number
}

export type ValidatedCartLine = {
  productId: string
  slug: string
  name: string
  price: number
  originalPrice: number | null
  stock: number
  quantity: number
  lineTotal: number
  bundleDiscountAmount?: number
  displayLineTotal?: number
  imageUrl: string | null
  imageAlt: string
  available: boolean
  quantityAdjusted: boolean
}

export type AppliedCartBundle = {
  primaryProductId: string
  companionProductId: string
  discountPercent: number
  pairCount: number
  savings: number
}

export type CartSyncResult = {
  lines: ValidatedCartLine[]
  subtotal: number
  bundleDiscountAmount: number
  appliedBundles: AppliedCartBundle[]
  /** Subtotal após desconto Compre Junto (somente nos pares elegíveis). */
  merchandiseTotal: number
  itemCount: number
  warnings: string[]
}
