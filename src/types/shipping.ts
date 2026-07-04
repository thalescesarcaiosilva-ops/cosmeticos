export type CepRule = {
  prefixes: string[]
  price: number
}

export type ShippingMethod = {
  id: string
  name: string
  description: string | null
  base_price: number
  free_above: number | null
  estimated_days_min: number | null
  estimated_days_max: number | null
  cep_rules: CepRule[]
  sort_order: number
  active: boolean
}

export type ShippingQuoteLine = {
  methodId: string
  name: string
  description: string | null
  price: number
  isFree: boolean
  deliveryLabel: string
}

export type ShippingQuoteResult = {
  cep: string
  subtotal: number
  options: ShippingQuoteLine[]
}
