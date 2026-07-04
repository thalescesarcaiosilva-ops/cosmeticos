'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import { createAddressSchema, updateAddressSchema } from '@/schemas/address-schema'

type Address = {
  id: string
  label: string | null
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  zip_code: string
  is_default: boolean
}

const emptyForm = {
  label: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zip_code: '',
  is_default: false,
}

function AddressFormFields({
  form,
  onChange,
}: {
  form: typeof emptyForm
  onChange: (field: keyof typeof emptyForm, value: string | boolean) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label="Apelido" value={form.label} onChange={(e) => onChange('label', e.target.value)} />
      <Input label="CEP" value={form.zip_code} onChange={(e) => onChange('zip_code', e.target.value)} required />
      <Input label="Rua" value={form.street} onChange={(e) => onChange('street', e.target.value)} className="sm:col-span-2" required />
      <Input label="Número" value={form.number} onChange={(e) => onChange('number', e.target.value)} required />
      <Input label="Complemento" value={form.complement} onChange={(e) => onChange('complement', e.target.value)} />
      <Input label="Bairro" value={form.neighborhood} onChange={(e) => onChange('neighborhood', e.target.value)} required />
      <Input label="Cidade" value={form.city} onChange={(e) => onChange('city', e.target.value)} required />
      <Input label="UF" value={form.state} onChange={(e) => onChange('state', e.target.value.toUpperCase())} maxLength={2} required />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={form.is_default}
          onChange={(e) => onChange('is_default', e.target.checked)}
          className="rounded border-border text-brand focus:ring-brand"
        />
        Endereço principal
      </label>
    </div>
  )
}

export function AddressesManager() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const loadAddresses = useCallback(async () => {
    const { data } = await fetchApi<Address[]>('/api/account/addresses')
    setAddresses(data ?? [])
  }, [])

  useEffect(() => {
    loadAddresses()
  }, [loadAddresses])

  function updateField(field: keyof typeof emptyForm, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function startEdit(addr: Address) {
    setEditingId(addr.id)
    setForm({
      label: addr.label ?? '',
      street: addr.street,
      number: addr.number,
      complement: addr.complement ?? '',
      neighborhood: addr.neighborhood,
      city: addr.city,
      state: addr.state,
      zip_code: addr.zip_code,
      is_default: addr.is_default,
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
    setSuccess(null)

    const payload = {
      ...form,
      label: form.label || undefined,
      complement: form.complement || null,
      state: form.state.toUpperCase(),
    }

    const parsed = editingId
      ? updateAddressSchema.safeParse(payload)
      : createAddressSchema.safeParse(payload)

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const url = editingId ? `/api/account/addresses/${editingId}` : '/api/account/addresses'
    const { error: apiError } = await fetchApi(url, {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(parsed.data),
    })
    setLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    setSuccess(editingId ? 'Endereço atualizado' : 'Endereço adicionado')
    cancelForm()
    loadAddresses()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este endereço?')) return
    const { error: apiError } = await fetchApi(`/api/account/addresses/${id}`, { method: 'DELETE' })
    if (apiError) {
      setError(apiError)
      return
    }
    loadAddresses()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Endereços</h1>
        {!showForm && (
          <Button type="button" onClick={() => setShowForm(true)}>
            Novo endereço
          </Button>
        )}
      </div>
      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}
      {showForm && (
        <Card title={editingId ? 'Editar endereço' : 'Novo endereço'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <AddressFormFields form={form} onChange={updateField} />
            <div className="flex gap-3">
              <Button type="submit" loading={loading}>Salvar</Button>
              <Button type="button" variant="secondary" onClick={cancelForm}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}
      <ul className="space-y-3">
        {addresses.map((addr) => (
          <li key={addr.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  {addr.label && <p className="font-semibold">{addr.label}</p>}
                  <p className="text-sm text-text-secondary">
                    {addr.street}, {addr.number}
                    {addr.complement ? ` — ${addr.complement}` : ''}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {addr.neighborhood}, {addr.city}/{addr.state} — CEP {addr.zip_code}
                  </p>
                  {addr.is_default && (
                    <span className="mt-1 inline-block text-xs font-medium text-brand">Principal</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => startEdit(addr)}>Editar</Button>
                  <Button type="button" variant="danger" onClick={() => handleDelete(addr.id)}>Remover</Button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {addresses.length === 0 && !showForm && (
        <Card><p className="text-text-secondary">Nenhum endereço cadastrado.</p></Card>
      )}
    </div>
  )
}
