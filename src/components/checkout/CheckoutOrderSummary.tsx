'use client'

import { SiteImage } from '@/components/ui/SiteImage'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/products/format'
import type { ValidatedCartLine } from '@/types/cart'
import type { ShippingQuoteLine } from '@/types/shipping'

type CheckoutOrderSummaryProps = {
  lines: ValidatedCartLine[]
  subtotal: number
  merchandiseTotal: number
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
  /** Esconde o botão de avanço no mobile, quando a etapa já tem o próprio CTA. */
  hideFinalizeOnMobile?: boolean
}

export function CheckoutOrderSummary({
  lines,
  subtotal,
  merchandiseTotal,
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
  hideFinalizeOnMobile = false,
}: CheckoutOrderSummaryProps) {
  const lineCount = lines.reduce((acc, line) => acc + line.quantity, 0)
  const productLabel = lineCount === 1 ? '1 produto' : `${lineCount} produtos`
  const showPix = discountAmount > 0
  const freightLabel =
    selectedShipping && !selectedShipping.isFree ? `Frete · ${selectedShipping.name}` : 'Entrega padrão'

  return (
    <section
      className="overflow-hidden rounded-3xl border border-[#f3d0dc] bg-white lg:sticky lg:top-28 lg:self-start"
      aria-labelledby="checkout-order-summary-title"
    >
      <div className="bg-[#1a1014] px-4 py-3.5 md:px-5">
        <h2
          id="checkout-order-summary-title"
          className="text-[13px] font-bold tracking-[0.12em] text-white"
        >
          RESUMO DO PEDIDO
        </h2>
      </div>

      <div className="px-4 py-4 md:px-5">
        <ul className="space-y-3" role="list">
          {lines.map((line) => (
            <li key={line.productId} className="flex items-center gap-3">
              <div className="relative size-12 shrink-0">
                {line.imageUrl ? (
                  <SiteImage
                    src={line.imageUrl}
                    alt={line.imageAlt}
                    width={48}
                    height={48}
                    className="size-12 object-contain"
                  />
                ) : (
                  <span className="flex size-12 items-center justify-center text-[10px] text-text-muted">
                    Sem foto
                  </span>
                )}
              </div>
              <p className="min-w-0 flex-1 line-clamp-2 text-[13px] font-medium leading-snug text-text-primary">
                {line.quantity}x {line.name}
              </p>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-text-primary">
                {formatCurrency(line.displayLineTotal ?? line.lineTotal)}
              </p>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 border-t border-[#f3d0dc] pt-4 text-[13px]">
          {bundleDiscountAmount > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Produtos</dt>
              <dd className="tabular-nums text-text-primary">
                {loading ? '...' : formatCurrency(subtotal)}
              </dd>
            </div>
          )}
          {bundleDiscountAmount > 0 && (
            <div className="flex justify-between gap-4 text-[#178a45]">
              <dt>Desconto Compre Junto</dt>
              <dd className="font-semibold tabular-nums">
                − {loading ? '...' : formatCurrency(bundleDiscountAmount)}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Subtotal ({productLabel})</dt>
            <dd className="font-medium tabular-nums text-text-primary">
              {loading ? '...' : formatCurrency(merchandiseTotal)}
            </dd>
          </div>
          {showPix && (
            <div className="flex justify-between gap-4 text-[#178a45]">
              <dt className="font-medium">Desconto no PIX</dt>
              <dd className="font-semibold tabular-nums">
                − {loading ? '...' : formatCurrency(discountAmount)}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">{freightLabel}</dt>
            <dd className="font-medium tabular-nums text-text-primary">
              {shippingLoading
                ? '...'
                : selectedShipping && !selectedShipping.isFree
                  ? formatCurrency(selectedShipping.price)
                  : 'Grátis'}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex items-end justify-between gap-4 border-t border-[#f3d0dc] pt-4">
          <span className="text-base font-bold text-text-primary">
            {showPix ? 'Total no PIX' : 'Total'}
          </span>
          <span className="text-2xl font-bold tabular-nums text-brand">
            {loading ? '...' : formatCurrency(total)}
          </span>
        </div>

        {onFinalize && (
          <div className={hideFinalizeOnMobile ? 'hidden lg:block' : undefined}>
            <Button
              type="button"
              className="mt-4 w-full !rounded-2xl py-3.5 text-sm font-bold tracking-wide shadow-[0_10px_24px_rgba(211,52,100,0.28)]"
              loading={finalizeLoading}
              disabled={finalizeDisabled || finalizeLoading}
              onClick={onFinalize}
            >
              {finalizeLabel}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
