'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/providers/CartProvider'

function CartPlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M21 5L19 12H7.37671M20 16H8L6 3H3M16 5.5H13.5M13.5 5.5H11M13.5 5.5V8M13.5 5.5V3M9 20C9 20.5523 8.55228 21 8 21C7.44772 21 7 20.5523 7 20C7 19.4477 7.44772 19 8 19C8.55228 19 9 19.4477 9 20ZM20 20C20 20.5523 19.5523 21 19 21C18.4477 21 18 20.5523 18 20C18 19.4477 18.4477 19 19 19C19.5523 19 20 19.4477 20 20Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type ProductPurchaseBarProps = {
  productId: string
  stock: number
}

export function ProductPurchaseBar({ productId, stock }: ProductPurchaseBarProps) {
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
    setAdded(true)
    openCartDrawer()
    window.setTimeout(() => setAdded(false), 2500)
  }

  function handleBuyNow() {
    if (!inStock || buyingNow) return
    setBuyingNow(true)
    upsertItem(productId, quantity)
    closeCartDrawer()
    router.push('/checkout')
  }

  if (!inStock) {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-sm bg-text-muted px-4 py-3.5 text-center text-base font-bold text-white opacity-80"
      >
        Indisponível
      </button>
    )
  }

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={handleBuyNow}
        disabled={buyingNow}
        className="flex w-full items-center justify-center rounded-sm bg-brand px-4 py-3.5 text-base font-bold text-white transition-opacity duration-[400ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-90 active:scale-[0.99] disabled:opacity-70"
      >
        {buyingNow ? 'Indo para o checkout…' : 'Compre agora'}
      </button>

      <div className="flex items-stretch gap-2">
        <div className="flex h-11 shrink-0 items-center rounded-sm border border-border bg-surface">
          <button
            type="button"
            onClick={decrement}
            disabled={quantity <= 1}
            className="flex h-full w-8 shrink-0 items-center justify-center text-lg font-bold text-text-primary transition-colors duration-[400ms] hover:bg-surface-strong disabled:opacity-40 sm:w-11"
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
            className="w-8 border-x border-border bg-transparent text-center text-base font-bold text-text-primary [appearance:textfield] sm:w-12 sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={increment}
            disabled={quantity >= maxQty}
            className="flex h-full w-8 shrink-0 items-center justify-center text-lg font-bold text-text-primary transition-colors duration-[400ms] hover:bg-surface-strong disabled:opacity-40 sm:w-11"
            aria-label="Aumentar quantidade"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-sm border border-brand bg-surface px-3 py-2.5 text-xs font-bold leading-tight text-brand transition-colors duration-[400ms] hover:bg-brand/5 active:scale-[0.99] sm:text-sm"
        >
          <CartPlusIcon className="size-5 shrink-0" />
          <span className="text-center">{added ? 'Adicionado!' : 'Adicionar ao carrinho'}</span>
        </button>
      </div>

      {added && (
        <p className="text-center text-sm font-semibold text-success">
          ✓ Adicionado ao carrinho
        </p>
      )}
    </div>
  )
}
