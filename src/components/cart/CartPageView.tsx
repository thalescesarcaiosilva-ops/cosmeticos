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
    <div className="space-y-0 divide-y divide-border" aria-busy="true" aria-label="Carregando carrinho">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex gap-4 py-5">
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
  const itemCount = data?.itemCount ?? items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <nav className="mb-5 text-[13px] text-text-secondary" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-1.5">
          <li>
            <Link href="/" className="transition-colors hover:text-text-primary">
              Início
            </Link>
          </li>
          <li aria-hidden className="text-text-muted">
            ›
          </li>
          <li className="text-text-primary" aria-current="page">
            Carrinho
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-[32px]">
            Meu carrinho
          </h1>
          {!isEmpty && (
            <p className="mt-1 text-sm text-text-secondary">
              {itemCount} {itemCount === 1 ? 'item' : 'itens'} selecionado
              {itemCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
        {!isEmpty && (
          <Link
            href="/"
            className="text-sm font-semibold text-text-secondary underline-offset-2 transition-colors hover:text-text-primary hover:underline"
          >
            Continuar comprando
          </Link>
        )}
      </header>

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
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-10">
          <section aria-labelledby="cart-items-heading">
            <h2 id="cart-items-heading" className="sr-only">
              Itens do carrinho
            </h2>

            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              {loading && !data ? (
                <div className="px-4 sm:px-5">
                  <CartSkeleton />
                </div>
              ) : showContent ? (
                <ul role="list" className="divide-y divide-border px-4 sm:px-5">
                  {data.lines.map((line) => (
                    <CartLineItem key={line.productId} line={line} updating={loading} />
                  ))}
                </ul>
              ) : (
                <div className="p-4">
                  <CartEmptyState />
                </div>
              )}
            </div>
          </section>

          {showContent && <CartSummary data={data} loading={loading} />}
        </div>
      )}
    </div>
  )
}
