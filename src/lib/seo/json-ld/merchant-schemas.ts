import { absoluteUrl } from '@/lib/seo/site-url'

export function buildPriceValidUntil(daysFromNow = 365): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + daysFromNow)
  return date.toISOString().slice(0, 10)
}

/** GTIN/EAN válido para Merchant + Rich Results (8, 12, 13 ou 14 dígitos). */
export function isValidGtin(value: string | null | undefined): boolean {
  if (!value) return false
  const digits = value.replace(/\D/g, '')
  return digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14
}

export function shippingPolicyUrl(): string | null {
  return absoluteUrl('/paginas/politica-de-frete')
}

export function organizationId(): string | null {
  const siteUrl = absoluteUrl('/')
  return siteUrl ? `${siteUrl}#organization` : null
}
