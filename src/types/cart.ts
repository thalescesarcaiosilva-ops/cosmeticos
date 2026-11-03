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
  quantityDiscountAmount?: number
  quantityDiscountPercent?: number
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
  /** Desconto por quantidade na mesma linha (2/3+ unidades). */
  quantityDiscountAmount: number
  appliedBundles: AppliedCartBundle[]
  /** Subtotal após descontos de quantidade e Compre Junto. */
  merchandiseTotal: number
  itemCount: number
  warnings: string[]
}
