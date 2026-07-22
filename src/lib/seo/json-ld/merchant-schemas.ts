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

type NationalShippingMode = {
  id: string
  price: number
  min: number
  max: number
  freeAbove?: number
}

/** Valores fixos nacionais — alinhados à Política de Frete da loja. */
const NATIONAL_SHIPPING = {
  origin: 'Salvador/BA (CEP 41706-690)',
  freePacAbove: 250,
  pac: { id: 'pac', price: 24.9, min: 5, max: 10 } satisfies NationalShippingMode,
  sedex: { id: 'sedex', price: 39.9, min: 2, max: 5 } satisfies NationalShippingMode,
}

function brazilDestination() {
  return {
    '@type': 'DefinedRegion',
    addressCountry: 'BR',
  }
}

function shippingCondition(
  id: string,
  destination: ReturnType<typeof brazilDestination>,
  price: number,
  minDays: number,
  maxDays: number,
  orderValue?: { minValue: number; maxValue?: number }
) {
  return {
    '@type': 'ShippingConditions',
    '@id': `#${id}`,
    shippingDestination: destination,
    ...(orderValue
      ? {
          orderValue: {
            '@type': 'MonetaryAmount',
            currency: 'BRL',
            minValue: orderValue.minValue,
            ...(orderValue.maxValue != null ? { maxValue: orderValue.maxValue } : {}),
          },
        }
      : {}),
    shippingRate: {
      '@type': 'MonetaryAmount',
      currency: 'BRL',
      value: price,
    },
    transitTime: {
      '@type': 'ServicePeriod',
      duration: {
        '@type': 'QuantitativeValue',
        minValue: minDays,
        maxValue: maxDays,
        unitCode: 'DAY',
      },
    },
  }
}

export function buildShippingServiceJsonLd() {
  const destination = brazilDestination()
  const { pac, sedex, freePacAbove } = NATIONAL_SHIPPING

  const shippingConditions = [
    shippingCondition('br-pac-pago', destination, pac.price, pac.min, pac.max, {
      minValue: 0,
      maxValue: freePacAbove - 0.01,
    }),
    shippingCondition('br-pac-gratis', destination, 0, pac.min, pac.max, {
      minValue: freePacAbove,
    }),
    shippingCondition('br-sedex', destination, sedex.price, sedex.min, sedex.max),
  ]

  return {
    '@type': 'ShippingService',
    '@id': '#frete-batista-cosmeticos',
    name: 'Frete Batista Cosméticos - Correios (PAC e SEDEX)',
    description: `Envios via Correios (PAC e SEDEX) a partir de ${NATIONAL_SHIPPING.origin} para todo o Brasil. PAC R$ ${pac.price.toFixed(2).replace('.', ',')} (5 a 10 dias úteis). SEDEX R$ ${sedex.price.toFixed(2).replace('.', ',')} (2 a 5 dias úteis). Frete grátis via PAC para pedidos a partir de R$ ${freePacAbove},00.`,
    fulfillmentType: 'https://schema.org/FulfillmentTypeDelivery',
    handlingTime: {
      '@type': 'ServicePeriod',
      cutoffTime: '14:00:00-03:00',
      duration: {
        '@type': 'QuantitativeValue',
        minValue: 1,
        maxValue: 2,
        unitCode: 'DAY',
      },
      businessDays: [
        'https://schema.org/Monday',
        'https://schema.org/Tuesday',
        'https://schema.org/Wednesday',
        'https://schema.org/Thursday',
        'https://schema.org/Friday',
      ],
    },
    shippingConditions,
  }
}

export function organizationId(): string | null {
  const siteUrl = absoluteUrl('/')
  return siteUrl ? `${siteUrl}#organization` : null
}
