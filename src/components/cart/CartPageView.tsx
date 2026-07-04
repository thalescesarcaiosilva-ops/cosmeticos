'use client'

import Link from 'next/link'
import { CartEmptyState } from '@/components/cart/CartEmptyState'
import { CartLineItem } from '@/components/cart/CartLineItem'
import { CartSummary } from '@/components/cart/CartSummary'
import { Alert } from '@/components/ui/Alert'
import { useCartSync } from '@/hooks/useCartSync'
import { useCart } from '@/providers/CartProvider'

function CartSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando carrinho">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex gap-4 border-b border-border py-5">
          <div className="size-24 animate-pulse rounded-lg bg-surface-muted" />
          <div className="flex flex-1 flex-col gap-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface-muted" />
            <div className="h-4 w-1/4 animate-pulse rounded bg-surface-muted" />
            <div className="h-9 w-28 animate-pulse rounded bg-surface-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CartPageView() {
  const { items } = useCart()
  const { data, loading, error } = useCartSync()

  const isEmpty = items.length === 0 && !loading
  const showContent = data && data.lines.length > 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <nav className="mb-6 text-sm text-text-secondary" aria-label="Breadcrumb">
        <p>
          <Link href="/" className="hover:text-brand">
            Início
          </Link>
          <span className="mx-2">›</span>
          <span className="text-text-primary">Carrinho</span>
        </p>
      </nav>

      <h1 className="text-2xl font-bold text-text-primary md:text-3xl">Meu carrinho</h1>

      {error && (
        <div className="mt-4">
          <Alert type="error">{error}</Alert>
        </div>
      )}

      {data?.warnings && data.warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {[...new Set(data.warnings)].map((warning) => (
            <Alert key={warning} type="error">
              {warning}
            </Alert>
          ))}
        </div>
      )}

      {isEmpty ? (
        <div className="mt-8">
          <CartEmptyState />
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px] lg:gap-10">
          <section aria-labelledby="cart-items-heading">
            <h2 id="cart-items-heading" className="sr-only">
              Itens do carrinho
            </h2>

            {loading && !data ? (
              <CartSkeleton />
            ) : showContent ? (
              <ul role="list" className="divide-y divide-border rounded-lg border border-border bg-surface px-4 sm:px-5">
                {data.lines.map((line) => (
                  <CartLineItem key={line.productId} line={line} updating={loading} />
                ))}
              </ul>
            ) : (
              <CartEmptyState />
            )}
          </section>

          {showContent && (
            <CartSummary data={data} loading={loading} />
          )}
        </div>
      )}
    </div>
  )
}
