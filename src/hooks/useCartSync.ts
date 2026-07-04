'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCart } from '@/providers/CartProvider'
import type { CartSyncResult } from '@/types/cart'

export function useCartSync() {
  const { items, hydrated, syncValidatedItems } = useCart()
  const [data, setData] = useState<CartSyncResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const sync = useCallback(async () => {
    if (!hydrated) return

    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
          })),
        }),
      })

      const json = await res.json()

      if (currentRequest !== requestId.current) return

      if (json.error || !json.data) {
        setError(json.message ?? 'Não foi possível carregar o carrinho')
        setData(null)
        return
      }

      const result = json.data as CartSyncResult
      setData(result)

      const validatedItems = result.lines
        .filter((line) => line.available)
        .map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        }))

      const storedKey = items
        .map((i) => `${i.productId}:${i.quantity}`)
        .sort()
        .join('|')
      const validatedKey = validatedItems
        .map((i) => `${i.productId}:${i.quantity}`)
        .sort()
        .join('|')

      if (storedKey !== validatedKey) {
        syncValidatedItems(validatedItems)
      }
    } catch {
      if (currentRequest === requestId.current) {
        setError('Não foi possível carregar o carrinho')
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false)
      }
    }
  }, [hydrated, items, syncValidatedItems])

  useEffect(() => {
    if (!hydrated) return
    sync()
  }, [hydrated, items, sync])

  return { data, loading: !hydrated || loading, error, refresh: sync }
}
