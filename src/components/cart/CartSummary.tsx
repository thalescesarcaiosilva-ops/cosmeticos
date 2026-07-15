'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ShippingCalculator, type ShippingQuoteLine } from '@/components/shipping/ShippingCalculator'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/products/format'
import type { CartSyncResult } from '@/types/cart'

type CartSummaryProps = {
  data: CartSyncResult
  loading?: boolean
}

export function CartSummary({ data, loading = false }: CartSummaryProps) {
  const [selectedShipping, setSelectedShipping] = useState<ShippingQuoteLine | null>(null)
  const shippingPrice = selectedShipping?.price ?? 0
  const merchandiseTotal = data.merchandiseTotal
  const total = merchandiseTotal + shippingPrice
  const availableLines = data.lines.filter((line) => line.available && line.quantity > 0)

  return (
    <aside className="space-y-4 lg:sticky lg:top-24">
      <div className="rounded-xl border border-border bg-surface p-5 shadow-[0_1px_0_rgba(74,32,42,0.04)] md:p-6">
        <h2 className="text-base font-bold text-text-primary">Resumo do pedido</h2>

        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">
              Subtotal ({data.itemCount} {data.itemCount === 1 ? 'item' : 'itens'})
            </dt>
            <dd className="font-semibold text-text-primary tabular-nums">
              {loading ? '…' : formatCurrency(data.subtotal)}
            </dd>
          </div>

          {data.bundleDiscountAmount > 0 && (
            <div className="flex justify-between gap-4 text-claret">
              <dt>Desconto Compre Junto</dt>
              <dd className="font-semibold tabular-nums">
                − {loading ? '…' : formatCurrency(data.bundleDiscountAmount)}
              </dd>
            </div>
          )}

          {selectedShipping ? (
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Frete ({selectedShipping.name})</dt>
              <dd className="font-semibold text-text-primary tabular-nums">
                {selectedShipping.isFree ? 'Grátis' : formatCurrency(shippingPrice)}
              </dd>
            </div>
          ) : (
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Frete</dt>
              <dd className="text-text-muted">Calcule abaixo</dd>
            </div>
          )}

          <div className="flex justify-between gap-4 border-t border-border pt-3">
            <dt className="text-base font-semibold text-text-primary">Total</dt>
            <dd className="text-xl font-bold text-text-primary tabular-nums">
              {loading ? '…' : formatCurrency(total)}
            </dd>
          </div>
        </dl>

        <div className="mt-5 space-y-2.5">
          <Link
            href="/checkout"
            className={`block ${availableLines.length === 0 ? 'pointer-events-none' : ''}`}
          >
            <Button
              type="button"
              className="w-full !rounded-md py-3"
              disabled={loading || availableLines.length === 0}
            >
              Finalizar compra
            </Button>
          </Link>
          <Link href="/" className="block">
            <Button type="button" variant="secondary" className="w-full !rounded-md">
              Continuar comprando
            </Button>
          </Link>
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-text-muted">
          Frete e prazo são confirmados no checkout. Pagamento seguro via Pix ou cartão.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-cream/70 p-5 md:p-6">
        <ShippingCalculator
          key={merchandiseTotal}
          subtotal={merchandiseTotal}
          onSelect={setSelectedShipping}
        />
      </div>
    </aside>
  )
}
