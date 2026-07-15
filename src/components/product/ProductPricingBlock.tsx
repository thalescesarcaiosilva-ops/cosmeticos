'use client'

import { ChevronRight } from 'lucide-react'
import { PaymentDetailsTrigger } from '@/components/payment/PaymentDetailsModal'
import { calcDiscountPercent, formatCurrency } from '@/lib/products/format'
import { buildProductPaymentSummary } from '@/lib/payment/product-payment-summary'
import type { CheckoutPaymentSettings, PaymentSettings } from '@/types/payment'

type ProductPricingBlockProps = {
  price: number
  originalPrice: number | null
  paymentSettings: PaymentSettings
  checkoutSettings: CheckoutPaymentSettings
}

function CreditCardMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="2.75"
        y="5.75"
        width="18.5"
        height="12.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M7 15.25h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PixMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M11.917 11.71a2.046 2.046 0 0 1-1.454-.602l-2.1-2.1a.4.4 0 0 0-.551 0l-2.108 2.108a2.044 2.044 0 0 1-1.454.602h-.414l2.66 2.66c.83.83 2.177.83 3.007 0l2.667-2.668h-.253zM4.25 4.282c.55 0 1.066.214 1.454.602l2.108 2.108a.39.39 0 0 0 .552 0l2.1-2.1a2.044 2.044 0 0 1 1.453-.602h.253L9.503 1.623a2.127 2.127 0 0 0-3.007 0l-2.66 2.66h.414z"
        fill="currentColor"
      />
      <path
        d="m14.377 6.496-1.612-1.612a.307.307 0 0 1-.114.023h-.733c-.379 0-.75.154-1.017.422l-2.1 2.1a1.005 1.005 0 0 1-1.425 0L5.268 5.32a1.448 1.448 0 0 0-1.018-.422h-.9a.306.306 0 0 1-.109-.021L1.623 6.496c-.83.83-.83 2.177 0 3.008l1.618 1.618a.305.305 0 0 1 .108-.022h.901c.38 0 .75-.153 1.018-.421L7.375 8.57a1.034 1.034 0 0 1 1.426 0l2.1 2.1c.267.268.638.421 1.017.421h.733c.04 0 .079.01.114.024l1.612-1.612c.83-.83.83-2.178 0-3.008z"
        fill="currentColor"
      />
    </svg>
  )
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
            <span className="flex items-center gap-2 text-text-secondary">
              <CreditCardMark className="size-[18px] shrink-0" />
              <PixMark className="size-[18px] shrink-0" />
            </span>
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
