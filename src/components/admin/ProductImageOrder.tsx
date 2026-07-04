'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { fetchApi } from '@/lib/api/fetch-api'
import { DEFAULT_PRODUCT_MEDIA_BUCKET } from '@/lib/media/buckets'
import type { MediaAsset } from '@/types/product'

type ProductImageOrderProps = {
  mediaIds: string[]
  onChange: (ids: string[]) => void
}

export function ProductImageOrder({ mediaIds, onChange }: ProductImageOrderProps) {
  const [assetsById, setAssetsById] = useState<Map<string, MediaAsset>>(new Map())

  const loadAssets = useCallback(async () => {
    const { data } = await fetchApi<MediaAsset[]>(
      `/api/admin/media?bucket=${DEFAULT_PRODUCT_MEDIA_BUCKET}&limit=200&page=1`
    )
    if (!data) return
    setAssetsById(new Map(data.map((a) => [a.id, a])))
  }, [])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  if (mediaIds.length === 0) return null

  function move(index: number, direction: -1 | 1) {
    const next = [...mediaIds]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function remove(id: string) {
    onChange(mediaIds.filter((mid) => mid !== id))
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-sm font-medium text-text-primary">Ordem das imagens</p>
      <p className="text-xs text-text-muted">
        A primeira imagem é a capa do card e a principal na página do produto.
      </p>
      <ul className="space-y-2">
        {mediaIds.map((id, index) => {
          const asset = assetsById.get(id)
          return (
            <li
              key={id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface-muted p-2"
            >
              <span className="w-6 shrink-0 text-center text-xs font-bold text-text-muted">
                {index + 1}
              </span>
              <div className="relative size-14 shrink-0 overflow-hidden rounded border border-border bg-surface">
                {asset?.public_url ? (
                  <Image
                    src={asset.public_url}
                    alt={asset.alt_text ?? asset.filename}
                    fill
                    sizes="56px"
                    className="object-contain p-1"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-text-muted">
                    …
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-primary">
                  {asset?.filename ?? 'Imagem selecionada'}
                </p>
                {index === 0 && (
                  <span className="text-xs font-medium text-brand">Capa</span>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="!px-3 !py-1.5 text-xs"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => move(index, 1)}
                  disabled={index === mediaIds.length - 1}
                  className="!px-3 !py-1.5 text-xs"
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => remove(id)}
                  className="!px-3 !py-1.5 text-xs"
                >
                  ×
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
