'use client'

import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { fetchApi } from '@/lib/api/fetch-api'
import type { StoreOpeningHoursSlot } from '@/schemas/store-profile-schema'

type PolicyPage = { slug: string; title: string }

type StoreProfileFormData = {
  store_name: string
  company_legal_name: string | null
  cnpj: string | null
  store_description: string | null
  contact_email: string | null
  phone_area_code: string
  phone_number: string
  phone_href: string
  store_street: string | null
  store_street_number: string | null
  store_complement: string | null
  store_neighborhood: string | null
  store_city: string | null
  store_state: string | null
  store_postal_code: string | null
  store_country: string
  store_opening_hours: StoreOpeningHoursSlot[]
  return_enabled: boolean
  return_days: number | null
  return_method: 'ReturnByMail' | 'ReturnInStore'
  return_fees: 'FreeReturn' | 'ReturnShippingFees' | 'RestockingFees'
  return_policy_page_slug: string | null
  return_policy_notes: string | null
  seo_handling_days_min: number
  seo_handling_days_max: number
  head_scripts: string | null
  _storeProfileColumnsAvailable?: boolean
  policyPages?: PolicyPage[]
}

const TABS = [
  { id: 'identity', label: 'Identidade' },
  { id: 'address', label: 'Endereço e horários' },
  { id: 'returns', label: 'Devoluções' },
  { id: 'seo', label: 'SEO / Frete' },
  { id: 'analytics', label: 'Analytics' },
] as const

type TabId = (typeof TABS)[number]['id']

const WEEKDAYS = [
  { value: 'Monday', label: 'Segunda' },
  { value: 'Tuesday', label: 'Terça' },
  { value: 'Wednesday', label: 'Quarta' },
  { value: 'Thursday', label: 'Quinta' },
  { value: 'Friday', label: 'Sexta' },
  { value: 'Saturday', label: 'Sábado' },
  { value: 'Sunday', label: 'Domingo' },
] as const

type Weekday = (typeof WEEKDAYS)[number]['value']

function parseDayOfWeekSelection(selected: string[]): StoreOpeningHoursSlot['dayOfWeek'] {
  const valid = selected.filter((value): value is Weekday =>
    WEEKDAYS.some((day) => day.value === value)
  )
  if (valid.length === 0) return 'Monday'
  return valid.length === 1 ? valid[0]! : valid
}

