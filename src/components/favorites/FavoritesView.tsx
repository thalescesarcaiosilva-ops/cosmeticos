'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ProductGrid } from '@/components/product/ProductGrid'
import { fetchApi } from '@/lib/api/fetch-api'
import { buildInstallmentMap } from '@/lib/payment/build-installment-map'
import type { PaymentSettings } from '@/types/payment'
import type { ProductCardData } from '@/types/product'
import { useFavorites } from '@/providers/FavoritesProvider'

type FavoritesViewProps = {
  paymentSettings: PaymentSettings
}

export function FavoritesView({ paymentSettings }: FavoritesViewProps) {
  const { favoriteIds, hydrated, favoriteCount } = useFavorites()
  const [products, setProducts] = useState<ProductCardData[]>([])
  const [loading, setLoading] = useState(true)

  const idsKey = useMemo(() => [...favoriteIds].sort().join(','), [favoriteIds])

  useEffect(() => {
    if (!hydrated) return

    async function load() {
      setLoading(true)
      const ids = idsKey ? idsKey.split(',') : []
      if (ids.length === 0) {
        setProducts([])
        setLoading(false)
        return
      }

      const { data } = await fetchApi<{ products: ProductCardData[] }>('/api/favorites/products', {
        method: 'POST',
        body: JSON.stringify({ productIds: ids }),
      })

      setProducts(data?.products ?? [])
      setLoading(false)
    }

    void load()
  }, [hydrated, idsKey])

  const installments = useMemo(
    () => buildInstallmentMap(products, paymentSettings),
    [products, paymentSettings]
  )

  if (!hydrated || loading) {
    return <p className="text-sm text-text-secondary">Carregando favoritos…</p>
  }

  if (favoriteCount === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-muted px-6 py-12 text-center">
        <p className="text-text-secondary">Você ainda não salvou nenhum produto.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
          Explorar a loja
        </Link>
      </div>
    )
  }

  return (
    <ProductGrid
      products={products}
      installments={installments}
      emptyMessage="Nenhum produto favorito disponível no momento."
    />
  )
}
