'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { MediaSelectField } from '@/components/admin/MediaSelectField'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import { createFooterAssetSchema } from '@/schemas/footer-asset-schema'

type FooterAsset = {
  id: string
  asset_type: 'payment' | 'security'
  image_url: string
  alt_text: string | null
  href: string | null
  sort_order: number
  active: boolean
}

type FooterAssetsManagerProps = {
  assetType: 'payment' | 'security'
  title: string
}

const emptyForm = {
  image_url: null as string | null,
  alt_text: '',
  href: '',
  sort_order: 0,
}

export function FooterAssetsManager({ assetType, title }: FooterAssetsManagerProps) {
  const [items, setItems] = useState<FooterAsset[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data } = await fetchApi<FooterAsset[]>(`/api/admin/footer-assets?type=${assetType}`)
    setItems(data ?? [])
  }, [assetType])

  useEffect(() => {
    load()
  }, [load])

  function startEdit(item: FooterAsset) {
    setEditingId(item.id)
    setForm({
      image_url: item.image_url,
      alt_text: item.alt_text ?? '',
      href: item.href ?? '',
      sort_order: item.sort_order,
    })
    setShowForm(true)
  }

  function cancelForm() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(false)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.image_url) {
      setError('Selecione uma imagem')
      return
    }

    const payload = {
      asset_type: assetType,
      image_url: form.image_url,
      alt_text: form.alt_text.trim() || null,
      href: form.href.trim() || null,
      sort_order: form.sort_order,
    }

    if (editingId) {
      const { error: apiError } = await fetchApi(`/api/admin/footer-assets/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          image_url: payload.image_url,
          alt_text: payload.alt_text,
          href: payload.href,
          sort_order: payload.sort_order,
        }),
      })
      if (apiError) {
        setError(apiError)
        return
      }
    } else {
      const parsed = createFooterAssetSchema.safeParse(payload)
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
        return
      }
      setLoading(true)
      const { error: apiError } = await fetchApi('/api/admin/footer-assets', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      })
      setLoading(false)
      if (apiError) {
        setError(apiError)
        return
      }
    }

    cancelForm()
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este ícone?')) return
    await fetchApi(`/api/admin/footer-assets/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!showForm && (
          <Button type="button" onClick={() => setShowForm(true)}>
            Adicionar {title.toLowerCase()}
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {showForm && (
        <Card title={editingId ? `Editar ${title.toLowerCase()}` : `Novo ${title.toLowerCase()}`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <MediaSelectField
              label="Imagem"
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Texto alternativo"
                value={form.alt_text}
                onChange={(e) => setForm({ ...form, alt_text: e.target.value })}
              />
              <Input
                label="Ordem"
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) =>
                  setForm({ ...form, sort_order: parseInt(e.target.value, 10) || 0 })
                }
              />
              <Input
                label="Link (opcional)"
                value={form.href}
                onChange={(e) => setForm({ ...form, href: e.target.value })}
                className="sm:col-span-2"
                placeholder="https://..."
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" loading={loading}>
                Salvar
              </Button>
              <Button type="button" variant="secondary" onClick={cancelForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">Nenhum ícone cadastrado.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-16 shrink-0">
                  <Image
                    src={item.image_url}
                    alt={item.alt_text ?? ''}
                    fill
                    sizes="64px"
                    className="object-contain"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.alt_text || 'Sem descrição'}</p>
                  <p className="text-xs text-text-secondary">Ordem: {item.sort_order}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => startEdit(item)}>
                  Editar
                </Button>
                <Button type="button" variant="danger" onClick={() => handleDelete(item.id)}>
                  Remover
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
