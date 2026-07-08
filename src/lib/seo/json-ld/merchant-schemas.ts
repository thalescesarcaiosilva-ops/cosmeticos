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

type ShippingRegion = {
  id: string
  label: string
  states: string[]
  pac: { price: number; min: number; max: number }
  sedex: { price: number; min: number; max: number }
}

const SHIPPING_REGIONS: ShippingRegion[] = [
  {
    id: 'ba',
    label: 'Bahia (capital e interior)',
    states: ['BA'],
    pac: { price: 18.9, min: 3, max: 5 },
    sedex: { price: 29.9, min: 1, max: 3 },
  },
  {
    id: 'ne',
    label: 'Nordeste (demais estados)',
    states: ['AL', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
    pac: { price: 24.9, min: 5, max: 8 },
    sedex: { price: 36.9, min: 2, max: 4 },
  },
  {
    id: 'se',
    label: 'Sudeste',
    states: ['ES', 'MG', 'RJ', 'SP'],
    pac: { price: 29.9, min: 7, max: 10 },
    sedex: { price: 44.9, min: 3, max: 5 },
  },
  {
    id: 'sco',
    label: 'Sul e Centro-Oeste',
    states: ['DF', 'GO', 'MS', 'MT', 'PR', 'RS', 'SC'],
    pac: { price: 32.9, min: 8, max: 12 },
    sedex: { price: 49.9, min: 4, max: 6 },
  },
  {
    id: 'no',
    label: 'Norte',
    states: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'],
    pac: { price: 39.9, min: 10, max: 15 },
    sedex: { price: 59.9, min: 5, max: 8 },
  },
]

function regionDestination(states: string[]) {
  if (states.length === 1) {
    return {
      '@type': 'DefinedRegion',
      addressCountry: 'BR',
      addressRegion: states[0],
    }
  }
  return states.map((state) => ({
    '@type': 'DefinedRegion',
    addressCountry: 'BR',
    addressRegion: state,
  }))
}

function shippingCondition(
  id: string,
  destination: ReturnType<typeof regionDestination>,
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
  const shippingConditions = SHIPPING_REGIONS.flatMap((region) => {
    const destination = regionDestination(region.states)
    return [
      shippingCondition(
        `${region.id}-pac-pago`,
        destination,
        region.pac.price,
        region.pac.min,
        region.pac.max,
        { minValue: 0, maxValue: 249.99 }
      ),
      shippingCondition(
        `${region.id}-pac-gratis`,
        destination,
        0,
        region.pac.min,
        region.pac.max,
        { minValue: 250 }
      ),
      shippingCondition(
        `${region.id}-sedex`,
        destination,
        region.sedex.price,
        region.sedex.min,
        region.sedex.max
      ),
    ]
  })

  return {
    '@type': 'ShippingService',
    '@id': '#frete-batista-cosmeticos',
    name: 'Frete Batista Cosméticos - Correios (PAC e SEDEX)',
    description:
      'Envios via Correios (PAC e SEDEX) a partir de Salvador/BA (CEP 41706-690) para todo o Brasil. Frete grátis via PAC para pedidos a partir de R$ 250,00.',
    fulfillmentType: 'https://schema.org/FulfillmentTypeDelivery',
    shippingOrigin: {
      '@type': 'DefinedRegion',
      addressCountry: 'BR',
      addressRegion: 'BA',
    },
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
