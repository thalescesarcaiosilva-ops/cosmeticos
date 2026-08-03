import type { MerchantSeoContext } from '@/lib/seo/get-merchant-seo-context'
import { absoluteUrl } from '@/lib/seo/site-url'

const RETURN_FEES_URL: Record<MerchantSeoContext['returnFees'], string> = {
  FreeReturn: 'https://schema.org/FreeReturn',
  ReturnShippingFees: 'https://schema.org/ReturnShippingFees',
  RestockingFees: 'https://schema.org/RestockingFees',
}

const RETURN_METHOD_URL: Record<MerchantSeoContext['returnMethod'], string> = {
  ReturnByMail: 'https://schema.org/ReturnByMail',
  ReturnInStore: 'https://schema.org/ReturnInStore',
}

export function buildMerchantReturnPolicy(context: MerchantSeoContext) {
  if (!context.returnDays || context.returnDays <= 0) return null

  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: context.country,
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: context.returnDays,
    returnMethod: RETURN_METHOD_URL[context.returnMethod],
    returnFees: RETURN_FEES_URL[context.returnFees],
    refundType: 'https://schema.org/FullRefund',
    ...(context.returnPolicyUrl ? { merchantReturnLink: context.returnPolicyUrl } : {}),
  }
}

export function buildPriceValidUntil(daysFromNow = 365): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + daysFromNow)
  return date.toISOString().slice(0, 10)
}

/** Data de início da oferta (hoje, UTC) — campo sugerido pelo Search Console em Offer. */
export function buildPriceValidFrom(): string {
  return new Date().toISOString().slice(0, 10)
}

/** GTIN/EAN válido para Merchant + Rich Results (8, 12, 13 ou 14 dígitos). */
export function isValidGtin(value: string | null | undefined): boolean {
  if (!value) return false
  const digits = value.replace(/\D/g, '')
  return digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14
}

export function buildOfferShippingDetails(context: MerchantSeoContext) {
  const shippingRateValue =
    context.defaultShippingRate != null ? context.defaultShippingRate.toFixed(2) : '0'
  const policyUrl = shippingPolicyUrl()

  return {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: shippingRateValue,
      currency: 'BRL',
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: context.country,
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: context.handlingDaysMin,
        maxValue: context.handlingDaysMax,
        unitCode: 'DAY',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: context.transitDaysMin,
        maxValue: context.transitDaysMax,
        unitCode: 'DAY',
      },
    },
    ...(policyUrl ? { shippingSettingsLink: policyUrl } : {}),
  }
}

export function shippingPolicyUrl(): string | null {
  return absoluteUrl('/paginas/politica-de-frete')
}

export function organizationId(): string | null {
  const siteUrl = absoluteUrl('/')
  return siteUrl ? `${siteUrl}#organization` : null
}
