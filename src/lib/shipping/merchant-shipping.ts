/** Prazos alinhados ao Google Merchant Center (Batista Cosméticos). */

export const MERCHANT_HANDLING_DAYS = { min: 1, max: 2 } as const

/** PAC é grátis em qualquer pedido (free_above = 0 no método de frete). */
export const MERCHANT_FREE_SHIPPING_ABOVE = 0

/** SEDEX com taxa fixa. Não entra no frete grátis do PAC. */
export const SEDEX_FIXED_PRICE = 19.9

/**
 * Texto fixo do topbar. Não deriva de consulta ao banco: um valor defasado em
 * cache já apareceu no HTML público e divergiu da política de frete.
 */
export const FREE_SHIPPING_LABEL = 'Frete Grátis para pedidos no PAC'

/** Trânsito após postagem (Correios), por modalidade. */
export const MERCHANT_TRANSIT_BY_METHOD: Record<string, { min: number; max: number }> = {
  PAC: { min: 3, max: 4 },
  SEDEX: { min: 2, max: 3 },
}

/** Prazo total estimado (separação 1–2 + trânsito). */
export const MERCHANT_TOTAL_DELIVERY_BY_METHOD: Record<string, { min: number; max: number }> = {
  PAC: { min: 4, max: 6 },
  SEDEX: { min: 3, max: 5 },
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
