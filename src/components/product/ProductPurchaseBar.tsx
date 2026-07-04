'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '@/providers/CartProvider'

type ProductPurchaseBarProps = {
  productId: string
  stock: number
}

export function ProductPurchaseBar({ productId, stock }: ProductPurchaseBarProps) {
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const inStock = stock > 0
  const maxQty = Math.min(99, stock)

  function decrement() {
    setQuantity((q) => Math.max(1, q - 1))
  }

  function increment() {
    setQuantity((q) => Math.min(maxQty, q + 1))
  }

  function handleBuy() {
    if (!inStock) return
    addItem(productId, quantity)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 2500)
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
    <div className="space-y-3">
      <div className="flex items-stretch gap-3">
        <div className="flex shrink-0 items-center rounded-sm border border-border bg-surface">
          <button
            type="button"
            onClick={decrement}
            disabled={quantity <= 1}
            className="flex size-11 items-center justify-center text-lg font-bold text-text-primary transition-colors duration-[400ms] hover:bg-surface-strong disabled:opacity-40"
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
            min={1}
            max={maxQty}
            value={quantity}
            onChange={(e) => {
              const next = parseInt(e.target.value, 10)
              if (!Number.isNaN(next)) {
                setQuantity(Math.min(maxQty, Math.max(1, next)))
              }
            }}
            className="w-12 border-x border-border bg-transparent py-2 text-center text-sm font-bold text-text-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={increment}
            disabled={quantity >= maxQty}
            className="flex size-11 items-center justify-center text-lg font-bold text-text-primary transition-colors duration-[400ms] hover:bg-surface-strong disabled:opacity-40"
            aria-label="Aumentar quantidade"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleBuy}
          className="flex-1 rounded-sm bg-brand px-4 py-3.5 text-base font-bold text-white transition-opacity duration-[400ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-90 active:scale-[0.99]"
        >
          {added ? 'Adicionado!' : 'Comprar'}
        </button>
      </div>

      {added && (
        <Link
          href="/carrinho"
          className="block text-center text-sm font-bold text-brand hover:underline"
        >
          Ver carrinho
        </Link>
      )}
    </div>
  )
}
