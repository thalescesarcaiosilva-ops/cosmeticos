'use client'

import { CreditCard, ChevronRight } from 'lucide-react'
import { PaymentDetailsTrigger } from '@/components/payment/PaymentDetailsModal'
import { PaymentMethodsImage } from '@/components/payment/PaymentMethodsImage'
import { PixIcon } from '@/components/product/PixDiscountBadge'
import { calcDiscountPercent, formatCurrency } from '@/lib/products/format'
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
  /* ── desconto real do produto (promoção de produto, não de pagamento) ── */
  const hasProductDiscount = originalPrice != null && originalPrice > price
  const productDiscount = calcDiscountPercent(price, originalPrice)
  const productSavings = hasProductDiscount && originalPrice != null
    ? Math.max(0, originalPrice - price)
    : 0

  /* ── Pix ── */
  const pixEnabled = checkoutSettings.pixEnabled !== false
  const pixDiscount = pixEnabled ? Math.max(0, Number(checkoutSettings.pixDiscount) || 0) : 0
  const showPixCard = pixDiscount > 0
  const pixPrice = showPixCard ? calcPixPrice(price, pixDiscount) : price

  /* ── Parcelas ── */
  const installment = calcInstallmentDisplay(price, paymentSettings)
  const cardEnabled = checkoutSettings.cardEnabled !== false
  const showInstallments = cardEnabled && installment != null && installment.count > 1

  return (
    <div className="space-y-3">

      {/* ── Desconto de produto (promoção real) ── */}
      {hasProductDiscount && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-text-muted line-through tabular-nums">
            {formatCurrency(originalPrice!)}
          </span>
          {productDiscount != null && (
            <span className="inline-flex items-center rounded-full bg-coffee px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-text-on-dark">
              −{productDiscount}%
            </span>
          )}
          {productSavings > 0 && (
            <span className="text-[12px] font-medium text-text-secondary">
              Economia de {formatCurrency(productSavings)}
            </span>
          )}
        </div>
      )}

      {/* ── Preço Pix (acima do preço normal, quando houver desconto Pix) ── */}
      {showPixCard && (
        <div
          className="flex items-center gap-3"
          aria-label={`Pix com ${pixDiscount}% de desconto: ${formatCurrency(pixPrice)}`}
        >
          <PixIcon className="size-6 shrink-0 text-brand" />
          <span className="text-[32px] font-black leading-none tracking-tight text-claret tabular-nums md:text-[36px]">
            {formatCurrency(pixPrice)}
          </span>
          <span className="rounded-md bg-claret/10 px-2.5 py-1 text-[12px] font-bold text-claret">
            no Pix
          </span>
        </div>
      )}

      {/* ── Preço base do produto ── */}
      <p
        className="text-[22px] font-medium leading-none text-text-muted tabular-nums"
        aria-label={`Preço: ${formatCurrency(price)}`}
      >
        {formatCurrency(price)}
      </p>

      {/* ── Parcelas no cartão ── */}
      {showInstallments && installment && (
        <div className="flex items-start gap-2 text-[13px] leading-snug text-text-secondary">
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
        </div>
      )}

      {/* ── Formas de pagamento ── */}
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
