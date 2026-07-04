'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  DEFAULT_PRODUCT_MEDIA_BUCKET,
  MEDIA_BUCKET_LABELS,
  MEDIA_BUCKETS,
  MEDIA_PAGE_SIZE,
  type MediaBucket,
} from '@/lib/media/buckets'
import type { MediaAsset } from '@/types/product'

type MediaLibraryMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

type MediaLibraryProps = {
  selectedIds?: string[]
  onSelect?: (ids: string[]) => void
  onPickAsset?: (asset: MediaAsset) => void
  selectable?: boolean
  bucket?: MediaBucket
  showBucketFilter?: boolean
  compact?: boolean
}

export function MediaLibrary({
  selectedIds = [],
  onSelect,
  onPickAsset,
  selectable = false,
  bucket = DEFAULT_PRODUCT_MEDIA_BUCKET,
  showBucketFilter = false,
  compact = false,
}: MediaLibraryProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [meta, setMeta] = useState<MediaLibraryMeta>({
    page: 1,
    limit: MEDIA_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  })
  const [activeBucket, setActiveBucket] = useState<MediaBucket | 'all'>(bucket)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [altText, setAltText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadBucket = activeBucket === 'all' ? bucket : activeBucket

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      page: String(page),
      limit: String(MEDIA_PAGE_SIZE),
    })
    if (showBucketFilter) {
      params.set('bucket', activeBucket)
    } else {
      params.set('bucket', bucket)
    }

    try {
      const res = await fetch(`/api/admin/media?${params.toString()}`)
      const json = await res.json()
      if (json.error) {
        setError(json.message ?? 'Não foi possível carregar a biblioteca')
        setAssets([])
        return
      }
      setAssets(json.data ?? [])
      setMeta(json.meta ?? { page: 1, limit: MEDIA_PAGE_SIZE, total: 0, totalPages: 1 })
    } catch {
      setError('Não foi possível carregar a biblioteca')
      setAssets([])
    } finally {
      setLoading(false)
    }
  }, [activeBucket, bucket, page, showBucketFilter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [activeBucket, bucket])

  async function handleUpload(file: File) {
    setError(null)
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', uploadBucket)
    if (altText.trim()) formData.append('alt_text', altText.trim())

    try {
      const res = await fetch('/api/admin/media', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.error) {
        setError(json.message ?? 'Falha no upload')
      } else {
        setAltText('')
        setPage(1)
        await load()
      }
    } catch {
      setError('Falha no upload')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta imagem da biblioteca?')) return
    await fetch(`/api/admin/media/${id}`, { method: 'DELETE' })
    await load()
    if (selectable && onSelect) {
      onSelect(selectedIds.filter((sid) => sid !== id))
    }
  }

  function toggleSelect(asset: MediaAsset) {
    if (!selectable || !onSelect) return
    if (selectedIds.includes(asset.id)) {
      onSelect(selectedIds.filter((sid) => sid !== asset.id))
    } else {
      onSelect([...selectedIds, asset.id])
      onPickAsset?.(asset)
    }
  }

  const gridClass = compact
    ? 'grid grid-cols-2 gap-2 sm:grid-cols-3'
    : 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'

  return (
    <div className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}

      {showBucketFilter && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveBucket('all')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              activeBucket === 'all'
                ? 'bg-brand text-white'
                : 'bg-surface-muted text-text-secondary hover:text-text-primary'
            }`}
          >
            Todas
          </button>
          {MEDIA_BUCKETS.map((bucketId) => (
            <button
              key={bucketId}
              type="button"
              onClick={() => setActiveBucket(bucketId)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                activeBucket === bucketId
                  ? 'bg-brand text-white'
                  : 'bg-surface-muted text-text-secondary hover:text-text-primary'
              }`}
            >
              {MEDIA_BUCKET_LABELS[bucketId]}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted p-4 sm:flex-row sm:items-end">
        <Input
          label="Texto alternativo (opcional)"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          placeholder="Descrição da imagem para acessibilidade"
          className="flex-1"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleUpload(file)
            e.target.value = ''
          }}
        />
        <Button type="button" loading={uploading} onClick={() => inputRef.current?.click()}>
          Enviar para {MEDIA_BUCKET_LABELS[uploadBucket]}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Carregando imagens…</p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-text-secondary">Nenhuma imagem nesta pasta. Envie a primeira acima.</p>
      ) : (
        <div className={compact ? 'max-h-[360px] overflow-y-auto pr-1' : undefined}>
          <div className={gridClass}>
            {assets.map((asset) => {
              const selected = selectedIds.includes(asset.id)
              return (
                <div
                  key={asset.id}
                  className={`relative overflow-hidden rounded-lg border bg-surface ${
                    selected ? 'border-brand ring-2 ring-brand/30' : 'border-border'
                  }`}
                >
                  <button
                    type="button"
                    className="relative block aspect-square w-full"
                    onClick={() => toggleSelect(asset)}
                    disabled={!selectable}
                  >
                    <Image
                      src={asset.public_url}
                      alt={asset.alt_text ?? asset.filename}
                      fill
                      sizes="160px"
                      className="object-contain p-2"
                    />
                  </button>
                  <div className="space-y-1 border-t border-border p-2">
                    <p className="truncate text-xs text-text-secondary" title={asset.filename}>
                      {asset.filename}
                    </p>
                    {!selectable && (
                      <Button type="button" variant="danger" onClick={() => handleDelete(asset.id)}>
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-xs text-text-muted">
            Página {meta.page} de {meta.totalPages} · {meta.total} imagem(ns)
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={page >= meta.totalPages || loading}
              onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
