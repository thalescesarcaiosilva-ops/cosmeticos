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
    ...(context.returnPolicyUrl ? { returnPolicyUrl: context.returnPolicyUrl } : {}),
  }
}

export function buildPriceValidUntil(daysFromNow = 365): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + daysFromNow)
  return date.toISOString().slice(0, 10)
}

export function buildOfferShippingDetails(context: MerchantSeoContext) {
  const shippingRateValue =
    context.defaultShippingRate != null ? context.defaultShippingRate.toFixed(2) : '0'

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
  }
}

export function organizationId(): string | null {
  const siteUrl = absoluteUrl('/')
  return siteUrl ? `${siteUrl}#organization` : null
}
