'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import { formatCurrency } from '@/lib/products/format'

type CouponRow = {
  id: string
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  active: boolean
}

const emptyForm = {
  code: '',
  discount_type: 'percent' as 'percent' | 'fixed',
  discount_value: '',
  active: true,
}

export function CouponsManager() {
  const [items, setItems] = useState<CouponRow[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data, error: apiError } = await fetchApi<CouponRow[]>('/api/admin/coupons')
    if (apiError) {
      setError(apiError)
      return
    }
    setItems(data ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
    setError(null)
    setMessage(null)
  }

  function startEdit(item: CouponRow) {
    setEditingId(item.id)
    setForm({
      code: item.code,
      discount_type: item.discount_type,
      discount_value: String(item.discount_value),
      active: item.active,
    })
    setShowForm(true)
    setError(null)
  }

  async function save() {
    setLoading(true)
    setError(null)
    setMessage(null)
    const payload = {
      code: form.code,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value.replace(',', '.')),
      active: form.active,
    }
    const { data, error: apiError, message: ok } = editingId
      ? await fetchApi<CouponRow>(`/api/admin/coupons/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      : await fetchApi<CouponRow>('/api/admin/coupons', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
    setLoading(false)
    if (apiError || !data) {
      setError(apiError ?? 'Não foi possível salvar o cupom')
      return
    }
    setMessage(ok ?? 'Cupom salvo')
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    await load()
  }

  async function remove(id: string) {
    if (!window.confirm('Excluir este cupom?')) return
    setError(null)
    const { error: apiError } = await fetchApi(`/api/admin/coupons/${id}`, { method: 'DELETE' })
    if (apiError) {
      setError(apiError)
      return
    }
    await load()
  }

  async function toggle(item: CouponRow) {
    setError(null)
    const { error: apiError } = await fetchApi(`/api/admin/coupons/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !item.active }),
    })
    if (apiError) {
      setError(apiError)
      return
    }
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-neutral-600">
          O cliente não vê a lista de cupons. Só consegue usar o código se ele estiver ativo, no
          carrinho ou no checkout.
        </p>
        <Button type="button" onClick={startCreate}>
          Novo cupom
        </Button>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}

      {showForm && (
        <Card title={editingId ? 'Editar cupom' : 'Novo cupom'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome do cupom"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              placeholder="Ex: BEMVINDO10"
              maxLength={40}
            />
            <label className="space-y-1 text-sm">
              <span className="block font-medium text-neutral-900">Tipo de desconto</span>
              <select
                value={form.discount_type}
                onChange={(event) =>
                  setForm({
                    ...form,
                    discount_type: event.target.value === 'fixed' ? 'fixed' : 'percent',
                  })
                }
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5"
              >
                <option value="percent">Porcentagem (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </label>
            <Input
              label={form.discount_type === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'}
              value={form.discount_value}
              onChange={(event) => setForm({ ...form, discount_value: event.target.value })}
              inputMode="decimal"
              placeholder={form.discount_type === 'percent' ? '10' : '15,00'}
            />
            <label className="flex items-center gap-2 self-end text-sm text-neutral-800">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              Cupom ativo
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" loading={loading} onClick={() => void save()}>
              Salvar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
            >
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <Card>
        {items.length === 0 ? (
          <p className="text-sm text-neutral-600">Nenhum cupom criado.</p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-neutral-950">{item.code}</p>
                  <p className="text-sm text-neutral-600">
                    {item.discount_type === 'percent'
                      ? `${Number(item.discount_value)}% da compra`
                      : `${formatCurrency(Number(item.discount_value))} de desconto`}
                    {' · '}
                    {item.active ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => void toggle(item)}>
                    {item.active ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => startEdit(item)}>
                    Editar
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void remove(item.id)}>
                    Excluir
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
