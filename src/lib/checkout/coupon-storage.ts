const COUPON_KEY = 'bc_coupon_code'

export function readStoredCouponCode(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(COUPON_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function writeStoredCouponCode(code: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(COUPON_KEY, code)
  } catch {
    // armazenamento indisponível
  }
}

export function clearStoredCouponCode(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(COUPON_KEY)
  } catch {
    // armazenamento indisponível
  }
}
