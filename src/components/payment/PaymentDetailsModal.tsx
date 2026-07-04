'use client'

import { useState, type ReactNode } from 'react'
import { PaymentIconsRow } from '@/components/payment/PaymentIconsRow'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/products/format'
import { calcInstallmentDisplay } from '@/lib/payment/installments'
import { buildInstallmentTable } from '@/lib/payment/installment-table'
import type { CheckoutPaymentSettings, PaymentMethodIcon, PaymentSettings } from '@/types/payment'

type PaymentDetailsTriggerProps = {
  price: number
  paymentSettings: PaymentSettings
  checkoutSettings?: CheckoutPaymentSettings
  paymentIcons: PaymentMethodIcon[]
  layout?: 'default' | 'product'
  triggerContent?: ReactNode
}

export function PaymentDetailsTrigger({
  price,
  paymentSettings,
  checkoutSettings,
  paymentIcons,
  layout = 'default',
  triggerContent,
}: PaymentDetailsTriggerProps) {
  const [open, setOpen] = useState(false)
  const rows = buildInstallmentTable(price, paymentSettings)
  const installmentDisplay = calcInstallmentDisplay(price, paymentSettings)
  const cardEnabled = checkoutSettings?.cardEnabled !== false
  const showInstallmentTable = cardEnabled && rows.length > 0 && installmentDisplay != null
  const showPaymentIcons = paymentIcons.length > 0

  if (!showInstallmentTable && !showPaymentIcons) return null

  const linkLabel =
    layout === 'product'
      ? 'Mais formas de pagamento'
      : 'Ver parcelas e formas de pagamento'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group text-left ${layout === 'product' ? 'w-full pt-1' : 'mt-2 w-full'}`}
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
          <div>
            <p className="text-sm text-text-secondary">Valor do produto</p>
            <p className="text-2xl font-bold text-text-primary">{formatCurrency(price)}</p>
          </div>

          {showInstallmentTable && (
            <div>
              <h3 className="mb-3 text-sm font-bold text-text-primary">Opções de parcelamento</h3>
              <div className="overflow-hidden rounded-sm border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-strong text-left text-xs uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="px-3 py-2.5 font-bold">Parcelas</th>
                      <th className="px-3 py-2.5 font-bold">Valor</th>
                      <th className="px-3 py-2.5 font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row) => (
                      <tr key={row.count} className="text-text-primary">
                        <td className="px-3 py-2.5 font-bold">{row.count}x</td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {formatCurrency(row.installmentValue)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {formatCurrency(row.total)}
                          {row.interestFree ? (
                            <span className="ml-1 text-xs text-success">s/ juros</span>
                          ) : (
                            <span className="ml-1 text-xs text-text-muted">c/ juros</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                Parcela mínima de {formatCurrency(paymentSettings.minInstallmentValue)}. Até{' '}
                {paymentSettings.interestFreeInstallments}x sem juros.
              </p>
            </div>
          )}

          {showPaymentIcons && (
            <div>
              <h3 className="mb-3 text-sm font-bold text-text-primary">
                Formas de pagamento aceitas
              </h3>
              <PaymentIconsRow icons={paymentIcons} size="md" />
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
