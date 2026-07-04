import Image from 'next/image'
import { Tag } from 'lucide-react'
import { formatCurrency } from '@/lib/products/format'
import type { ValidatedCartLine } from '@/types/cart'
import type { ShippingQuoteLine } from '@/types/shipping'

type CheckoutOrderSummaryProps = {
  lines: ValidatedCartLine[]
  subtotal: number
  loading?: boolean
  selectedShipping: ShippingQuoteLine | null
  shippingLoading?: boolean
  discountAmount?: number
  total: number
}

export function CheckoutOrderSummary({
  lines,
  subtotal,
  loading = false,
  selectedShipping,
  shippingLoading = false,
  discountAmount = 0,
  total,
}: CheckoutOrderSummaryProps) {
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <div className="border-b border-border bg-surface-muted px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-primary">
            Resumo do pedido
          </h2>
        </div>

        <div className="px-5 py-4">
          <ul className="space-y-4" role="list">
            {lines.map((line) => (
              <li key={line.productId} className="flex gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
                  {line.imageUrl ? (
                    <Image
                      src={line.imageUrl}
                      alt={line.imageAlt}
                      fill
                      sizes="64px"
                      className="object-contain p-1"
                    />
                  ) : null}
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-badge-discount text-[10px] font-bold text-white">
                    {line.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-text-primary">{line.name}</p>
                  <p className="mt-1 text-xs text-text-muted">Qtd: {line.quantity}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-text-primary">
                    {formatCurrency(line.lineTotal)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Cupom de desconto
            </p>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <Tag
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
                  aria-hidden
                />
                <input
                  type="text"
                  disabled
                  placeholder="Insira o código"
                  className="w-full rounded-md border border-border bg-surface-muted py-2.5 pl-9 pr-3 text-sm text-text-muted placeholder:text-text-muted"
                  aria-label="Cupom de desconto"
                />
              </div>
              <button
                type="button"
                disabled
                className="shrink-0 rounded-md border border-border bg-surface-muted px-4 text-xs font-semibold uppercase text-text-muted"
              >
                Aplicar
              </button>
            </div>
            <p className="mt-1.5 text-xs text-text-muted">Cupons em breve.</p>
          </div>

          <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Subtotal</dt>
              <dd className="font-medium tabular-nums text-text-primary">
                {loading ? '…' : formatCurrency(subtotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Frete</dt>
              <dd className="font-medium tabular-nums text-text-primary">
                {shippingLoading
                  ? '…'
                  : selectedShipping
                    ? selectedShipping.isFree
                      ? 'Grátis'
                      : formatCurrency(selectedShipping.price)
                    : '—'}
              </dd>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between gap-4 text-success">
                <dt>Desconto Pix</dt>
                <dd className="font-medium tabular-nums">− {formatCurrency(discountAmount)}</dd>
              </div>
            )}
          </dl>

          <div className="mt-4 flex items-end justify-between gap-4 border-t border-border pt-4">
            <span className="text-sm font-bold uppercase tracking-wide text-text-primary">Total</span>
            <span className="text-2xl font-bold tabular-nums text-success">
              {loading ? '…' : formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
