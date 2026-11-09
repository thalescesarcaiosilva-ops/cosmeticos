'use client'

import { CreditCard } from 'lucide-react'
import { PaymentDetailsTrigger } from '@/components/payment/PaymentDetailsModal'
import { PixIcon } from '@/components/product/PixDiscountBadge'
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
  const pixSavings = showPixPrice ? Math.max(0, price - pixPrice) : 0

  const listPrice = originalPrice != null && originalPrice > price ? originalPrice : null

  const installment = calcInstallmentDisplay(price, paymentSettings)
  const cardEnabled = checkoutSettings.cardEnabled !== false
  const showInstallments = cardEnabled && installment != null && installment.count > 1
  const showPaymentPopup = pixEnabled || showInstallments

  return (
    <div className="space-y-2">
      <div
        aria-label={
          listPrice != null
            ? `De ${formatCurrency(listPrice)} por ${formatCurrency(price)}`
            : `Preço: ${formatCurrency(price)}`
        }
      >
        {listPrice != null ? (
          <p className="mb-1 text-[15px] font-medium text-claret line-through tabular-nums">
            De {formatCurrency(listPrice)}
          </p>
        ) : null}
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {listPrice != null ? (
            <span className="text-sm font-bold uppercase tracking-wide text-text-primary">Por</span>
          ) : null}
          <span className="text-[34px] font-black leading-none tracking-tight text-brand tabular-nums md:text-[40px]">
            {formatCurrency(price)}
          </span>
        </p>
      </div>

      {showPixPrice && pixSavings > 0 ? (
        <p className="flex items-center gap-1.5 text-[13px] text-text-secondary">
          <PixIcon className="size-3.5 shrink-0 text-[#178a45]" />
          <span>
            No Pix:{' '}
            <span className="font-semibold text-text-primary tabular-nums">
              {formatCurrency(pixPrice)}
            </span>
            <span className="text-text-muted"> (−{pixDiscount}%)</span>
          </span>
        </p>
      ) : null}

      {showInstallments && installment ? (
        <p className="flex items-start gap-2 text-[13px] leading-snug text-text-secondary">
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

      {showPaymentPopup ? (
        <PaymentDetailsTrigger
          price={price}
          paymentSettings={paymentSettings}
          checkoutSettings={checkoutSettings}
          layout="product"
          triggerContent={
            <span className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-brand underline-offset-2 group-hover:underline">
              Ver formas de pagamento
              <span aria-hidden className="text-base leading-none">
                ›
              </span>
            </span>
          }
        />
      ) : null}
    </div>
  )
}
