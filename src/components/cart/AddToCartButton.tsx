'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useCart } from '@/providers/CartProvider'

type AddToCartButtonProps = {
  productId: string
  stock: number
  className?: string
}

export function AddToCartButton({ productId, stock, className = '' }: AddToCartButtonProps) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)

  const inStock = stock > 0

  function handleAdd() {
    if (!inStock) return
    addItem(productId, 1)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 2000)
  }

  if (!inStock) {
    return (
      <button
        type="button"
        disabled
        className={`w-full rounded-md bg-text-muted px-4 py-3.5 text-center text-white opacity-80 ${className}`}
      >
        <span className="block text-lg font-bold">Indisponível</span>
      </button>
    )
  }

  if (added) {
    return (
      <div className={`space-y-2 ${className}`}>
        <button
          type="button"
          disabled
          className="w-full rounded-md bg-success px-4 py-3.5 text-center text-white"
        >
          <span className="block text-lg font-bold">Adicionado!</span>
        </button>
        <Link
          href="/carrinho"
          className="block w-full rounded-md border border-brand py-2.5 text-center text-sm font-semibold text-brand hover:bg-brand/5"
        >
          Ver carrinho
        </Link>
      </div>
    )
  }

  return (
    <Button
      type="button"
      onClick={handleAdd}
      className={`w-full rounded-md py-3.5 text-lg ${className}`}
    >
      Adicionar ao carrinho
    </Button>
  )
}
