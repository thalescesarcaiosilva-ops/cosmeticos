'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'
import { SiteImage } from '@/components/ui/SiteImage'
import { trackFunnel } from '@/lib/analytics/track-funnel'
import { formatCurrency } from '@/lib/products/format'
import { useCart } from '@/providers/CartProvider'

type ProductPurchaseBarProps = {
  productId: string
  stock: number
  productName?: string
  price?: number
  imageUrl?: string | null
  imageAlt?: string
}

export function ProductPurchaseBar({
  productId,
  stock,
  productName,
  price,
  imageUrl,
  imageAlt,
}: ProductPurchaseBarProps) {
  const router = useRouter()
  const { addItem, upsertItem, openCartDrawer, closeCartDrawer } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [buyingNow, setBuyingNow] = useState(false)

  const inStock = stock > 0
  const maxQty = Math.min(99, stock)

  function decrement() {
    setQuantity((q) => Math.max(1, q - 1))
  }

  function increment() {
    setQuantity((q) => Math.min(maxQty, q + 1))
  }

  function handleAddToCart() {
    if (!inStock) return
    addItem(productId, quantity)
    trackFunnel('cart_add')
    setAdded(true)
    openCartDrawer()
    window.setTimeout(() => setAdded(false), 2500)
  }

  function handleBuyNow() {
    if (!inStock || buyingNow) return
    setBuyingNow(true)
    upsertItem(productId, quantity)
    trackFunnel('cart_add')
    closeCartDrawer()
    router.push('/checkout')
  }

  if (!inStock) {
    return (
      <>
        <button
          type="button"
          disabled
          className="w-full rounded-sm bg-text-muted px-4 py-3.5 text-center text-base font-bold text-white opacity-80"
        >
          Indisponível
        </button>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(74,32,42,0.08)] lg:hidden">
          <div className="mx-auto flex max-w-[1300px] items-center gap-3">
            {imageUrl ? (
              <div className="relative size-12 shrink-0 overflow-hidden rounded-sm border border-border bg-surface">
                <SiteImage
                  src={imageUrl}
                  alt={imageAlt || productName || ''}
                  fill
                  sizes="48px"
                  className="object-contain p-1"
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              {productName ? (
                <p className="truncate text-xs font-medium text-text-primary">{productName}</p>
              ) : null}
              {price != null ? (
                <p className="mt-0.5 text-sm font-bold tabular-nums text-text-primary">
                  {formatCurrency(price)}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled
              className="shrink-0 rounded-sm bg-text-muted px-4 py-3 text-sm font-bold text-white opacity-80"
            >
              Indisponível
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-stretch gap-2 sm:gap-3">
        <div className="flex h-14 w-[6.5rem] shrink-0 items-center overflow-hidden rounded-2xl border border-[#f3d0dc] bg-white">
          <button
            type="button"
            onClick={decrement}
            disabled={quantity <= 1}
            className="flex h-full w-8 shrink-0 items-center justify-center text-lg text-text-primary transition-colors duration-[400ms] hover:bg-surface-strong disabled:opacity-40"
            aria-label="Diminuir quantidade"
          >
            −
          </button>
          <label className="sr-only" htmlFor="product-qty">
            Quantidade
          </label>
          <input
            id="product-qty"
            type="number"
            inputMode="numeric"
            min={1}
            max={maxQty}
            value={quantity}
            onChange={(e) => {
              const next = parseInt(e.target.value, 10)
              if (!Number.isNaN(next)) {
                setQuantity(Math.min(maxQty, Math.max(1, next)))
              }
            }}
            className="min-w-0 flex-1 border-x border-border bg-transparent text-center text-base font-semibold text-text-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={increment}
            disabled={quantity >= maxQty}
            className="flex h-full w-8 shrink-0 items-center justify-center text-lg text-text-primary transition-colors duration-[400ms] hover:bg-surface-strong disabled:opacity-40"
            aria-label="Aumentar quantidade"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleBuyNow}
          disabled={buyingNow}
          className="flex h-14 min-w-0 flex-1 items-center justify-center rounded-2xl bg-brand px-3 text-[13px] font-bold tracking-[0.06em] text-white shadow-[0_10px_24px_rgba(211,52,100,0.38)] transition-transform duration-[400ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:bg-brand-hover active:translate-y-0 disabled:translate-y-0 disabled:opacity-70 sm:px-4 sm:text-[15px] sm:tracking-[0.08em]"
        >
          {buyingNow ? 'INDO…' : 'COMPRAR AGORA'}
        </button>
      </div>

      <button
        type="button"
        onClick={handleAddToCart}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-brand/70 bg-white px-4 text-[13px] font-bold tracking-[0.08em] text-brand transition-colors duration-[400ms] hover:bg-brand/5 active:scale-[0.99]"
      >
        <ShoppingCart className="size-5 shrink-0" aria-hidden />
        {added ? 'ADICIONADO' : 'ADICIONAR AO CARRINHO'}
      </button>

      {added && (
        <p className="text-center text-sm font-semibold text-success">
          ✓ Adicionado ao carrinho
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(74,32,42,0.08)] lg:hidden">
        <div className="mx-auto flex max-w-[1300px] items-center gap-3">
          {imageUrl ? (
            <div className="relative size-12 shrink-0 overflow-hidden rounded-sm border border-border bg-surface">
              <SiteImage
                src={imageUrl}
                alt={imageAlt || productName || ''}
                fill
                sizes="48px"
                className="object-contain p-1"
              />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            {productName ? (
              <p className="truncate text-xs font-medium text-text-primary">{productName}</p>
            ) : null}
            {price != null ? (
              <p className="mt-0.5 text-sm font-bold tabular-nums text-text-primary">
                {formatCurrency(price)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={buyingNow}
            className="shrink-0 rounded-sm bg-brand px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
          >
            {buyingNow ? '...' : 'Comprar'}
          </button>
        </div>
      </div>
    </div>
  )
}
