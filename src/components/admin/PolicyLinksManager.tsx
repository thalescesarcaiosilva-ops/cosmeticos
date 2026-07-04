'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import { createPolicyLinkSchema, updatePolicyLinkSchema } from '@/schemas/policy-link-schema'

type PolicyLink = { id: string; label: string; href: string; sort_order: number; active: boolean }

const emptyForm = { label: '', href: '', sort_order: '0', active: true }

export function PolicyLinksManager() {
  const [items, setItems] = useState<PolicyLink[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data } = await fetchApi<PolicyLink[]>('/api/admin/policy-links')
    setItems(data ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(item: PolicyLink) {
    setEditingId(item.id)
    setForm({ label: item.label, href: item.href, sort_order: String(item.sort_order), active: item.active })
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
      href: form.href.trim(),
      sort_order: parseInt(form.sort_order, 10),
      active: form.active,
    }

    const parsed = editingId ? updatePolicyLinkSchema.safeParse(payload) : createPolicyLinkSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const url = editingId ? `/api/admin/policy-links/${editingId}` : '/api/admin/policy-links'
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
    await fetchApi(`/api/admin/policy-links/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {!showForm && <Button type="button" onClick={() => setShowForm(true)}>Novo link</Button>}
      </div>
      {error && <Alert type="error">{error}</Alert>}
      {showForm && (
        <Card title={editingId ? 'Editar link' : 'Novo link'}>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Input label="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
            <Input label="Href" value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} required />
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
