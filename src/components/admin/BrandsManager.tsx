'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import { slugify } from '@/lib/products/format'
import type { Brand } from '@/types/product'

const emptyForm = { name: '', slug: '', active: true }

export function BrandsManager() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data } = await fetchApi<Brand[]>('/api/admin/brands')
    setBrands(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      active: form.active,
    }

    const url = editingId ? `/api/admin/brands/${editingId}` : '/api/admin/brands'
    const { error: apiError } = await fetchApi(url, {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    })

    setLoading(false)
    if (apiError) {
      setError(apiError)
      return
    }

    setForm(emptyForm)
    setEditingId(null)
    load()
  }

  function startEdit(brand: Brand) {
    setEditingId(brand.id)
    setForm({ name: brand.name, slug: brand.slug, active: brand.active })
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta marca?')) return
    await fetchApi(`/api/admin/brands/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-6">
      {error && <Alert type="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
        <Input
          label="Nome da marca"
          value={form.name}
          onChange={(e) =>
            setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })
          }
          required
        />
        <Input
          label="Slug"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          required
        />
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Ativa
          </label>
          <Button type="submit" loading={loading}>
            {editingId ? 'Salvar' : 'Adicionar'}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditingId(null)
                setForm(emptyForm)
              }}
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id} className="border-t border-border">
                <td className="px-4 py-3">{b.name}</td>
                <td className="px-4 py-3">{b.slug}</td>
                <td className="px-4 py-3">{b.active ? 'Ativa' : 'Inativa'}</td>
                <td className="px-4 py-3 text-right">
                  <Button type="button" variant="ghost" onClick={() => startEdit(b)}>
                    Editar
                  </Button>
                  <Button type="button" variant="danger" onClick={() => handleDelete(b.id)}>
                    Remover
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
