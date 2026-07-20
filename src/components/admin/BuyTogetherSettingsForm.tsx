'use client'

import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { fetchApi } from '@/lib/api/fetch-api'
import {
  DEFAULT_BUY_TOGETHER_SETTINGS,
  type BuyTogetherCssSettings,
  type BuyTogetherSettings,
} from '@/types/buy-together-settings'

type FormState = BuyTogetherSettings & { column_available?: boolean }

const CSS_FIELDS: Array<{
  key: keyof BuyTogetherCssSettings
  label: string
  placeholder: string
}> = [
  { key: 'sectionBackground', label: 'Fundo da seção', placeholder: '#FFF8F0 ou cream' },
  { key: 'sectionBorderColor', label: 'Cor da borda', placeholder: '#E8DDD3' },
  { key: 'sectionBorderRadius', label: 'Raio da borda', placeholder: '12px' },
  { key: 'titleColor', label: 'Cor do título', placeholder: '#3d1654' },
  { key: 'subtitleColor', label: 'Cor do subtítulo', placeholder: '#6b5b66' },
  { key: 'priceColor', label: 'Cor do preço', placeholder: '#3d1654' },
  { key: 'badgeBackground', label: 'Fundo do selo %', placeholder: '#5c4033' },
  { key: 'badgeTextColor', label: 'Texto do selo %', placeholder: '#ffffff' },
  { key: 'buttonBackground', label: 'Fundo do botão', placeholder: '#5c4033' },
  { key: 'buttonTextColor', label: 'Texto do botão', placeholder: '#ffffff' },
  { key: 'savingsColor', label: 'Cor “Economize”', placeholder: '#8B1E3F' },
]

export function BuyTogetherSettingsForm() {
  const [form, setForm] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [migrationNeeded, setMigrationNeeded] = useState(false)

  useEffect(() => {
    fetchApi<FormState>('/api/admin/buy-together-settings').then(({ data, error: apiError }) => {
      if (apiError || !data) {
        setForm(DEFAULT_BUY_TOGETHER_SETTINGS)
        return
      }
      setMigrationNeeded(data.column_available === false)
      setForm({
        ...DEFAULT_BUY_TOGETHER_SETTINGS,
        ...data,
        css: { ...DEFAULT_BUY_TOGETHER_SETTINGS.css, ...data.css },
      })
    })
  }, [])

  function updateField<K extends keyof BuyTogetherSettings>(key: K, value: BuyTogetherSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function updateCss<K extends keyof BuyTogetherCssSettings>(
    key: K,
    value: BuyTogetherCssSettings[K]
  ) {
    setForm((prev) =>
      prev ? { ...prev, css: { ...prev.css, [key]: value } } : prev
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    const payload: BuyTogetherSettings = {
      enabled: form.enabled,
      defaultDiscountPercent: Number(form.defaultDiscountPercent),
      maxBundleTotal: Number(form.maxBundleTotal),
      title: form.title,
      eyebrow: form.eyebrow,
      subtitleFallback: form.subtitleFallback,
      ctaLabel: form.ctaLabel,
      ctaAddedLabel: form.ctaAddedLabel,
      css: form.css,
    }

    const { data, error: apiError, message } = await fetchApi<FormState>(
      '/api/admin/buy-together-settings',
      { method: 'PATCH', body: JSON.stringify(payload) }
    )

    setLoading(false)

    if (apiError) {
      setError(apiError)
      if (apiError.includes('migration')) setMigrationNeeded(true)
      return
    }

    if (data) {
      setForm({
        ...DEFAULT_BUY_TOGETHER_SETTINGS,
        ...data,
        css: { ...DEFAULT_BUY_TOGETHER_SETTINGS.css, ...data.css },
      })
    }
    setSuccess(message ?? 'Salvo')
    setMigrationNeeded(false)
  }

  if (!form) {
    return <p className="text-text-secondary">Carregando configurações…</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {migrationNeeded && (
        <Alert type="info">
          Aplique a migration{' '}
          <code className="text-xs">202607200002_buy_together_settings.sql</code> no Supabase.
        </Alert>
      )}
      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <Card title="Compre junto — ativação">
        <p className="mb-4 text-sm text-text-secondary">
          Controla o bloco de oferta na página de produto. Desative para ocultar em toda a loja.
        </p>
        <label className="flex items-center gap-3 text-sm font-medium text-text-primary">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => updateField('enabled', e.target.checked)}
            className="size-4"
          />
          Exibir “Compre junto” na página de produto
        </label>
      </Card>

      <Card title="Textos e regras">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Título"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            required
          />
          <Input
            label="Selo acima do título (eyebrow)"
            value={form.eyebrow}
            onChange={(e) => updateField('eyebrow', e.target.value)}
            placeholder="Oferta"
          />
          <div className="md:col-span-2">
            <Input
              label="Subtítulo padrão"
              value={form.subtitleFallback}
              onChange={(e) => updateField('subtitleFallback', e.target.value)}
            />
          </div>
          <Input
            label="Texto do botão"
            value={form.ctaLabel}
            onChange={(e) => updateField('ctaLabel', e.target.value)}
          />
          <Input
            label="Texto após adicionar"
            value={form.ctaAddedLabel}
            onChange={(e) => updateField('ctaAddedLabel', e.target.value)}
          />
          <Input
            label="Desconto padrão (%)"
            type="number"
            min={0}
            max={90}
            step={0.5}
            value={form.defaultDiscountPercent}
            onChange={(e) => updateField('defaultDiscountPercent', Number(e.target.value))}
          />
          <Input
            label="Valor máximo do combo (R$)"
            type="number"
            min={1}
            step={1}
            value={form.maxBundleTotal}
            onChange={(e) => updateField('maxBundleTotal', Number(e.target.value))}
          />
        </div>
        <p className="mt-3 text-xs text-text-muted">
          O desconto padrão vale para sugestões automáticas (quando não há bundle cadastrado). O valor
          máximo oculta combos mais caros que o limite.
        </p>
      </Card>

      <Card title="CSS / aparência">
        <p className="mb-4 text-sm text-text-secondary">
          Deixe em branco para usar o visual padrão da loja. Aceita cores hex, rgb ou nomes CSS.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {CSS_FIELDS.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              value={form.css[field.key]}
              onChange={(e) => updateCss(field.key, e.target.value)}
              placeholder={field.placeholder}
            />
          ))}
        </div>
        <div className="mt-4">
          <Textarea
            label="CSS customizado (escopo .buy-together-block)"
            value={form.css.customCss}
            onChange={(e) => updateCss('customCss', e.target.value)}
            rows={8}
            className="font-mono text-xs leading-relaxed"
            placeholder={`.buy-together-block .bt-title {\n  letter-spacing: 0.02em;\n}\n.buy-together-block .bt-cta {\n  box-shadow: 0 8px 20px rgba(0,0,0,0.12);\n}`}
          />
          <p className="mt-2 text-xs text-text-muted">
            Prefixe seletores com <code>.buy-together-block</code>. Classes úteis:{' '}
            <code>.bt-title</code>, <code>.bt-subtitle</code>, <code>.bt-price</code>,{' '}
            <code>.bt-badge</code>, <code>.bt-cta</code>, <code>.bt-savings</code>.
          </p>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Salvar Compre junto
        </Button>
      </div>
    </form>
  )
}
