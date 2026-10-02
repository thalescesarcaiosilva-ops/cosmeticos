export type CouponDiscountType = 'percent' | 'fixed'

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** Desconto sobre o valor da compra (produtos), limitado a esse valor. */
export function quoteCouponDiscount(params: {
  discountType: CouponDiscountType
  discountValue: number
  merchandiseTotal: number
}): number {
  const base = roundMoney(Math.max(0, params.merchandiseTotal))
  if (base <= 0) return 0

  if (params.discountType === 'percent') {
    const percent = Math.min(100, Math.max(0, params.discountValue))
    return roundMoney(Math.min(base, (base * percent) / 100))
  }

  return roundMoney(Math.min(base, Math.max(0, params.discountValue)))
}
