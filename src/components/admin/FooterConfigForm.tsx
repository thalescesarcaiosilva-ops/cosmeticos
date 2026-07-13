'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { fetchApi } from '@/lib/api/fetch-api'
import { updateFooterSettingsSchema } from '@/schemas/footer-settings-schema'

type FooterSettings = {
  footer_phone_label: string
  contact_whatsapp_label: string
  contact_whatsapp_href: string | null
  contact_page_label: string
  contact_page_href: string
  contact_address_label: string
  footer_social_heading: string
  footer_security_heading: string
  footer_payment_text: string
  footer_security_text: string | null
  footer_disclaimers: string[]
  footer_columns_available?: boolean
}

export function FooterConfigForm() {
  const [form, setForm] = useState<FooterSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [migrationNeeded, setMigrationNeeded] = useState(false)

  useEffect(() => {
    fetchApi<FooterSettings & Record<string, unknown>>('/api/admin/footer-settings').then(
      ({ data }) => {
        if (data) {
          setMigrationNeeded(data.footer_columns_available === false)
          setForm({
            footer_phone_label: data.footer_phone_label ?? 'Ligue para nós',
            contact_whatsapp_label: data.contact_whatsapp_label ?? 'WhatsApp',
            contact_whatsapp_href: data.contact_whatsapp_href ?? '',
            contact_page_label: data.contact_page_label ?? 'Fale Conosco',
            contact_page_href: data.contact_page_href ?? '',
            contact_address_label: data.contact_address_label ?? 'Endereço',
            footer_social_heading: data.footer_social_heading ?? 'Siga a gente:',
            footer_security_heading: data.footer_security_heading ?? 'Loja Segura',
            footer_payment_text: data.footer_payment_text ?? '',
            footer_security_text: data.footer_security_text ?? '',
            footer_disclaimers: data.footer_disclaimers ?? [],
          })
        }
      }
    )
  }, [])

  function updateDisclaimer(index: number, value: string) {
    if (!form) return
    const next = [...form.footer_disclaimers]
    next[index] = value
    setForm({ ...form, footer_disclaimers: next })
  }

  function addDisclaimer() {
    if (!form) return
    setForm({ ...form, footer_disclaimers: [...form.footer_disclaimers, ''] })
  }

  function removeDisclaimer(index: number) {
    if (!form) return
    setForm({
      ...form,
      footer_disclaimers: form.footer_disclaimers.filter((_, i) => i !== index),
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setError(null)
    setSuccess(null)

    const payload = {
      ...form,
      contact_whatsapp_href: form.contact_whatsapp_href || null,
      footer_security_text: form.footer_security_text || null,
      footer_disclaimers: form.footer_disclaimers.filter((d) => d.trim()),
    }

    const parsed = updateFooterSettingsSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const { data, error: apiError, message } = await fetchApi<FooterSettings>(
      '/api/admin/footer-settings',
      { method: 'PATCH', body: JSON.stringify(parsed.data) }
    )
    setLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    if (data) {
      setMigrationNeeded(data.footer_columns_available === false)
    }
    setSuccess(message ?? 'Configurações salvas')
  }

  if (!form) return <p className="text-text-secondary">Carregando…</p>

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert type="error">{error}</Alert>}
      {migrationNeeded && (
        <Alert type="error">
          Execute{' '}
          <code className="text-xs">
            supabase/migrations/202507010002_payment_method_images_and_address.sql
          </code>{' '}
          no Supabase para habilitar opções do rodapé.
        </Alert>
      )}
      {success && <Alert type="success">{success}</Alert>}

      <Alert type="info">
        Nome da loja, CNPJ, razão social, e-mail, endereço e horários vêm de{' '}
        <Link href="/admin/loja" className="font-medium text-brand hover:underline">
          Dados da loja
        </Link>
        . O rodapé exibe essas informações automaticamente.
      </Alert>

      <Card title="Atendimento no rodapé">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Título da coluna de telefone"
            value={form.footer_phone_label}
            onChange={(e) => setForm({ ...form, footer_phone_label: e.target.value })}
          />
          <Input
            label="Título do endereço"
            value={form.contact_address_label}
            onChange={(e) => setForm({ ...form, contact_address_label: e.target.value })}
          />
          <Input
            label="Texto link WhatsApp"
            value={form.contact_whatsapp_label}
            onChange={(e) => setForm({ ...form, contact_whatsapp_label: e.target.value })}
          />
          <Input
            label="URL WhatsApp"
            value={form.contact_whatsapp_href ?? ''}
            onChange={(e) => setForm({ ...form, contact_whatsapp_href: e.target.value })}
            placeholder="https://wa.me/..."
          />
          <Input
            label="Texto Fale Conosco"
            value={form.contact_page_label}
            onChange={(e) => setForm({ ...form, contact_page_label: e.target.value })}
          />
          <Input
            label="Link Fale Conosco"
            value={form.contact_page_href}
            onChange={(e) => setForm({ ...form, contact_page_href: e.target.value })}
            placeholder="/paginas/fale-conosco"
          />
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Telefone, e-mail, endereço e horários são lidos de Dados da loja. Telefone usa DDD,
          número e link configurados na aba Identidade.
        </p>
      </Card>

      <Card title="Redes e selos">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Título redes sociais"
            value={form.footer_social_heading}
            onChange={(e) => setForm({ ...form, footer_social_heading: e.target.value })}
          />
          <Input
            label="Título selos de segurança"
            value={form.footer_security_heading}
            onChange={(e) => setForm({ ...form, footer_security_heading: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Texto de segurança (opcional)"
              value={form.footer_security_text ?? ''}
              onChange={(e) => setForm({ ...form, footer_security_text: e.target.value })}
              rows={2}
            />
          </div>
        </div>
      </Card>

      <Card title="Pagamento no rodapé">
        <Input
          label="Texto acima dos ícones"
          value={form.footer_payment_text}
          onChange={(e) => setForm({ ...form, footer_payment_text: e.target.value })}
        />
        <p className="mt-1 text-xs text-text-muted">
          Use {'{count}'} para o número de parcelas sem juros
        </p>
      </Card>

      <Card title="Avisos legais (rodapé inferior)">
        <div className="space-y-3">
          {form.footer_disclaimers.map((line, index) => (
            <div key={index} className="flex gap-2">
              <Textarea
                value={line}
                onChange={(e) => updateDisclaimer(index, e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button type="button" variant="danger" onClick={() => removeDisclaimer(index)}>
                Remover
              </Button>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={addDisclaimer}>
            Adicionar linha
          </Button>
        </div>
      </Card>

      <Button type="submit" loading={loading}>
        Salvar configurações do rodapé
      </Button>
    </form>
  )
}
