'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  InstallmentRatesEditor,
  SupportTopicsEditor,
} from '@/components/admin/InstallmentRatesEditor'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { fetchApi } from '@/lib/api/fetch-api'
import { MediaSelectField } from '@/components/admin/MediaSelectField'
import { serializeInstallmentInterestRates } from '@/lib/payment/installment-rates'
import { updateSiteSettingsSchema } from '@/schemas/site-settings-schema'
import {
  DEFAULT_CHECKOUT_PAYMENT_SETTINGS,
  DEFAULT_PAYMENT_SETTINGS,
} from '@/types/payment'

type SiteSettings = {
  store_name: string
  logo_image_url: string | null
  phone_area_code: string
  phone_number: string
  phone_href: string
  help_label: string
  help_href: string
  seo_title: string | null
  seo_title_template: string | null
  seo_description: string | null
  seo_og_image_url: string | null
  favicon_url: string | null
  installment_max: number
  installment_interest_free: number
  installment_min_value: number
  installment_interest_rate: number
  installment_interest_rates: Record<number, number>
  installment_text_free: string
  installment_text_interest: string
  contact_page_title: string
  contact_page_intro: string
  contact_page_support_topics: Array<{ title: string; description: string }>
  payment_checkout_config: {
    pixEnabled: boolean
    pixDiscount: number
    cardEnabled: boolean
  }
  payment_columns_available?: boolean
  payment_config_skipped?: boolean
  seo_columns_available?: boolean
}

