import { createPublicClient } from '@/lib/supabase/public'
import type { ShippingQuoteInput } from '@/schemas/shipping-schema'
import type { CepRule, ShippingMethod, ShippingQuoteLine, ShippingQuoteResult } from '@/types/shipping'

type ShippingRow = {
  id: string
  name: string
  description: string | null
  base_price: number
  free_above: number | null
  estimated_days_min: number | null
  estimated_days_max: number | null
  cep_rules: CepRule[] | null
  sort_order: number
}

function formatDeliveryLabel(min: number | null, max: number | null): string {
  if (min != null && max != null) {
    if (min === max) return `${min} dia${min === 1 ? '' : 's'} úteis`
    return `${min} a ${max} dias úteis`
  }
  if (min != null) return `A partir de ${min} dias úteis`
  if (max != null) return `Até ${max} dias úteis`
  return 'Prazo a combinar'
}

function resolvePrice(method: ShippingRow, cep: string): number {
  const rules = Array.isArray(method.cep_rules) ? method.cep_rules : []
  for (const rule of rules) {
    if (!Array.isArray(rule.prefixes)) continue
    const match = rule.prefixes.some((prefix) => cep.startsWith(prefix))
    if (match) return Number(rule.price)
  }
  return Number(method.base_price)
}

function mapQuoteLine(method: ShippingRow, cep: string, subtotal: number): ShippingQuoteLine {
  let price = resolvePrice(method, cep)
  const freeAbove = method.free_above != null ? Number(method.free_above) : null
  const isFree = freeAbove != null && subtotal >= freeAbove

  if (isFree) price = 0

  return {
    methodId: method.id,
    name: method.name,
    description: method.description,
    price,
    isFree,
    deliveryLabel: formatDeliveryLabel(method.estimated_days_min, method.estimated_days_max),
  }
}

export async function calculateShippingQuote(
  input: ShippingQuoteInput
): Promise<ShippingQuoteResult> {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('shipping_methods')
    .select(
      'id, name, description, base_price, free_above, estimated_days_min, estimated_days_max, cep_rules, sort_order'
    )
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error || !data) {
    return { cep: input.cep, subtotal: input.subtotal, options: [] }
  }

  const options = (data as ShippingRow[]).map((method) =>
    mapQuoteLine(method, input.cep, input.subtotal)
  )

  return {
    cep: input.cep,
    subtotal: input.subtotal,
    options,
  }
}

export function toShippingMethod(row: ShippingRow & { active?: boolean }): ShippingMethod {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    base_price: Number(row.base_price),
    free_above: row.free_above != null ? Number(row.free_above) : null,
    estimated_days_min: row.estimated_days_min,
    estimated_days_max: row.estimated_days_max,
    cep_rules: Array.isArray(row.cep_rules) ? row.cep_rules : [],
    sort_order: row.sort_order,
    active: row.active ?? true,
  }
}
