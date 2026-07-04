/** Item persistido localmente — preços vêm sempre do servidor. */
export type StoredCartItem = {
  productId: string
  quantity: number
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
  imageUrl: string | null
  imageAlt: string
  available: boolean
  quantityAdjusted: boolean
}

export type CartSyncResult = {
  lines: ValidatedCartLine[]
  subtotal: number
  itemCount: number
  warnings: string[]
}
