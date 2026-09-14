'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useCart } from '@/providers/CartProvider'

type AddToCartButtonProps = {
  productId: string
  stock: number
  className?: string
}

export function AddToCartButton({ productId, stock, className = '' }: AddToCartButtonProps) {
  const { addItem, openCartDrawer } = useCart()
  const [added, setAdded] = useState(false)

  const inStock = stock > 0

  function handleAdd() {
    if (!inStock) return
    addItem(productId, 1)
    setAdded(true)
    // Abre o drawer lateral do carrinho
    openCartDrawer()
    window.setTimeout(() => setAdded(false), 2500)
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

  return (
    <Button
      type="button"
      onClick={handleAdd}
      className={`relative w-full rounded-md py-3.5 text-lg transition-colors ${className} ${
        added ? '!bg-success' : ''
      }`}
      aria-live="polite"
    >
      {added ? (
        <span className="flex items-center justify-center gap-2">
          <Check className="size-5" />
          Adicionado!
        </span>
      ) : (
        'Adicionar ao carrinho'
      )}
    </Button>
  )
}
