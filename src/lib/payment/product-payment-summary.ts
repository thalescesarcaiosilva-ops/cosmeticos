import { formatCurrency } from '@/lib/products/format'
import { calcInstallmentDisplay } from '@/lib/payment/installments'
import type { CheckoutPaymentSettings, PaymentSettings } from '@/types/payment'

function calcPixPrice(price: number, discountPercent: number): number {
  if (discountPercent <= 0) return price
  return Math.max(price * (1 - discountPercent / 100), 0)
}

export function buildProductPaymentSummary(
  price: number,
  paymentSettings: PaymentSettings,
  checkoutSettings: CheckoutPaymentSettings
): string | null {
  if (price <= 0) return null

  const installment = calcInstallmentDisplay(price, paymentSettings)
  const segments: string[] = []

  if (checkoutSettings.pixEnabled) {
    if (checkoutSettings.pixDiscount > 0) {
      segments.push(
        `à vista no Pix por ${formatCurrency(calcPixPrice(price, checkoutSettings.pixDiscount))}`
      )
    } else {
      segments.push('à vista no Pix')
    }
  }

  const showInstallments =
    checkoutSettings.cardEnabled && installment != null && installment.count > 1

  if (showInstallments && installment) {
    const cardPart = `${formatCurrency(price)} em até ${installment.count}x de ${formatCurrency(installment.value)} ${
      installment.interestFree ? 'sem juros' : 'com juros'
    } no cartão`

    segments.push(segments.length > 0 ? `ou ${cardPart}` : cardPart)
  }

  return segments.length > 0 ? segments.join(' ') : null
}
