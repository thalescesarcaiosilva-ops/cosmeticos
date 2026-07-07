import { applyInstallmentTemplate } from '@/lib/payment/format-installment'
import { calcInstallmentTotal } from '@/lib/payment/installment-rates'
import { calcInstallmentDisplay } from '@/lib/payment/installments'
import type { InstallmentDisplay, PaymentSettings } from '@/types/payment'

export type InstallmentTableRow = {
  count: number
  installmentValue: number
  total: number
  interestFree: boolean
  monthlyRate: number
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
    const { total, installmentValue, interestFree, monthlyRate } = calcInstallmentTotal(
      price,
      count,
      settings
    )

    const template = interestFree
      ? settings.installmentTextInterestFree
      : settings.installmentTextWithInterest

    const label = applyInstallmentTemplate(template, count, installmentValue)

    rows.push({
      count,
      installmentValue,
      total,
      interestFree,
      monthlyRate,
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
