import type { StoredCartItem } from '@/types/cart'

const CART_STORAGE_KEY = 'loja-cart-v1'

export function readStoredCart(): StoredCartItem[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(
        (item): item is StoredCartItem =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as StoredCartItem).productId === 'string' &&
          typeof (item as StoredCartItem).quantity === 'number' &&
          (item as StoredCartItem).quantity >= 1
      )
      .map((item) => ({
        productId: item.productId,
        quantity: Math.min(99, Math.max(1, Math.floor(item.quantity))),
      }))
  } catch {
    return []
  }
}

export function writeStoredCart(items: StoredCartItem[]): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // quota ou modo privado — ignora
  }
}
