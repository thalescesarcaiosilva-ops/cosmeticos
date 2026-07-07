'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import {
  parseProductReviewsCsv,
  type ProductReviewCsvRow,
} from '@/lib/import/product-review-csv'

type ProductOption = {
  id: string
  name: string
}

type ProductSearchResponse = {
  items: ProductOption[]
}

type ProductReviewRow = {
  id: string
  product_id: string
  author_name: string
  author_email: string | null
  rating: number
  title: string | null
  comment: string
  approved: boolean
  imported_from_csv: boolean
  created_at: string
  products?: { name?: string } | null
}

type ProductReviewListResponse = {
  items: ProductReviewRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function ProductReviewsManager() {
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<ProductOption[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)

  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all')
  const [page, setPage] = useState(1)
  const [list, setList] = useState<ProductReviewListResponse | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  const [csvRows, setCsvRows] = useState<ProductReviewCsvRow[]>([])
  const [importError, setImportError] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const [mutatingId, setMutatingId] = useState<string | null>(null)

  const searchProducts = useCallback(async () => {
    if (productQuery.trim().length < 2) {
      setProductResults([])
      return
    }

    const { data, error } = await fetchApi<ProductSearchResponse>(
      `/api/admin/products?q=${encodeURIComponent(productQuery)}&page=1&pageSize=10`
    )
    if (error || !data) {
      setProductResults([])
      return
    }
    setProductResults(data.items ?? [])
  }, [productQuery])

  async function loadReviews(nextPage = page) {
    const query = new URLSearchParams({
      page: String(nextPage),
      pageSize: '15',
      status: statusFilter,
    })
    if (selectedProduct) query.set('product_id', selectedProduct.id)

    const { data, error } = await fetchApi<ProductReviewListResponse>(
      `/api/admin/product-reviews?${query.toString()}`
    )
    if (error || !data) {
      setListError(error ?? 'Não foi possível carregar avaliações')
      return
    }
    setListError(null)
    setList(data)
  }

  useEffect(() => {
    const timeout = window.setTimeout(searchProducts, 250)
    return () => window.clearTimeout(timeout)
  }, [searchProducts])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReviews(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, selectedProduct?.id])

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null)
    setImportMessage(null)
    setCsvRows([])

    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Selecione um arquivo CSV válido.')
      return
    }

    try {
      const text = await file.text()
      const parsed = parseProductReviewsCsv(text)
      if (parsed.length === 0) {
        setImportError('Nenhuma linha válida encontrada no CSV.')
        return
      }
      setCsvRows(parsed)
    } catch {
      setImportError('Não foi possível ler o arquivo CSV.')
    }
  }

  async function runImport() {
    if (!selectedProduct) {
      setImportError('Selecione um produto para importar as avaliações.')
      return
    }
    if (csvRows.length === 0) {
      setImportError('Selecione o CSV antes de importar.')
      return
    }

    setImporting(true)
    setImportError(null)
    setImportMessage(null)
    const { error, message } = await fetchApi<{ imported: number }>(
      '/api/admin/product-reviews/import',
      {
        method: 'POST',
        body: JSON.stringify({
          product_id: selectedProduct.id,
          rows: csvRows,
        }),
      }
    )
    setImporting(false)

    if (error) {
      setImportError(error)
      return
    }

    setImportMessage(message ?? 'Importação concluída.')
    setCsvRows([])
    setPage(1)
    loadReviews(1)
  }

  async function updateApproval(id: string, approved: boolean) {
    setMutatingId(id)
    const { error } = await fetchApi(`/api/admin/product-reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ approved }),
    })
    setMutatingId(null)

    if (error) {
      setListError(error)
      return
    }
    loadReviews(page)
  }

  async function removeReview(id: string) {
    if (!confirm('Remover esta avaliação?')) return
    setMutatingId(id)
    const { error } = await fetchApi(`/api/admin/product-reviews/${id}`, {
      method: 'DELETE',
    })
    setMutatingId(null)
    if (error) {
      setListError(error)
      return
    }
    loadReviews(page)
  }

  const selectedLabel = useMemo(() => {
    if (!selectedProduct) return 'Todos os produtos'
    return selectedProduct.name
  }, [selectedProduct])

  return (
    <div className="space-y-6">
      <Card title="Importar avaliações por CSV">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Busque o produto pelo nome, selecione o item correto e importe o CSV. Avaliações deste
            fluxo são aprovadas automaticamente.
          </p>

          <Input
            label="Buscar produto pelo nome"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Ex.: Poltrona Giratória Montara Casa"
          />

          {productResults.length > 0 && (
            <div className="rounded-md border border-border bg-surface">
              {productResults.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="block w-full border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-surface-muted"
                  onClick={() => {
                    setSelectedProduct(product)
                    setProductQuery(product.name)
                  }}
                >
                  {product.name}
                </button>
              ))}
            </div>
          )}

          {selectedProduct && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
              Produto selecionado: <strong>{selectedProduct.name}</strong>
            </div>
          )}

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportFile}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
          />

          {csvRows.length > 0 && (
            <p className="text-sm text-text-secondary">
              {csvRows.length} avaliações prontas para importação.
            </p>
          )}

          {importError && <Alert type="error">{importError}</Alert>}
          {importMessage && <Alert type="success">{importMessage}</Alert>}

          <Button type="button" onClick={runImport} loading={importing}>
            Importar avaliações
          </Button>
        </div>
      </Card>

      <Card title="Moderação de avaliações">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-text-secondary">
            Produto: <strong>{selectedLabel}</strong>
          </p>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'approved' | 'pending')
              setPage(1)
            }}
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            <option value="approved">Aprovados</option>
            <option value="pending">Pendentes</option>
          </select>
          {selectedProduct && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSelectedProduct(null)
                setProductQuery('')
                setPage(1)
              }}
            >
              Limpar filtro de produto
            </Button>
          )}
        </div>

        {listError && <Alert type="error">{listError}</Alert>}

        <div className="space-y-3">
          {list?.items.map((review) => (
            <article key={review.id} className="rounded-lg border border-border bg-surface p-4">
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-text-primary">{review.author_name}</p>
                  <p className="text-xs text-text-muted">
                    Produto: {review.products?.name ?? 'Produto removido'} ·{' '}
                    {new Date(review.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-surface-muted px-2 py-1 text-xs">
                    {review.approved ? 'Aprovado' : 'Pendente'}
                  </span>
                  {review.imported_from_csv && (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                      CSV
                    </span>
                  )}
                </div>
              </header>

              <p className="mt-2 text-sm text-amber-600">{'★'.repeat(review.rating)}</p>
              {review.title && <p className="mt-1 font-medium text-text-primary">{review.title}</p>}
              <p className="mt-1 text-sm text-text-secondary">{review.comment}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {!review.approved ? (
                  <Button
                    type="button"
                    onClick={() => updateApproval(review.id, true)}
                    disabled={mutatingId === review.id}
                  >
                    Aprovar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => updateApproval(review.id, false)}
                    disabled={mutatingId === review.id}
                  >
                    Desaprovar
                  </Button>
                )}
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => removeReview(review.id)}
                  disabled={mutatingId === review.id}
                >
                  Remover
                </Button>
              </div>
            </article>
          ))}

          {list && list.items.length === 0 && (
            <p className="text-sm text-text-muted">Nenhuma avaliação encontrada.</p>
          )}
        </div>

        {list && list.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              Página {list.page} de {list.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={list.page <= 1}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((p) => Math.min(list.totalPages, p + 1))}
                disabled={list.page >= list.totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
