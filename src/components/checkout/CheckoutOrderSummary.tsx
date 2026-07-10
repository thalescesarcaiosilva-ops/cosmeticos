'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/products/format'
import type { ValidatedCartLine } from '@/types/cart'
import type { ShippingQuoteLine } from '@/types/shipping'

type CheckoutOrderSummaryProps = {
  lines: ValidatedCartLine[]
  subtotal: number
  bundleDiscountAmount?: number
  loading?: boolean
  selectedShipping: ShippingQuoteLine | null
  shippingLoading?: boolean
  discountAmount?: number
  total: number
  onFinalize?: () => void
  finalizeDisabled?: boolean
  finalizeLoading?: boolean
  finalizeLabel?: string
}

export function CheckoutOrderSummary({
  lines,
  subtotal,
  bundleDiscountAmount = 0,
  loading = false,
  selectedShipping,
  shippingLoading = false,
  discountAmount = 0,
  total,
  onFinalize,
  finalizeDisabled = false,
  finalizeLoading = false,
  finalizeLabel = 'Finalizar pedido',
}: CheckoutOrderSummaryProps) {
  const [itemsOpen, setItemsOpen] = useState(true)
  const lineCount = lines.reduce((acc, line) => acc + line.quantity, 0)

  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-surface lg:sticky lg:top-24 lg:self-start"
      aria-labelledby="checkout-order-summary-title"
    >
      <div className="border-b border-border px-4 py-3 md:px-5">
        <h2 id="checkout-order-summary-title" className="text-sm font-bold text-text-primary md:text-base">
          Resumo do pedido
        </h2>
      </div>

      <div className="px-4 py-4 md:px-5">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">
              Produtos ({lineCount} {lineCount === 1 ? 'item' : 'itens'})
            </dt>
            <dd className="font-medium tabular-nums text-text-primary">
              {loading ? '...' : formatCurrency(subtotal)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Frete</dt>
            <dd className="font-medium tabular-nums text-brand">
              {shippingLoading
                ? '...'
                : selectedShipping
                  ? selectedShipping.isFree
                    ? 'Grátis'
                    : formatCurrency(selectedShipping.price)
                  : '-'}
            </dd>
          </div>
          {bundleDiscountAmount > 0 && (
            <div className="flex justify-between gap-4 text-brand">
              <dt>Desconto Compre Junto</dt>
              <dd className="font-medium tabular-nums">- {formatCurrency(bundleDiscountAmount)}</dd>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="flex justify-between gap-4 text-success">
              <dt>Desconto Pix</dt>
              <dd className="font-medium tabular-nums">- {formatCurrency(discountAmount)}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 flex items-end justify-between gap-4 border-t border-border pt-4">
          <span className="text-sm font-bold text-text-primary">Total do pedido</span>
          <span className="text-xl font-bold tabular-nums text-text-primary md:text-2xl">
            {loading ? '...' : formatCurrency(total)}
          </span>
        </div>

        {onFinalize && (
          <Button
            type="button"
            className="mt-4 w-full rounded-md py-3 text-sm font-bold uppercase tracking-wide"
            loading={finalizeLoading}
            disabled={finalizeDisabled || finalizeLoading}
            onClick={onFinalize}
          >
            {finalizeLabel}
          </Button>
        )}

        <div className="mt-5 border-t border-border pt-4">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setItemsOpen((open) => !open)}
            aria-expanded={itemsOpen}
          >
            <span className="text-sm font-semibold text-text-primary">
              Itens do pedido ({lineCount})
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-text-muted transition-transform ${
                itemsOpen ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>

          {itemsOpen && (
            <ul className="mt-3 space-y-3" role="list">
              {lines.map((line) => (
                <li key={line.productId} className="flex gap-3">
                  <div className="relative shrink-0">
                    <div className="flex size-14 items-center justify-center rounded-md border border-border bg-white p-1">
                      {line.imageUrl ? (
                        <Image
                          src={line.imageUrl}
                          alt={line.imageAlt}
                          width={48}
                          height={48}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-text-muted">Sem foto</span>
                      )}
                    </div>
                    <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-white">
                      {line.quantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-medium text-text-primary md:text-sm">
                      {line.quantity}x {line.name}
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-text-primary">
                      {formatCurrency(line.displayLineTotal ?? line.lineTotal)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