export function StoreProfileForm() {
  const [tab, setTab] = useState<TabId>('identity')
  const [form, setForm] = useState<StoreProfileFormData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [migrationNeeded, setMigrationNeeded] = useState(false)

  useEffect(() => {
    fetchApi<StoreProfileFormData>('/api/admin/store-profile').then(({ data }) => {
      if (data) {
        setForm({
          ...data,
          store_opening_hours: data.store_opening_hours ?? [],
          return_days: data.return_days ?? 7,
        })
        setMigrationNeeded(data._storeProfileColumnsAvailable === false)
      }
    })
  }, [])

  function updateField<K extends keyof StoreProfileFormData>(
    key: K,
    value: StoreProfileFormData[K]
  ) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function addOpeningSlot() {
    if (!form) return
    updateField('store_opening_hours', [
      ...form.store_opening_hours,
      { dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '18:00' },
    ])
  }

  function updateOpeningSlot(index: number, patch: Partial<StoreOpeningHoursSlot>) {
    if (!form) return
    const next = form.store_opening_hours.map((slot, i) =>
      i === index ? { ...slot, ...patch } : slot
    )
    updateField('store_opening_hours', next)
  }

  function removeOpeningSlot(index: number) {
    if (!form) return
    updateField(
      'store_opening_hours',
      form.store_opening_hours.filter((_, i) => i !== index)
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    const { data, error: apiError, message } = await fetchApi<StoreProfileFormData>(
      '/api/admin/store-profile',
      {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          policyPages: undefined,
          _storeProfileColumnsAvailable: undefined,
        }),
      }
    )

    setLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    if (data) setForm({ ...data, policyPages: form.policyPages })
    setSuccess(message ?? 'Dados salvos')
    if ((data as { migrationNeeded?: boolean })?.migrationNeeded) {
      setMigrationNeeded(true)
    }
  }

  if (!form) {
    return <p className="text-text-secondary">Carregando dados da loja…</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {migrationNeeded && (
        <Alert type="info">
          Aplique as migrations{' '}
          <code className="text-xs">202507020002_store_profile_merchant.sql</code> e{' '}
          <code className="text-xs">202507070001_head_scripts.sql</code>{' '}
          no Supabase para habilitar todos os campos (devoluções, horários, scripts no head).
        </Alert>
      )}
      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-[#3d1654] text-white'
                : 'bg-surface text-text-secondary hover:bg-surface-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'identity' && (
        <Card title="Identidade da loja (schema Store / Google)">
          <p className="mb-4 text-sm text-text-secondary">
            Estes dados alimentam o JSON-LD da loja e o Merchant Center. Use informações reais e
            verificáveis.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Nome da loja"
              value={form.store_name}
              onChange={(e) => updateField('store_name', e.target.value)}
              required
            />
            <Input
              label="Razão social (legalName)"
              value={form.company_legal_name ?? ''}
              onChange={(e) => updateField('company_legal_name', e.target.value || null)}
            />
            <Input
              label="CNPJ (taxID)"
              value={form.cnpj ?? ''}
              onChange={(e) => updateField('cnpj', e.target.value || null)}
            />
            <Input
              label="E-mail de atendimento"
              type="email"
              value={form.contact_email ?? ''}
              onChange={(e) => updateField('contact_email', e.target.value || null)}
            />
            <Input
              label="DDD"
              value={form.phone_area_code}
              onChange={(e) => updateField('phone_area_code', e.target.value)}
            />
            <Input
              label="Telefone"
              value={form.phone_number}
              onChange={(e) => updateField('phone_number', e.target.value)}
            />
            <Input
              label="Telefone internacional (schema)"
              value={form.phone_href}
              onChange={(e) => updateField('phone_href', e.target.value)}
              placeholder="+5527988653033"
              className="md:col-span-2"
            />
            <Textarea
              label="Descrição da loja"
              value={form.store_description ?? ''}
              onChange={(e) => updateField('store_description', e.target.value || null)}
              className="md:col-span-2"
              rows={3}
            />
          </div>
        </Card>
      )}

      {tab === 'address' && (
        <Card title="Endereço e horário de funcionamento">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Rua / Avenida"
              value={form.store_street ?? ''}
              onChange={(e) => updateField('store_street', e.target.value || null)}
              className="md:col-span-2"
            />
            <Input
              label="Número"
              value={form.store_street_number ?? ''}
              onChange={(e) => updateField('store_street_number', e.target.value || null)}
            />
            <Input
              label="Complemento"
              value={form.store_complement ?? ''}
              onChange={(e) => updateField('store_complement', e.target.value || null)}
            />
            <Input
              label="Bairro"
              value={form.store_neighborhood ?? ''}
              onChange={(e) => updateField('store_neighborhood', e.target.value || null)}
            />
            <Input
              label="Cidade"
              value={form.store_city ?? ''}
              onChange={(e) => updateField('store_city', e.target.value || null)}
            />
            <Input
              label="UF"
              value={form.store_state ?? ''}
              onChange={(e) => updateField('store_state', e.target.value.toUpperCase().slice(0, 2) || null)}
              maxLength={2}
            />
            <Input
              label="CEP"
              value={form.store_postal_code ?? ''}
              onChange={(e) => updateField('store_postal_code', e.target.value || null)}
            />
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Horários de atendimento</h3>
              <Button type="button" variant="secondary" onClick={addOpeningSlot}>
                Adicionar faixa
              </Button>
            </div>
            {form.store_opening_hours.map((slot, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[1fr_auto_auto_auto]"
              >
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Dias da semana
                  </label>
                  <select
                    multiple
                    value={Array.isArray(slot.dayOfWeek) ? slot.dayOfWeek : [slot.dayOfWeek]}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
                      updateOpeningSlot(index, {
                        dayOfWeek: parseDayOfWeekSelection(selected),
                      })
                    }}
                    className="h-24 w-full rounded-md border border-border px-2 py-1 text-sm"
                  >
                    {WEEKDAYS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Abre"
                  value={slot.opens}
                  onChange={(e) => updateOpeningSlot(index, { opens: e.target.value })}
                />
                <Input
                  label="Fecha"
                  value={slot.closes}
                  onChange={(e) => updateOpeningSlot(index, { closes: e.target.value })}
                />
                <div className="flex items-end">
                  <Button type="button" variant="ghost" onClick={() => removeOpeningSlot(index)}>
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'returns' && (
        <Card title="Política de devolução (Merchant / Google)">
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.return_enabled}
              onChange={(e) => updateField('return_enabled', e.target.checked)}
              className="rounded border-border text-brand"
            />
            Aceito devoluções (habilita schema MerchantReturnPolicy)
          </label>

          {form.return_enabled && (
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Prazo para devolução (dias)"
                type="number"
                min={1}
                max={365}
                value={form.return_days ?? 7}
                onChange={(e) =>
                  updateField('return_days', e.target.value ? Number(e.target.value) : null)
                }
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-text-primary">
                  Página de política (opcional)
                </label>
                <select
                  value={form.return_policy_page_slug ?? ''}
                  onChange={(e) =>
                    updateField('return_policy_page_slug', e.target.value || null)
                  }
                  className="w-full rounded-md border border-border px-3 py-2.5 text-sm"
                >
                  <option value="">— Nenhuma —</option>
                  {(form.policyPages ?? []).map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.title} (/paginas/{p.slug})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-text-primary">Método</label>
                <select
                  value={form.return_method}
                  onChange={(e) =>
                    updateField(
                      'return_method',
                      e.target.value as StoreProfileFormData['return_method']
                    )
                  }
                  className="w-full rounded-md border border-border px-3 py-2.5 text-sm"
                >
                  <option value="ReturnByMail">Correios / devolução postal</option>
                  <option value="ReturnInStore">Devolução na loja física</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-text-primary">
                  Quem paga o frete de devolução
                </label>
                <select
                  value={form.return_fees}
                  onChange={(e) =>
                    updateField('return_fees', e.target.value as StoreProfileFormData['return_fees'])
                  }
                  className="w-full rounded-md border border-border px-3 py-2.5 text-sm"
                >
                  <option value="FreeReturn">Frete grátis para o cliente</option>
                  <option value="ReturnShippingFees">Cliente paga o frete</option>
                  <option value="RestockingFees">Taxa de reposição de estoque</option>
                </select>
              </div>
              <Textarea
                label="Notas internas (não aparecem no schema)"
                value={form.return_policy_notes ?? ''}
                onChange={(e) => updateField('return_policy_notes', e.target.value || null)}
                className="md:col-span-2"
                rows={3}
              />
            </div>
          )}
        </Card>
      )}

      {tab === 'seo' && (
        <Card title="SEO de frete e entrega">
          <p className="mb-4 text-sm text-text-secondary">
            Prazos de <strong>transitTime</strong> vêm automaticamente dos métodos em{' '}
            <a href="/admin/frete" className="text-brand hover:underline">
              Admin → Frete
            </a>
            . Aqui você define apenas o tempo de separação (handling).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Separação mínima (dias úteis)"
              type="number"
              min={0}
              max={30}
              value={form.seo_handling_days_min}
              onChange={(e) => updateField('seo_handling_days_min', Number(e.target.value))}
            />
            <Input
              label="Separação máxima (dias úteis)"
              type="number"
              min={0}
              max={30}
              value={form.seo_handling_days_max}
              onChange={(e) => updateField('seo_handling_days_max', Number(e.target.value))}
            />
          </div>
        </Card>
      )}

      {tab === 'analytics' && (
        <Card title="Scripts no &lt;head&gt;">
          <p className="mb-4 text-sm text-text-secondary">
            Cole aqui os trechos HTML de analytics (Google Tag, GTM, Meta Pixel, Clarity, etc.).
            Eles são injetados no <code className="text-xs">&lt;head&gt;</code> de todas as páginas da
            loja — não no painel admin.
          </p>
          <Textarea
            label="Scripts HTML"
            value={form.head_scripts ?? ''}
            onChange={(e) => updateField('head_scripts', e.target.value || null)}
            rows={14}
            className="font-mono text-xs leading-relaxed"
            placeholder={`<!-- Google Tag Manager -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>`}
          />
          <p className="mt-3 text-xs text-text-muted">
            Aceita tags <code>&lt;script&gt;</code>, <code>&lt;meta&gt;</code>,{' '}
            <code>&lt;link&gt;</code> e <code>&lt;style&gt;</code>. Cole exatamente como o provedor
            fornece.
          </p>
        </Card>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Salvar dados da loja
        </Button>
      </div>
    </form>
  )
}
