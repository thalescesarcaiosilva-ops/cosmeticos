'use client'

import { useRef, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { fetchApi } from '@/lib/api/fetch-api'
import {
  parseWooCommerceCsv,
  summarizeWooCommerceImport,
  type WooCommerceProductRow,
} from '@/lib/import/woocommerce-csv'
import type { ImportBatchResult } from '@/lib/import/run-woocommerce-import'

const BATCH_SIZE = 3

type ProductCsvImportProps = {
  onComplete: () => void
}

export function ProductCsvImport({ onComplete }: ProductCsvImportProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<WooCommerceProductRow[] | null>(null)
  const [summary, setSummary] = useState<ReturnType<typeof summarizeWooCommerceImport> | null>(
    null
  )
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [updateImages, setUpdateImages] = useState(true)
  const [result, setResult] = useState<ImportBatchResult | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    setResult(null)
    setRows(null)
    setSummary(null)
    setProgress(0)

    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Selecione um arquivo .csv exportado do WooCommerce')
      return
    }

    try {
      const text = await file.text()
      const parsed = parseWooCommerceCsv(text)
      if (parsed.length === 0) {
        setError(
          'Nenhum produto publicado encontrado no CSV. Verifique se o status é publish/publicado e se há preço válido.'
        )
        return
      }
      setRows(parsed)
      setSummary(summarizeWooCommerceImport(parsed))
    } catch {
      setError('Não foi possível ler o arquivo CSV')
    }
  }

  async function runImport() {
    if (!rows?.length) return
    setImporting(true)
    setError(null)
    setResult(null)

    const aggregate: ImportBatchResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      categoriesCreated: 0,
      brandsCreated: 0,
      imagesImported: 0,
      items: [],
      errors: [],
    }

    try {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        const { data, error: apiError } = await fetchApi<ImportBatchResult>(
          '/api/admin/products/import',
          {
            method: 'POST',
            body: JSON.stringify({ rows: batch, updateImages }),
          }
        )

        if (apiError || !data) {
          setError(apiError ?? 'Erro na importação')
          break
        }

        aggregate.created += data.created
        aggregate.updated += data.updated
        aggregate.skipped += data.skipped
        aggregate.categoriesCreated += data.categoriesCreated
        aggregate.brandsCreated += data.brandsCreated
        aggregate.imagesImported += data.imagesImported
        aggregate.items.push(...data.items)
        aggregate.errors.push(...data.errors)

        setProgress(Math.min(100, Math.round(((i + batch.length) / rows.length) * 100)))
      }

      setResult(aggregate)
      onComplete()
    } catch {
      setError('Importação interrompida. Verifique sua conexão e tente novamente.')
    }

    setImporting(false)
  }

  function reset() {
    setRows(null)
    setSummary(null)
    setResult(null)
    setProgress(0)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Card title="Importar produtos (WooCommerce CSV)">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Exporte produtos no WooCommerce (Products → Export). Aceita produtos simples e
          variáveis (preço e estoque das variações são agregados). O importador cria categorias e
          marcas ausentes, baixa imagens para o Supabase Storage (WebP otimizado) e atualiza
          produtos existentes pelo ID WooCommerce ou slug.
        </p>

        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Antes de importar, execute{' '}
          <code className="rounded bg-white/80 px-1">PARTE_12_woocommerce_import.sql</code> e{' '}
          <code className="rounded bg-white/80 px-1">PARTE_9_products_media.sql</code> no Supabase
          (se ainda não rodou).
        </div>

        {error && <Alert type="error">{error}</Alert>}

        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            disabled={importing}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
          />
        </div>

        {summary && !result && (
          <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm">
            <p className="font-medium text-text-primary">{summary.total} produtos prontos</p>
            <ul className="mt-2 space-y-1 text-text-secondary">
              <li>
                {summary.simple} simples · {summary.variable} variáveis
              </li>
              <li>{summary.categories} categorias (criadas automaticamente se faltarem)</li>
              <li>{summary.brands} marcas distintas</li>
              <li>{summary.withImages} produtos com imagens para baixar</li>
            </ul>
            <label className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={updateImages}
                onChange={(e) => setUpdateImages(e.target.checked)}
                disabled={importing}
              />
              Baixar/atualizar imagens (desmarque para só atualizar dados)
            </label>
            <div className="mt-4 flex gap-3">
              <Button type="button" onClick={runImport} loading={importing}>
                {importing ? `Importando… ${progress}%` : 'Iniciar importação'}
              </Button>
              <Button type="button" variant="secondary" onClick={reset} disabled={importing}>
                Limpar
              </Button>
            </div>
            {importing && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-brand transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            <p className="font-semibold">Importação concluída</p>
            <ul className="mt-2 space-y-1">
              <li>{result.created} criados</li>
              <li>{result.updated} atualizados</li>
              <li>{result.skipped} ignorados/com erro</li>
              <li>{result.categoriesCreated} categorias novas</li>
              <li>{result.brandsCreated} marcas novas</li>
              <li>{result.imagesImported} imagens importadas</li>
            </ul>
            {result.errors.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer font-medium">
                  {result.errors.length} erros
                </summary>
                <ul className="mt-2 max-h-40 overflow-y-auto text-xs">
                  {result.errors.map((err) => (
                    <li key={`${err.slug}-${err.message}`}>
                      {err.slug}: {err.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <Button type="button" variant="secondary" className="mt-4" onClick={reset}>
              Importar outro arquivo
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
