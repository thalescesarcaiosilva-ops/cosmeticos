'use client'

import { ChevronRight } from 'lucide-react'
import { PaymentDetailsTrigger } from '@/components/payment/PaymentDetailsModal'
import { PaymentMethodsImage } from '@/components/payment/PaymentMethodsImage'
import { calcDiscountPercent, formatCurrency } from '@/lib/products/format'
import { buildProductPaymentSummary } from '@/lib/payment/product-payment-summary'
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
  const hasDiscount = originalPrice != null && originalPrice > price
  const discount = calcDiscountPercent(price, originalPrice)
  const paymentSummary = buildProductPaymentSummary(price, paymentSettings, checkoutSettings)
  const savings =
    hasDiscount && originalPrice != null ? Math.max(0, originalPrice - price) : 0

  return (
    <div className="space-y-3">
      {hasDiscount && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-text-muted line-through tabular-nums">
            {formatCurrency(originalPrice)}
          </span>
          {discount != null && (
            <span className="inline-flex items-center rounded-full bg-coffee px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-text-on-dark">
              −{discount}%
            </span>
          )}
          {savings > 0 && (
            <span className="text-[12px] font-medium text-text-secondary">
              Economia de {formatCurrency(savings)}
            </span>
          )}
        </div>
      )}

      <p className="text-[32px] font-bold leading-none tracking-tight text-text-primary tabular-nums md:text-[36px]">
        {formatCurrency(price)}
      </p>

      {paymentSummary && (
        <p className="max-w-md text-[14px] leading-snug text-text-secondary">{paymentSummary}</p>
      )}

      <PaymentDetailsTrigger
        price={price}
        paymentSettings={paymentSettings}
        checkoutSettings={checkoutSettings}
        layout="product"
        triggerContent={
          <span className="flex w-full items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 transition-colors duration-200 group-hover:border-text-muted/40 group-hover:bg-surface-strong/40">
            <PaymentMethodsImage size="sm" className="shrink-0" />
            <span className="flex-1 text-left text-[13px] font-semibold text-text-primary">
              Formas de pagamento
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-text-muted transition-transform duration-200 group-hover:translate-x-0.5"
              strokeWidth={2}
              aria-hidden
            />
          </span>
        }
      />
    </div>
  )
}
