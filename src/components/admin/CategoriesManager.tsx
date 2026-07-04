'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { MediaSelectField } from '@/components/admin/MediaSelectField'
import { fetchApi } from '@/lib/api/fetch-api'
import { createCategorySchema, updateCategorySchema } from '@/schemas/category-schema'

type Category = {
  id: string
  name: string
  slug: string
  image_url: string | null
  banner_image_url: string | null
  page_title: string | null
  description: string | null
  sort_order: number
  active: boolean
}

const emptyForm = {
  name: '',
  slug: '',
  image_url: '',
  banner_image_url: '',
  page_title: '',
  description: '',
  sort_order: '0',
  active: true,
}

export function CategoriesManager() {
  const [items, setItems] = useState<Category[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data } = await fetchApi<Category[]>('/api/admin/categories')
    setItems(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function slugify(text: string) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function startEdit(c: Category) {
    setEditingId(c.id)
    setForm({
      name: c.name,
      slug: c.slug,
      image_url: c.image_url ?? '',
      banner_image_url: c.banner_image_url ?? '',
      page_title: c.page_title ?? '',
      description: c.description ?? '',
      sort_order: String(c.sort_order),
      active: c.active,
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

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      image_url: form.image_url.trim() || null,
      banner_image_url: form.banner_image_url.trim() || null,
      page_title: form.page_title.trim() || null,
      description: form.description.trim() || null,
      sort_order: parseInt(form.sort_order, 10),
      active: form.active,
    }

    const parsed = editingId
      ? updateCategorySchema.safeParse(payload)
      : createCategorySchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const url = editingId ? `/api/admin/categories/${editingId}` : '/api/admin/categories'
    const { error: apiError } = await fetchApi(url, {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(parsed.data),
    })
    setLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    cancelForm()
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta coleção?')) return
    await fetchApi(`/api/admin/categories/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary">
        Coleções aparecem em <strong>/colecoes/[slug]</strong>. Configure banner, selo circular
        (home e carrosséis), título e descrição da página.
      </p>

      <div className="flex justify-end">
        {!showForm && (
          <Button type="button" onClick={() => setShowForm(true)}>
            Nova coleção
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {showForm && (
        <Card title={editingId ? 'Editar coleção' : 'Nova coleção'}>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome"
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                  slug: form.slug || slugify(e.target.value),
                })
              }
              required
            />
            <Input
              label="Slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
            />
            <div className="sm:col-span-2">
              <Input
                label="Título da página (H1)"
                value={form.page_title}
                onChange={(e) => setForm({ ...form, page_title: e.target.value })}
                placeholder="Se vazio, usa o nome da coleção"
              />
            </div>
            <div className="sm:col-span-2">
              <Textarea
                label="Descrição da página"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                placeholder="Texto introdutório exibido abaixo do título na página da coleção"
              />
            </div>
            <div className="sm:col-span-2">
              <MediaSelectField
                label="Banner da coleção"
                value={form.banner_image_url || null}
                onChange={(url) => setForm({ ...form, banner_image_url: url ?? '' })}
                hint="Imagem larga no topo da página — exibida em largura total, sem corte (proporção original)"
                bucket="categories"
              />
            </div>
            <div className="sm:col-span-2">
              <MediaSelectField
                label="Selo da coleção"
                value={form.image_url || null}
                onChange={(url) => setForm({ ...form, image_url: url ?? '' })}
                hint="Imagem circular usada na home e carrosséis (recomendado ~200×200px, fundo transparente)"
                bucket="categories"
              />
            </div>
            <Input
              label="Ordem"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Ativa
            </label>
            <div className="flex gap-3 sm:col-span-2">
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

      <ul className="space-y-2">
        {items.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-text-secondary">/colecoes/{c.slug}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => startEdit(c)}>
                Editar
              </Button>
              <Button type="button" variant="danger" onClick={() => handleDelete(c.id)}>
                Remover
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
