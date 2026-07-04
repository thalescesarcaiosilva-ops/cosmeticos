'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { fetchApi } from '@/lib/api/fetch-api'
import { createFooterPageSchema, updateFooterPageSchema } from '@/schemas/footer-page-schema'

type SitePage = {
  id: string
  slug: string
  title: string
  content: string | null
  meta_description: string | null
  active: boolean
  created_at?: string
  updated_at?: string
}

const emptyForm = {
  slug: '',
  title: '',
  content: '',
  meta_description: '',
  active: true,
}

export function SitePagesManager() {
  const [items, setItems] = useState<SitePage[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data } = await fetchApi<SitePage[]>('/api/admin/footer-pages')
    setItems(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function startEdit(page: SitePage) {
    setEditingId(page.id)
    setForm({
      slug: page.slug,
      title: page.title,
      content: page.content ?? '',
      meta_description: page.meta_description ?? '',
      active: page.active,
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
      slug: form.slug.trim(),
      title: form.title.trim(),
      content: form.content.trim() || null,
      meta_description: form.meta_description.trim() || null,
      active: form.active,
    }

    const parsed = editingId
      ? updateFooterPageSchema.safeParse(payload)
      : createFooterPageSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const url = editingId ? `/api/admin/footer-pages/${editingId}` : '/api/admin/footer-pages'
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
    if (!confirm('Remover esta página?')) return
    await fetchApi(`/api/admin/footer-pages/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary">
        Páginas de conteúdo publicadas em <code className="text-xs">/paginas/[slug]</code>. Para
        exibir links no rodapé, configure os menus em{' '}
        <strong className="font-medium text-text-primary">Rodapé → Menus</strong>.
      </p>

      <div className="flex justify-end">
        {!showForm && (
          <Button type="button" onClick={() => setShowForm(true)}>
            Nova página
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {showForm && (
        <Card title={editingId ? 'Editar página' : 'Nova página'}>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
              placeholder="politica-de-privacidade"
            />
            <Input
              label="Título"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <Input
              label="Meta description (SEO)"
              value={form.meta_description}
              onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
              className="sm:col-span-2"
            />
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Página ativa (pública)
            </label>
            <Textarea
              label="Conteúdo (HTML permitido)"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="sm:col-span-2"
              rows={12}
            />
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
        {items.map((page) => (
          <li
            key={page.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div>
              <p className="font-medium">{page.title}</p>
              <p className="text-xs text-text-secondary">
                /paginas/{page.slug}
                {!page.active && ' · inativa'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => startEdit(page)}>
                Editar
              </Button>
              <Button type="button" variant="danger" onClick={() => handleDelete(page.id)}>
                Remover
              </Button>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <Card>
            <p className="text-sm text-text-secondary">Nenhuma página cadastrada.</p>
          </Card>
        )}
      </ul>
    </div>
  )
}