export function SiteSettingsForm() {
  const [form, setForm] = useState<SiteSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [paymentMigrationNeeded, setPaymentMigrationNeeded] = useState(false)
  const [paymentConfigSkipped, setPaymentConfigSkipped] = useState(false)
  const [seoMigrationNeeded, setSeoMigrationNeeded] = useState(false)

  useEffect(() => {
    fetchApi<SiteSettings>('/api/admin/site-settings').then(({ data }) => {
      if (data) {
        setPaymentMigrationNeeded(data.payment_columns_available === false)
        setPaymentConfigSkipped(data.payment_config_skipped === true)
        setSeoMigrationNeeded(data.seo_columns_available === false)
        setForm({
          store_name: data.store_name ?? '',
          logo_image_url: data.logo_image_url ?? null,
          phone_area_code: data.phone_area_code ?? '',
          phone_number: data.phone_number ?? '',
          phone_href: data.phone_href ?? '',
          help_label: data.help_label ?? '',
          help_href: data.help_href ?? '',
          seo_title: data.seo_title ?? data.store_name ?? '',
          seo_title_template: data.seo_title_template ?? `%s | ${data.store_name ?? 'Sua Loja'}`,
          seo_description: data.seo_description ?? '',
          seo_og_image_url: data.seo_og_image_url ?? null,
          favicon_url: data.favicon_url ?? null,
          installment_max: data.installment_max ?? DEFAULT_PAYMENT_SETTINGS.maxInstallments,
          installment_interest_free:
            data.installment_interest_free ?? DEFAULT_PAYMENT_SETTINGS.interestFreeInstallments,
          installment_min_value:
            Number(data.installment_min_value) || DEFAULT_PAYMENT_SETTINGS.minInstallmentValue,
          installment_interest_rate:
            Number(data.installment_interest_rate) ?? DEFAULT_PAYMENT_SETTINGS.monthlyInterestRate,
          installment_interest_rates: data.installment_interest_rates ?? {},
          installment_text_free:
            data.installment_text_free ?? DEFAULT_PAYMENT_SETTINGS.installmentTextInterestFree,
          installment_text_interest:
            data.installment_text_interest ?? DEFAULT_PAYMENT_SETTINGS.installmentTextWithInterest,
          payment_checkout_config:
            data.payment_checkout_config ?? DEFAULT_CHECKOUT_PAYMENT_SETTINGS,
          contact_page_title: data.contact_page_title ?? 'Central de Atendimento',
          contact_page_intro: data.contact_page_intro ?? '',
          contact_page_support_topics: data.contact_page_support_topics ?? [],
        })
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setError(null)
    setSuccess(null)

    if (!form.logo_image_url) {
      setError('Selecione uma imagem para o logo da loja.')
      return
    }

    const parsed = updateSiteSettingsSchema.safeParse({
      ...form,
      installment_interest_rates: serializeInstallmentInterestRates(form.installment_interest_rates),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const { data, error: apiError, message } = await fetchApi<SiteSettings>(
      '/api/admin/site-settings',
      {
        method: 'PATCH',
        body: JSON.stringify(parsed.data),
      }
    )
    setLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    if (data) {
      setForm({
        store_name: data.store_name,
        logo_image_url: data.logo_image_url ?? null,
        phone_area_code: data.phone_area_code,
        phone_number: data.phone_number,
        phone_href: data.phone_href,
        help_label: data.help_label,
        help_href: data.help_href,
        seo_title: data.seo_title ?? data.store_name,
        seo_title_template: data.seo_title_template ?? `%s | ${data.store_name}`,
        seo_description: data.seo_description ?? '',
        seo_og_image_url: data.seo_og_image_url ?? null,
        favicon_url: data.favicon_url ?? null,
        installment_max: data.installment_max,
        installment_interest_free: data.installment_interest_free,
        installment_min_value: data.installment_min_value,
        installment_interest_rate: data.installment_interest_rate,
        installment_interest_rates: data.installment_interest_rates ?? {},
        installment_text_free: data.installment_text_free,
        installment_text_interest: data.installment_text_interest,
        contact_page_title: data.contact_page_title ?? 'Central de Atendimento',
        contact_page_intro: data.contact_page_intro ?? '',
        contact_page_support_topics: data.contact_page_support_topics ?? [],
        payment_checkout_config:
          data.payment_checkout_config ?? DEFAULT_CHECKOUT_PAYMENT_SETTINGS,
      })
      setPaymentMigrationNeeded(data.payment_columns_available === false)
      setPaymentConfigSkipped(data.payment_config_skipped === true)
      setSeoMigrationNeeded(data.seo_columns_available === false)
    }
    setSuccess(message ?? 'Configurações salvas')
  }

  if (!form) return <p className="text-text-secondary">Carregando…</p>

  const contactFields: { key: keyof SiteSettings; label: string }[] = [
    { key: 'phone_area_code', label: 'DDD' },
    { key: 'phone_number', label: 'Telefone' },
    { key: 'phone_href', label: 'Link do telefone' },
    { key: 'help_label', label: 'Texto ajuda' },
    { key: 'help_href', label: 'Link ajuda' },
  ]

  return (
    <div className="space-y-8">
      {error && <Alert type="error">{error}</Alert>}
      {paymentMigrationNeeded && (
        <Alert type="error">
          Parcelamento ainda não está no banco. Execute{' '}
          <code className="text-xs">supabase/sql/PARTE_10_payment_settings.sql</code> no Supabase
          para salvar essas configurações.
        </Alert>
      )}
      {paymentConfigSkipped && (
        <Alert type="error">
          As formas de pagamento com ícone não foram salvas no banco. Execute{' '}
          <code className="text-xs">supabase/migrations/202507010003_payment_methods_config.sql</code>{' '}
          no Supabase e salve novamente.
        </Alert>
      )}
      {seoMigrationNeeded && (
        <Alert type="error">
          SEO ainda não está no banco. Execute{' '}
          <code className="text-xs">supabase/migrations/202507010001_seo_and_contact_email.sql</code>{' '}
          no Supabase para habilitar as configurações de SEO.
        </Alert>
      )}
      {success && <Alert type="success">{success}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card title="Identidade da loja">
          <div className="mb-4">
            <MediaSelectField
              label="Logo (imagem)"
              value={form.logo_image_url}
              onChange={(url) => setForm({ ...form, logo_image_url: url })}
              hint="Exibido no header da loja e no painel admin."
            />
          </div>
          <div className="mb-4">
            <MediaSelectField
              label="Favicon"
              value={form.favicon_url}
              onChange={(url) => setForm({ ...form, favicon_url: url })}
              hint="Ícone da aba do navegador. Use PNG ou ICO quadrado (32×32 ou 64×64)."
            />
          </div>
          <Input
            label="Nome da loja"
            value={form.store_name}
            onChange={(e) => setForm({ ...form, store_name: e.target.value })}
          />
          <p className="mt-1 text-xs text-text-muted">
            Nome exibido no header e em textos da loja.
          </p>
          <div className="mt-4">
            <Input
              label="Título do site"
              value={form.seo_title ?? ''}
              onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
            />
            <p className="mt-1 text-xs text-text-muted">
              Texto da aba do navegador na página inicial (ex.: Atlas Cosméticos).
            </p>
          </div>
          <p className="mt-4 text-sm text-text-secondary">
            Os banners da página inicial são gerenciados em{' '}
            <Link href="/admin/banners" className="font-medium text-brand hover:underline">
              Admin → Banners
            </Link>
            .
          </p>
        </Card>

        <Card title="SEO">
          <div className="grid gap-4">
            <Input
              label="Template de título"
              value={form.seo_title_template ?? ''}
              onChange={(e) => setForm({ ...form, seo_title_template: e.target.value })}
            />
            <p className="-mt-2 text-xs text-text-muted">
              Use %s para o título da página. Ex.: %s | {form.store_name || 'Minha Loja'}
            </p>
            <Textarea
              label="Descrição padrão (meta description)"
              value={form.seo_description ?? ''}
              onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
              rows={3}
            />
            <MediaSelectField
              label="Imagem Open Graph (opcional)"
              value={form.seo_og_image_url}
              onChange={(url) => setForm({ ...form, seo_og_image_url: url })}
              hint="Imagem exibida ao compartilhar links. Se vazio, usa o logo."
            />
          </div>
        </Card>

        <Card title="Contato no header">
          <div className="grid gap-4 sm:grid-cols-2">
            {contactFields.map(({ key, label }) => (
              <Input
                key={key}
                label={label}
                value={String(form[key] ?? '')}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            ))}
          </div>
        </Card>

        <Card title="Parcelamento">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Máximo de parcelas"
              type="number"
              min={1}
              max={24}
              value={form.installment_max}
              onChange={(e) =>
                setForm({ ...form, installment_max: parseInt(e.target.value, 10) || 1 })
              }
            />
            <Input
              label="Parcelas sem juros"
              type="number"
              min={1}
              max={24}
              value={form.installment_interest_free}
              onChange={(e) =>
                setForm({
                  ...form,
                  installment_interest_free: parseInt(e.target.value, 10) || 1,
                })
              }
            />
            <Input
              label="Valor mínimo da parcela (R$)"
              type="number"
              step="0.01"
              min={0.01}
              value={form.installment_min_value}
              onChange={(e) =>
                setForm({
                  ...form,
                  installment_min_value: parseFloat(e.target.value) || 5,
                })
              }
            />
            <Input
              label="Taxa mensal com juros (%)"
              type="number"
              step="0.01"
              min={0}
              value={form.installment_interest_rate}
              onChange={(e) =>
                setForm({
                  ...form,
                  installment_interest_rate: parseFloat(e.target.value) || 0,
                })
              }
            />
            <div className="sm:col-span-2">
              <Textarea
                label="Texto parcelamento sem juros"
                value={form.installment_text_free}
                onChange={(e) => setForm({ ...form, installment_text_free: e.target.value })}
                rows={2}
                placeholder="{count}x de {value} sem juros"
              />
              <p className="mt-1 text-xs text-text-muted">
                Use {'{count}'} para o número de parcelas e {'{value}'} para o valor formatado.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Textarea
                label="Texto parcelamento com juros"
                value={form.installment_text_interest}
                onChange={(e) => setForm({ ...form, installment_text_interest: e.target.value })}
                rows={2}
                placeholder="{count}x de {value} com juros"
              />
            </div>
            <div className="sm:col-span-2 border-t border-border pt-4">
              <p className="mb-3 text-sm font-semibold text-text-primary">
                Taxas por parcela (opcional)
              </p>
              <InstallmentRatesEditor
                maxInstallments={form.installment_max}
                interestFreeInstallments={form.installment_interest_free}
                defaultRate={form.installment_interest_rate}
                rates={form.installment_interest_rates}
                onChange={(rates) => setForm({ ...form, installment_interest_rates: rates })}
              />
            </div>
          </div>
        </Card>

        <Card title="Página de contato / suporte">
          <p className="mb-4 text-sm text-text-secondary">
            Conteúdo exibido em{' '}
            <Link href="/fale-conosco" className="text-brand hover:underline" target="_blank">
              /fale-conosco
            </Link>
            . Canais (telefone, e-mail, endereço) vêm do perfil da loja e rodapé.
          </p>
          <div className="grid gap-4">
            <Input
              label="Título da página"
              value={form.contact_page_title}
              onChange={(e) => setForm({ ...form, contact_page_title: e.target.value })}
              maxLength={100}
            />
            <Textarea
              label="Texto introdutório"
              value={form.contact_page_intro}
              onChange={(e) => setForm({ ...form, contact_page_intro: e.target.value })}
              rows={4}
              placeholder="Estamos aqui para ajudar com pedidos, produtos e parcerias."
              maxLength={2000}
            />
            <SupportTopicsEditor
              topics={form.contact_page_support_topics}
              onChange={(topics) => setForm({ ...form, contact_page_support_topics: topics })}
            />
          </div>
        </Card>

        <Card title="Checkout — Pix e cartão">
          <p className="mb-4 text-sm text-text-secondary">
            Controla quais métodos aparecem na etapa de pagamento do checkout.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={form.payment_checkout_config.pixEnabled}
                onChange={(e) =>
                  setForm({
                    ...form,
                    payment_checkout_config: {
                      ...form.payment_checkout_config,
                      pixEnabled: e.target.checked,
                    },
                  })
                }
                className="size-4 rounded border-border text-brand focus:ring-brand"
              />
              Pix habilitado
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={form.payment_checkout_config.cardEnabled}
                onChange={(e) =>
                  setForm({
                    ...form,
                    payment_checkout_config: {
                      ...form.payment_checkout_config,
                      cardEnabled: e.target.checked,
                    },
                  })
                }
                className="size-4 rounded border-border text-brand focus:ring-brand"
              />
              Cartão habilitado
            </label>
            <Input
              label="Desconto no Pix (%)"
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={form.payment_checkout_config.pixDiscount}
              onChange={(e) =>
                setForm({
                  ...form,
                  payment_checkout_config: {
                    ...form.payment_checkout_config,
                    pixDiscount: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)),
                  },
                })
              }
            />
          </div>
        </Card>

        <Card title="Formas de pagamento">
          <p className="text-sm leading-relaxed text-text-secondary">
            A loja usa uma <strong>imagem única</strong> com todas as bandeiras e métodos aceitos.
            Ela aparece no rodapé, na página de produto, no checkout e no modal de parcelamento.
          </p>
          <p className="mt-3 text-sm text-text-secondary">
            Para alterar, edite o arquivo{' '}
            <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">
              src/lib/payment/payment-methods-image.ts
            </code>{' '}
            e coloque a imagem em <code className="text-xs">public/</code>.
          </p>
        </Card>

        <Button type="submit" loading={loading}>
          Salvar configurações
        </Button>
      </form>
    </div>
  )
}
