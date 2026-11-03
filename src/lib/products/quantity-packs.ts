/** Descontos por quantidade — percentuais factuais, sem copy promocional. */

export type QuantityPackTier = {
  quantity: number
  discountPercent: number
}

/** Faixas padrão alinhadas ao seletor da PDP (1 / 2 / 3). */
export const QUANTITY_PACK_TIERS: readonly QuantityPackTier[] = [
  { quantity: 1, discountPercent: 0 },
  { quantity: 2, discountPercent: 5 },
  { quantity: 3, discountPercent: 10 },
] as const

export type QuantityPackQuote = {
  quantity: number
  discountPercent: number
  unitPrice: number
  originalTotal: number
  total: number
  savings: number
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** Melhor faixa aplicável à quantidade informada (ex.: 4 un. → 10%). */
export function getQuantityDiscountPercent(quantity: number): number {
  const qty = Math.max(0, Math.floor(quantity))
  let best = 0
  for (const tier of QUANTITY_PACK_TIERS) {
    if (qty >= tier.quantity && tier.discountPercent > best) {
      best = tier.discountPercent
    }
  }
  return best
}

export function calcQuantityPackQuote(
  unitPrice: number,
  quantity: number,
  discountPercent = getQuantityDiscountPercent(quantity)
): QuantityPackQuote {
  const qty = Math.max(0, Math.floor(quantity))
  const price = Math.max(0, unitPrice)
  const percent = Math.max(0, Math.min(100, discountPercent))
  const originalTotal = roundMoney(price * qty)
  const total = roundMoney(originalTotal * (1 - percent / 100))
  const savings = roundMoney(originalTotal - total)
  const discountedUnit = qty > 0 ? roundMoney(total / qty) : price

  return {
    quantity: qty,
    discountPercent: percent,
    unitPrice: discountedUnit,
    originalTotal,
    total,
    savings,
  }
}

export function buildQuantityPackOptions(
  unitPrice: number,
  maxQuantity: number
): QuantityPackQuote[] {
  const max = Math.max(0, Math.floor(maxQuantity))
  return QUANTITY_PACK_TIERS.filter((tier) => tier.quantity <= max).map((tier) =>
    calcQuantityPackQuote(unitPrice, tier.quantity, tier.discountPercent)
  )
}
