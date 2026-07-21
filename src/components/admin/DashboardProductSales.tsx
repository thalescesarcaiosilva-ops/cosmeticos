'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/products/format'
import type { ProductSalesRow } from '@/lib/admin/dashboard-analytics'

type Props = {
  topProducts: ProductSalesRow[]
  productSales: ProductSalesRow[]
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function DashboardProductSales({ topProducts, productSales }: Props) {
  const [query, setQuery] = useState('')

  const searchResults = useMemo(() => {
    const q = normalize(query)
    if (!q) return null

    const exact = productSales.filter((row) => normalize(row.name) === q)
    if (exact.length) return exact

    return productSales
      .filter((row) => normalize(row.name).includes(q) || normalize(row.slug).includes(q))
      .slice(0, 12)
  }, [productSales, query])

  const showingSearch = searchResults !== null
  const rows = showingSearch ? searchResults : topProducts

  return (
    <Card title="Produtos mais vendidos">
      <div className="mb-4 space-y-2">
        <Input
          label="Buscar produto exato"
          placeholder="Digite o nome do produto…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <p className="text-xs text-text-muted">
          {showingSearch
            ? 'Resultado da busca entre produtos já vendidos (pedidos confirmados/pagos).'
            : 'Top 10 por unidades vendidas em pedidos confirmados com pagamento pago.'}
        </p>
      </div>

      {!rows.length ? (
        <p className="text-sm text-text-secondary">
          {showingSearch
            ? 'Nenhum produto encontrado com esse nome nas vendas.'
            : 'Ainda não há vendas de produtos para analisar.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
                <th className="pb-2 pr-3 font-medium">#</th>
                <th className="pb-2 pr-3 font-medium">Produto</th>
                <th className="pb-2 pr-3 font-medium tabular-nums">Unidades</th>
                <th className="pb-2 pr-3 font-medium tabular-nums">Pedidos</th>
                <th className="pb-2 font-medium tabular-nums">Receita</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, index) => (
                <tr key={row.productId}>
                  <td className="py-2.5 pr-3 text-text-muted tabular-nums">{index + 1}</td>
                  <td className="py-2.5 pr-3">
                    {row.slug ? (
                      <Link
                        href={`/admin/produtos`}
                        className="font-medium text-text-primary hover:text-brand"
                        title={row.name}
                      >
                        {row.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-text-primary">{row.name}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums font-semibold text-[#3d1654]">
                    {row.unitsSold}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-text-secondary">
                    {row.orderCount}
                  </td>
                  <td className="py-2.5 tabular-nums font-medium">
                    {formatCurrency(row.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!showingSearch && productSales.length > 10 && (
        <p className="mt-3 text-xs text-text-muted">
          Mostrando top 10 de {productSales.length} produtos com vendas. Use a busca para
          localizar um produto específico.
        </p>
      )}
    </Card>
  )
}
