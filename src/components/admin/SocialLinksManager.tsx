'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import { createSocialLinkSchema, updateSocialLinkSchema } from '@/schemas/social-link-schema'

type SocialLink = {
  id: string
  type: 'whatsapp' | 'facebook' | 'instagram'
  href: string
  label: string
  display: string | null
  sort_order: number
  active: boolean
}

const emptyForm = {
  type: 'instagram' as 'whatsapp' | 'facebook' | 'instagram',
  href: '',
  label: '',
  display: '',
  sort_order: '0',
  active: true,
}

export function SocialLinksManager() {
  const [items, setItems] = useState<SocialLink[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data } = await fetchApi<SocialLink[]>('/api/admin/social-links')
    setItems(data ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(item: SocialLink) {
    setEditingId(item.id)
    setForm({
      type: item.type,
      href: item.href,
      label: item.label,
      display: item.display ?? '',
      sort_order: String(item.sort_order),
      active: item.active,
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
      type: form.type,
      href: form.href.trim(),
      label: form.label.trim(),
      display: form.display.trim() || null,
      sort_order: parseInt(form.sort_order, 10),
      active: form.active,
    }

    const parsed = editingId ? updateSocialLinkSchema.safeParse(payload) : createSocialLinkSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const url = editingId ? `/api/admin/social-links/${editingId}` : '/api/admin/social-links'
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
    if (!confirm('Remover este link?')) return
    await fetchApi(`/api/admin/social-links/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {!showForm && <Button type="button" onClick={() => setShowForm(true)}>Novo link</Button>}
      </div>
      {error && <Alert type="error">{error}</Alert>}
      {showForm && (
        <Card title={editingId ? 'Editar rede social' : 'Nova rede social'}>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as SocialLink['type'] })}
                className="w-full rounded-md border border-border px-3 py-2.5 text-sm"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
              </select>
            </div>
            <Input label="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
            <Input label="Href" value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} className="sm:col-span-2" required />
            <Input label="Display" value={form.display} onChange={(e) => setForm({ ...form, display: e.target.value })} />
            <Input label="Ordem" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Ativo</label>
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
              <p className="font-medium">{item.label} ({item.type})</p>
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
