'use client'

import Image from 'next/image'
import { useState } from 'react'
import { MediaLibrary } from '@/components/admin/MediaLibrary'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DEFAULT_SITE_MEDIA_BUCKET, type MediaBucket } from '@/lib/media/buckets'
import type { MediaAsset } from '@/types/product'

type MediaSelectFieldProps = {
  label: string
  value: string | null
  onChange: (url: string | null) => void
  hint?: string
  bucket?: MediaBucket
}

export function MediaSelectField({
  label,
  value,
  onChange,
  hint,
  bucket = DEFAULT_SITE_MEDIA_BUCKET,
}: MediaSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [selectedMediaId, setSelectedMediaId] = useState<string[]>([])
  const [pickedAsset, setPickedAsset] = useState<MediaAsset | null>(null)

  function applySelection() {
    if (!pickedAsset?.public_url) return
    onChange(pickedAsset.public_url)
    setOpen(false)
    setSelectedMediaId([])
    setPickedAsset(null)
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      {value ? (
        <div className="flex items-center gap-4 rounded-lg border border-border bg-surface-muted p-3">
          <div className="relative h-14 w-28 shrink-0">
            <Image src={value} alt="" fill sizes="112px" className="object-contain" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
              Trocar imagem
            </Button>
            <Button type="button" variant="ghost" onClick={() => onChange(null)}>
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Selecionar da biblioteca
        </Button>
      )}
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
      {open && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Biblioteca de mídia</p>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
          <MediaLibrary
            selectable
            compact
            bucket={bucket}
            selectedIds={selectedMediaId}
            onSelect={(ids) => setSelectedMediaId(ids.slice(-1))}
            onPickAsset={setPickedAsset}
          />
          <div className="mt-3">
            <Button
              type="button"
              disabled={!pickedAsset?.public_url}
              onClick={applySelection}
            >
              Usar imagem selecionada
            </Button>
          </div>
        </div>
      )}
      <Input
        label="Ou cole a URL da imagem"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder="https://..."
      />
    </div>
  )
}
