'use client'

import { CreditCard } from 'lucide-react'
import { formatCurrency } from '@/lib/products/format'
import { calcInstallmentDisplay } from '@/lib/payment/installments'
import { calcPixPrice } from '@/lib/payment/product-payment-summary'
import type { CheckoutPaymentSettings, PaymentSettings } from '@/types/payment'

type ProductPricingBlockProps = {
  price: number
  originalPrice: number | null
  paymentSettings: PaymentSettings
  checkoutSettings: CheckoutPaymentSettings
}

export function ProductPricingBlock({
  price,
  originalPrice,
  paymentSettings,
  checkoutSettings,
}: ProductPricingBlockProps) {
  const pixEnabled = checkoutSettings.pixEnabled !== false
  const pixDiscount = pixEnabled ? Math.max(0, Number(checkoutSettings.pixDiscount) || 0) : 0
  const showPixPrice = pixDiscount > 0
  const pixPrice = showPixPrice ? calcPixPrice(price, pixDiscount) : price

  const heroPrice = showPixPrice ? pixPrice : price
  const listPrice = originalPrice != null && originalPrice > price ? originalPrice : null
  const pixSavings = showPixPrice ? Math.max(0, price - pixPrice) : 0

  const installment = calcInstallmentDisplay(price, paymentSettings)
  const cardEnabled = checkoutSettings.cardEnabled !== false
  const showInstallments = cardEnabled && installment != null && installment.count > 1

  return (
    <div className="space-y-2">
      {showPixPrice ? (
        <span className="inline-flex rounded-full bg-brand px-3 py-1 text-[11px] font-bold tracking-wide text-white">
          PREÇO NO PIX · {pixDiscount}% OFF
        </span>
      ) : null}

      <div
        aria-label={
          listPrice != null
            ? `De ${formatCurrency(listPrice)} por ${formatCurrency(heroPrice)}`
            : `Preço: ${formatCurrency(heroPrice)}`
        }
      >
        {listPrice != null ? (
          <p className="mb-1 text-[15px] text-text-muted line-through tabular-nums">
            {formatCurrency(listPrice)}
          </p>
        ) : null}
        <span className="text-[34px] font-black leading-none tracking-tight text-brand tabular-nums md:text-[40px]">
          {formatCurrency(heroPrice)}
        </span>
      </div>

      {pixSavings > 0 ? (
        <p className="text-[13px] text-text-secondary">
          Você economiza{' '}
          <span className="font-semibold text-text-primary tabular-nums">
            {formatCurrency(pixSavings)}
          </span>{' '}
          pagando no Pix
        </p>
      ) : null}

      {showInstallments && installment ? (
        <p className="flex items-start gap-2 border-t border-dashed border-[#f3d0dc] pt-3 text-[13px] leading-snug text-text-secondary">
          <CreditCard className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
          <span>
            ou{' '}
            <span className="font-semibold text-text-primary">
              {installment.count}x de {formatCurrency(installment.value)}
            </span>{' '}
            {installment.interestFree ? 'sem juros' : 'com juros'} no cartão
            {!installment.interestFree ? (
              <span className="text-text-muted"> ({formatCurrency(installment.total)})</span>
            ) : null}
          </span>
        </p>
      ) : null}
    </div>
  )
}
