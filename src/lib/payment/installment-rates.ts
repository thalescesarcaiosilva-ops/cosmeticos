import { parseLocaleDecimal } from '@/lib/numbers/parse-locale-decimal'
import type { PaymentSettings } from '@/types/payment'

/** Taxa de juros (%) para um número de parcelas — usa mapa customizado ou taxa padrão. */
export function getInstallmentInterestRate(count: number, settings: PaymentSettings): number {
  if (count <= settings.interestFreeInstallments) return 0

  const custom = settings.installmentInterestRates[count]
  if (custom != null && custom >= 0) return custom

  return settings.monthlyInterestRate
}

export function calcInstallmentTotal(price: number, count: number, settings: PaymentSettings): {
  total: number
  installmentValue: number
  interestFree: boolean
  monthlyRate: number
} {
  const interestFree = count <= settings.interestFreeInstallments
  const monthlyRate = getInstallmentInterestRate(count, settings)

  if (interestFree || monthlyRate <= 0) {
    return {
      total: price,
      installmentValue: price / count,
      interestFree: true,
      monthlyRate: 0,
    }
  }

  const total = price * (1 + monthlyRate / 100)
  return {
    total,
    installmentValue: total / count,
    interestFree: false,
    monthlyRate,
  }
}

function parseRateValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = parseLocaleDecimal(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function parseInstallmentInterestRates(raw: unknown): Record<number, number> {
  if (!raw || typeof raw !== 'object') return {}

  const result: Record<number, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const count = parseInt(key, 10)
    const rate = parseRateValue(value)
    if (!Number.isNaN(count) && count >= 1 && count <= 24 && rate != null && rate >= 0) {
      result[count] = Math.round(rate * 100) / 100
    }
  }
  return result
}

export function serializeInstallmentInterestRates(
  rates: Record<number, number>
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [count, rate] of Object.entries(rates)) {
    const n = Number(count)
    if (n >= 1 && n <= 24 && rate >= 0) {
      result[String(n)] = Math.round(rate * 100) / 100
    }
  }
  return result
}
