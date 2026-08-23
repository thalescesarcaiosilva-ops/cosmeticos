/** Prazos alinhados ao Google Merchant Center (Batista Cosméticos). */

export const MERCHANT_HANDLING_DAYS = { min: 1, max: 2 } as const

/** Trânsito após postagem (Correios), por modalidade. */
export const MERCHANT_TRANSIT_BY_METHOD: Record<string, { min: number; max: number }> = {
  PAC: { min: 5, max: 10 },
  SEDEX: { min: 4, max: 7 },
}

/** Prazo total estimado exibido no checkout (separação + trânsito). */
export const MERCHANT_TOTAL_DELIVERY_BY_METHOD: Record<string, { min: number; max: number }> = {
  PAC: { min: 6, max: 12 },
  SEDEX: { min: 5, max: 9 },
}

export function resolveMerchantTransitRange(methodNames: string[]): { min: number; max: number } {
  let min = MERCHANT_TRANSIT_BY_METHOD.PAC.min
  let max = MERCHANT_TRANSIT_BY_METHOD.PAC.max

  for (const name of methodNames) {
    const key = name.trim().toUpperCase()
    const range = MERCHANT_TRANSIT_BY_METHOD[key]
    if (!range) continue
    min = Math.min(min, range.min)
    max = Math.max(max, range.max)
  }

  return { min, max }
}

export function resolveMerchantTotalDelivery(name: string): { min: number; max: number } | null {
  const range = MERCHANT_TOTAL_DELIVERY_BY_METHOD[name.trim().toUpperCase()]
  return range ?? null
}
