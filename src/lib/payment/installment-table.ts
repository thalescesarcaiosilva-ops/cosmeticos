import { applyInstallmentTemplate } from '@/lib/payment/format-installment'
import { calcInstallmentDisplay } from '@/lib/payment/installments'
import type { InstallmentDisplay, PaymentSettings } from '@/types/payment'

export type InstallmentTableRow = {
  count: number
  installmentValue: number
  total: number
  interestFree: boolean
  label: string
}

export function buildInstallmentTable(
  price: number,
  settings: PaymentSettings
): InstallmentTableRow[] {
  if (price <= 0) return []

  const rows: InstallmentTableRow[] = []
  const maxByMin = Math.floor(price / settings.minInstallmentValue)
  const maxCount = Math.min(settings.maxInstallments, Math.max(1, maxByMin))

  for (let count = 1; count <= maxCount; count++) {
    const interestFree = count <= settings.interestFreeInstallments
    let total: number
    let installmentValue: number

    if (interestFree || settings.monthlyInterestRate <= 0) {
      total = price
      installmentValue = price / count
    } else {
      total = price * (1 + (settings.monthlyInterestRate / 100) * count)
      installmentValue = total / count
    }

    const template = interestFree
      ? settings.installmentTextInterestFree
      : settings.installmentTextWithInterest

    const label = applyInstallmentTemplate(template, count, installmentValue)

    rows.push({
      count,
      installmentValue,
      total,
      interestFree,
      label,
    })
  }

  return rows
}

export function getBestInstallment(
  price: number,
  settings: PaymentSettings
): InstallmentDisplay | null {
  return calcInstallmentDisplay(price, settings)
}
