'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { CreditCard } from 'lucide-react'
import { PaymentMethodsImage } from '@/components/payment/PaymentMethodsImage'
import { PixIcon } from '@/components/product/PixDiscountBadge'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/products/format'
import { calcInstallmentDisplay } from '@/lib/payment/installments'
import { buildInstallmentTable } from '@/lib/payment/installment-table'
import { hasPaymentMethodsImage } from '@/lib/payment/payment-methods-image'
import { calcPixPrice } from '@/lib/payment/product-payment-summary'
import type { CheckoutPaymentSettings, PaymentSettings } from '@/types/payment'

type PaymentDetailsTriggerProps = {
  price: number
  paymentSettings: PaymentSettings
  checkoutSettings?: CheckoutPaymentSettings
  layout?: 'default' | 'product'
  triggerContent?: ReactNode
}

export function PaymentDetailsTrigger({
  price,
  paymentSettings,
  checkoutSettings,
  layout = 'default',
  triggerContent,
}: PaymentDetailsTriggerProps) {
  const [open, setOpen] = useState(false)

  const pixEnabled = checkoutSettings?.pixEnabled !== false
  const cardEnabled = checkoutSettings?.cardEnabled !== false
  const pixDiscount = pixEnabled ? Math.max(0, Number(checkoutSettings?.pixDiscount) || 0) : 0
  const pixPrice = pixDiscount > 0 ? calcPixPrice(price, pixDiscount) : price
  const pixSavings = pixDiscount > 0 ? Math.max(0, price - pixPrice) : 0

  const rows = useMemo(
    () => (cardEnabled ? buildInstallmentTable(price, paymentSettings) : []),
    [cardEnabled, price, paymentSettings]
  )
  const installmentDisplay = calcInstallmentDisplay(price, paymentSettings)
  const interestFreeRows = rows.filter((row) => row.interestFree)
  const interestRows = rows.filter((row) => !row.interestFree)

  const showInstallmentTable = cardEnabled && rows.length > 0 && installmentDisplay != null
  const showPixSection = pixEnabled
  const showPaymentIcons = hasPaymentMethodsImage()
  const canOpen = showInstallmentTable || showPixSection || showPaymentIcons

  if (!canOpen) return null

  if (layout === 'product' && !triggerContent) return null

  const linkLabel =
    layout === 'product' ? 'Ver formas de pagamento' : 'Ver parcelas e formas de pagamento'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group text-left ${layout === 'product' ? 'w-full' : 'mt-2 w-full'}`}
        aria-haspopup="dialog"
        aria-label={linkLabel}
      >
        {layout === 'product' && triggerContent ? (
          <span className="block transition-opacity duration-[400ms] group-hover:opacity-80">
            {triggerContent}
          </span>
        ) : installmentDisplay ? (
          <>
            <p className="text-sm text-text-secondary">{installmentDisplay.label}</p>
            <span className="mt-1 inline-block text-xs font-medium text-brand group-hover:underline">
              {linkLabel}
            </span>
          </>
        ) : (
          <span className="inline-block text-xs font-medium text-brand group-hover:underline">
            {linkLabel}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Formas de pagamento" size="lg">
        <div className="space-y-6">
          <div className="rounded-md bg-surface-muted/40 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Valor do produto
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
              {formatCurrency(price)}
            </p>
          </div>

          {showPixSection ? (
            <section className="space-y-3" aria-labelledby="payment-pix-heading">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md bg-[#e8f7ef] text-[#178a45]">
                  <PixIcon className="size-4" />
                </span>
                <div>
                  <h3 id="payment-pix-heading" className="text-sm font-bold text-text-primary">
                    Pix
                  </h3>
                  <p className="text-xs text-text-muted">Aprovação imediata</p>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-text-muted">Total no Pix</p>
                    <p className="mt-0.5 text-xl font-bold tabular-nums text-text-primary">
                      {formatCurrency(pixPrice)}
                    </p>
                  </div>
                  {pixDiscount > 0 && pixSavings > 0 ? (
                    <p className="text-sm text-text-secondary">
                      <span className="font-semibold text-[#178a45]">−{pixDiscount}%</span>
                      <span className="text-text-muted">
                        {' '}
                        · economia de {formatCurrency(pixSavings)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-text-secondary">Pagamento à vista</p>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {showInstallmentTable ? (
            <section className="space-y-3" aria-labelledby="payment-card-heading">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md bg-[#fff0f5] text-brand">
                  <CreditCard className="size-4" aria-hidden />
                </span>
                <div>
                  <h3 id="payment-card-heading" className="text-sm font-bold text-text-primary">
                    Cartão de crédito
                  </h3>
                  <p className="text-xs text-text-muted">
                    Em até {paymentSettings.maxInstallments}x
                    {paymentSettings.interestFreeInstallments > 0
                      ? ` · até ${paymentSettings.interestFreeInstallments}x sem juros`
                      : null}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-strong text-left text-[11px] uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="px-3 py-2.5 font-bold">Parcelas</th>
                      <th className="px-3 py-2.5 font-bold">Valor da parcela</th>
                      <th className="px-3 py-2.5 font-bold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {interestFreeRows.map((row) => (
                      <tr key={`free-${row.count}`} className="text-text-primary">
                        <td className="px-3 py-2.5 font-semibold">{row.count}x</td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {formatCurrency(row.installmentValue)}
                          <span className="ml-2 text-xs font-medium text-success">sem juros</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatCurrency(row.total)}
                        </td>
                      </tr>
                    ))}
                    {interestRows.map((row) => (
                      <tr key={`interest-${row.count}`} className="text-text-primary">
                        <td className="px-3 py-2.5 font-semibold">{row.count}x</td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {formatCurrency(row.installmentValue)}
                          <span className="ml-2 text-xs text-text-muted">com juros</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">
                          {formatCurrency(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-text-muted">
                Parcela mínima de {formatCurrency(paymentSettings.minInstallmentValue)}. Os valores
                com juros já incluem a taxa de parcelamento do cartão.
              </p>
            </section>
          ) : null}

          {showPaymentIcons ? (
            <section className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-bold text-text-primary">Bandeiras aceitas</h3>
              <PaymentMethodsImage size="md" />
            </section>
          ) : null}
        </div>
      </Modal>
    </>
  )
}
