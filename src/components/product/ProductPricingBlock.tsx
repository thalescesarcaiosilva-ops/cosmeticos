'use client'

import { CreditCard } from 'lucide-react'
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

  const heroPrice = showPixPrice ? pixPrice : price
  const hasListPrice = originalPrice != null && originalPrice > price
  const normalPrice = showPixPrice ? price : hasListPrice ? originalPrice : null

  const installment = calcInstallmentDisplay(price, paymentSettings)
  const cardEnabled = checkoutSettings.cardEnabled !== false
  const showInstallments = cardEnabled && installment != null && installment.count > 1

  return (
    <div className="space-y-2.5">
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1"
        aria-label={
          showPixPrice
            ? `Pix com ${pixDiscount}% de desconto: ${formatCurrency(pixPrice)}`
            : `Preço: ${formatCurrency(heroPrice)}`
        }
      >
        {showPixPrice ? <PixIcon className="size-6 shrink-0 text-brand" /> : null}
        <span className="text-[32px] font-black leading-none tracking-tight text-brand tabular-nums md:text-[36px]">
          {formatCurrency(heroPrice)}
        </span>
        {showPixPrice ? (
          <span className="rounded-md bg-brand/10 px-2.5 py-1 text-[13px] font-bold text-brand">
            no Pix
          </span>
        ) : null}
      </div>

      {normalPrice != null ? (
        <p className="text-[15px] leading-normal text-text-muted">
          <span className="line-through tabular-nums">{formatCurrency(normalPrice)}</span>
        </p>
      ) : null}

      {showInstallments && installment ? (
        <p className="flex items-start gap-2 text-[13px] leading-snug text-text-secondary">
          <CreditCard className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
          <span>
            ou{' '}
            <span className="font-semibold text-text-primary tabular-nums">
              {formatCurrency(installment.interestFree ? price : installment.total)}
            </span>{' '}
            em até{' '}
            <span className="font-semibold text-text-primary">
              {installment.count}x de {formatCurrency(installment.value)}
            </span>{' '}
            {installment.interestFree ? 'sem juros' : 'com juros'} no cartão
          </span>
        </p>
      ) : null}
    </div>
  )
}
