import { formatCurrency } from '@/lib/products/format'
import { calcInstallmentDisplay } from '@/lib/payment/installments'
import type { CheckoutPaymentSettings, PaymentSettings } from '@/types/payment'

function calcPixPrice(price: number, discountPercent: number): number {
  if (discountPercent <= 0) return price
  return Math.max(price * (1 - discountPercent / 100), 0)
}

export function buildProductPaymentSummary(
  price: number,
  paymentSettings: PaymentSettings | null | undefined,
  checkoutSettings: CheckoutPaymentSettings | null | undefined
): string | null {
  if (price <= 0 || !paymentSettings || !checkoutSettings) return null

  const installment = calcInstallmentDisplay(price, paymentSettings)
  const segments: string[] = []

  if (checkoutSettings.pixEnabled !== false) {
    const pixDiscount = Number(checkoutSettings.pixDiscount) || 0
    if (pixDiscount > 0) {
      segments.push(
        `à vista no Pix por ${formatCurrency(calcPixPrice(price, pixDiscount))}`
      )
    } else {
      segments.push('à vista no Pix')
    }
  }

  const showInstallments =
    checkoutSettings.cardEnabled !== false && installment != null && installment.count > 1

  if (showInstallments && installment) {
    const cardPart = `${formatCurrency(price)} em até ${installment.count}x de ${formatCurrency(installment.value)} ${
      installment.interestFree ? 'sem juros' : 'com juros'
    } no cartão`

    segments.push(segments.length > 0 ? `ou ${cardPart}` : cardPart)
  }

  return segments.length > 0 ? segments.join(' ') : null
}
