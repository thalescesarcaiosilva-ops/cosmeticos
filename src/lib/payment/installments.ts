import {
  applyInstallmentTemplate,
  splitInstallmentTemplate,
} from '@/lib/payment/format-installment'
import { calcInstallmentTotal } from '@/lib/payment/installment-rates'
import { formatCurrency } from '@/lib/products/format'
import type { InstallmentDisplay, PaymentSettings } from '@/types/payment'

export { applyInstallmentTemplate, splitInstallmentTemplate }

export function calcInstallmentDisplay(
  price: number,
  settings: PaymentSettings | null | undefined
): InstallmentDisplay | null {
  if (!settings || price <= 0) return null

  const minInstallmentValue = Number(settings.minInstallmentValue) || 1
  const maxInstallments = Number(settings.maxInstallments) || 1
  const maxByMin = Math.floor(price / minInstallmentValue)
  let count = Math.min(maxInstallments, Math.max(1, maxByMin))

  if (count < 1) count = 1

  const { installmentValue, interestFree } = calcInstallmentTotal(price, count, settings)

  const template = interestFree
    ? settings.installmentTextInterestFree
    : settings.installmentTextWithInterest

  const label = applyInstallmentTemplate(template, count, installmentValue)

  return { count, value: installmentValue, interestFree, template, label }
}

export function formatInstallmentTemplate(
  display: InstallmentDisplay,
  settings: PaymentSettings
): string {
  const template = display.interestFree
    ? settings.installmentTextInterestFree
    : settings.installmentTextWithInterest

  return applyInstallmentTemplate(template, display.count, display.value)
}
