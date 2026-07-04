'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import { createMenuItemSchema, updateMenuItemSchema } from '@/schemas/menu-item-schema'

type MenuItem = {
  id: string
  label: string
  slug: string
  href: string
  sort_order: number
  visible: boolean
  has_dropdown: boolean
}

const emptyForm = { label: '', slug: '', href: '', sort_order: '0', visible: true, has_dropdown: false }

export function MenuItemsManager() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data } = await fetchApi<MenuItem[]>('/api/admin/menu-items')
    setItems(data ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(item: MenuItem) {
    setEditingId(item.id)
    setForm({
      label: item.label,
      slug: item.slug,
      href: item.href,
      sort_order: String(item.sort_order),
      visible: item.visible,
      has_dropdown: item.has_dropdown,
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
      label: form.label.trim(),
      slug: form.slug.trim(),
      href: form.href.trim(),
      sort_order: parseInt(form.sort_order, 10),
      visible: form.visible,
      has_dropdown: form.has_dropdown,
    }

    const parsed = editingId ? updateMenuItemSchema.safeParse(payload) : createMenuItemSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const url = editingId ? `/api/admin/menu-items/${editingId}` : '/api/admin/menu-items'
    const { error: apiError } = await fetchApi(url, {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(parsed.data),
    })
    setLoading(false)

    if (apiError) { setError(apiError); return }
    cancelForm()
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este item?')) return
    await fetchApi(`/api/admin/menu-items/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {!showForm && <Button type="button" onClick={() => setShowForm(true)}>Novo item</Button>}
      </div>
      {error && <Alert type="error">{error}</Alert>}
      {showForm && (
        <Card title={editingId ? 'Editar item' : 'Novo item'}>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Input label="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
            <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
            <Input label="Href" value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} className="sm:col-span-2" required />
            <Input label="Ordem" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} />Visível</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.has_dropdown} onChange={(e) => setForm({ ...form, has_dropdown: e.target.checked })} />Dropdown</label>
            <div className="flex gap-3 sm:col-span-2">
              <Button type="submit" loading={loading}>Salvar</Button>
              <Button type="button" variant="secondary" onClick={cancelForm}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-text-secondary">{item.href}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => startEdit(item)}>Editar</Button>
              <Button type="button" variant="danger" onClick={() => handleDelete(item.id)}>Remover</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
