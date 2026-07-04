'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { fetchApi } from '@/lib/api/fetch-api'
import {
  createShippingMethodSchema,
  updateShippingMethodSchema,
} from '@/schemas/shipping-schema'
import type { CepRule } from '@/types/shipping'

type ShippingMethodRow = {
  id: string
  name: string
  description: string | null
  base_price: number
  free_above: number | null
  estimated_days_min: number | null
  estimated_days_max: number | null
  cep_rules: CepRule[]
  sort_order: number
  active: boolean
}

const emptyForm = {
  name: '',
  description: '',
  base_price: 0,
  free_above: '',
  estimated_days_min: '',
  estimated_days_max: '',
  cep_rules_json: '[]',
  sort_order: 0,
  active: true,
}

export function ShippingMethodsManager() {
  const [items, setItems] = useState<ShippingMethodRow[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data } = await fetchApi<ShippingMethodRow[]>('/api/admin/shipping-methods')
    setItems(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function startEdit(item: ShippingMethodRow) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      description: item.description ?? '',
      base_price: Number(item.base_price),
      free_above: item.free_above != null ? String(item.free_above) : '',
      estimated_days_min: item.estimated_days_min != null ? String(item.estimated_days_min) : '',
      estimated_days_max: item.estimated_days_max != null ? String(item.estimated_days_max) : '',
      cep_rules_json: JSON.stringify(item.cep_rules ?? [], null, 2),
      sort_order: item.sort_order,
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

  function parseCepRules(json: string): CepRule[] {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed)) throw new Error('Regras de CEP devem ser um array JSON')
    return parsed as CepRule[]
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    let cep_rules: CepRule[] = []
    try {
      cep_rules = parseCepRules(form.cep_rules_json)
    } catch {
      setError('JSON de regras por CEP inválido')
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      base_price: Number(form.base_price),
      free_above: form.free_above ? Number(form.free_above) : null,
      estimated_days_min: form.estimated_days_min ? parseInt(form.estimated_days_min, 10) : null,
      estimated_days_max: form.estimated_days_max ? parseInt(form.estimated_days_max, 10) : null,
      cep_rules,
      sort_order: form.sort_order,
      active: form.active,
    }

    const parsed = editingId
      ? updateShippingMethodSchema.safeParse(payload)
      : createShippingMethodSchema.safeParse(payload)

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const url = editingId
      ? `/api/admin/shipping-methods/${editingId}`
      : '/api/admin/shipping-methods'
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
    if (!confirm('Remover esta forma de frete?')) return
    await fetchApi(`/api/admin/shipping-methods/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary">
        Configure PAC, Sedex, retirada e regras por faixa de CEP. O frete grátis usa o campo{' '}
        <strong>Grátis acima de</strong> quando o subtotal atinge o valor.
      </p>

      <div className="flex justify-end">
        {!showForm && (
          <Button type="button" onClick={() => setShowForm(true)}>
            Nova forma de frete
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {showForm && (
        <Card title={editingId ? 'Editar frete' : 'Nova forma de frete'}>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
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
            <div className="sm:col-span-2">
              <Textarea
                label="Descrição"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <Input
              label="Preço base (R$)"
              type="number"
              step="0.01"
              min={0}
              value={form.base_price}
              onChange={(e) =>
                setForm({ ...form, base_price: parseFloat(e.target.value) || 0 })
              }
            />
            <Input
              label="Grátis acima de (R$) — opcional"
              type="number"
              step="0.01"
              min={0}
              value={form.free_above}
              onChange={(e) => setForm({ ...form, free_above: e.target.value })}
            />
            <Input
              label="Prazo mínimo (dias úteis)"
              type="number"
              min={0}
              value={form.estimated_days_min}
              onChange={(e) => setForm({ ...form, estimated_days_min: e.target.value })}
            />
            <Input
              label="Prazo máximo (dias úteis)"
              type="number"
              min={0}
              value={form.estimated_days_max}
              onChange={(e) => setForm({ ...form, estimated_days_max: e.target.value })}
            />
            <div className="sm:col-span-2">
              <Textarea
                label="Regras por prefixo de CEP (JSON)"
                value={form.cep_rules_json}
                onChange={(e) => setForm({ ...form, cep_rules_json: e.target.value })}
                rows={5}
                placeholder='[{"prefixes":["01","02"],"price":15.90}]'
              />
              <p className="mt-1 text-xs text-text-muted">
                Opcional. Use prefixos numéricos do CEP (ex.: &quot;01&quot; para SP capital).
              </p>
            </div>
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
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-text-secondary">
                R$ {Number(item.base_price).toFixed(2)}
                {item.free_above != null && ` · grátis acima de R$ ${Number(item.free_above).toFixed(2)}`}
                {' · ordem '}
                {item.sort_order}
                {!item.active && ' · inativa'}
              </p>
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
    </div>
  )
}
