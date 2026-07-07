import type { SupabaseClient } from '@supabase/supabase-js'
import { SITE_SETTINGS_ID } from '@/lib/layout/queries'
import { DEFAULT_PAYMENT_SETTINGS, type PaymentMethod } from '@/types/payment'
import { parseInstallmentInterestRates, serializeInstallmentInterestRates } from '@/lib/payment/installment-rates'
import { parseCheckoutPaymentConfig } from '@/lib/payment/queries'
import { parsePaymentMethods } from '@/lib/payment/parse-payment-methods'

export const BASE_SITE_SETTINGS_COLUMNS = [
  'id',
  'store_name',
  'phone_area_code',
  'phone_number',
  'phone_href',
  'help_label',
  'help_href',
  'updated_at',
].join(', ')

export const LOGO_SITE_SETTINGS_COLUMNS = 'logo_image_url'

export const SEO_SITE_SETTINGS_COLUMNS = [
  'seo_title',
  'seo_title_template',
  'seo_description',
  'seo_og_image_url',
  'favicon_url',
].join(', ')

export const INSTALLMENT_SITE_SETTINGS_COLUMNS = [
  'installment_max',
  'installment_interest_free',
  'installment_min_value',
  'installment_interest_rate',
  'installment_interest_rates',
  'installment_text_free',
  'installment_text_interest',
].join(', ')

export const CONTACT_PAGE_SETTINGS_COLUMNS = [
  'contact_page_title',
  'contact_page_intro',
  'contact_page_support_topics',
].join(', ')

export const PAYMENT_METHODS_ONLY_COLUMNS = [
  'payment_methods_config',
  'payment_methods',
  'payment_method_images',
].join(', ')

export const PAYMENT_SITE_SETTINGS_COLUMNS = `${INSTALLMENT_SITE_SETTINGS_COLUMNS}, ${PAYMENT_METHODS_ONLY_COLUMNS}`

export const FULL_SITE_SETTINGS_COLUMNS = `${BASE_SITE_SETTINGS_COLUMNS}, ${PAYMENT_SITE_SETTINGS_COLUMNS}`

const PAYMENT_KEYS = [
  'installment_max',
  'installment_interest_free',
  'installment_min_value',
  'installment_interest_rate',
  'installment_text_free',
  'installment_text_interest',
  'payment_methods_config',
  'payment_methods',
  'payment_method_images',
  'payment_checkout_config',
] as const

function enrichPaymentPayload(payment: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(payment.payment_methods_config)) {
    return payment
  }

  const methods = payment.payment_methods_config as Array<{
    id?: string
    label?: string
    imageUrl?: string | null
  }>

  const paymentMethods = methods
    .filter((method) => typeof method.id === 'string' && method.id.trim())
    .map((method) => method.id!.trim())

  const paymentMethodImages = Object.fromEntries(
    methods
      .filter(
        (method) =>
          typeof method.id === 'string' &&
          method.id.trim() &&
          typeof method.imageUrl === 'string' &&
          method.imageUrl.trim()
      )
      .map((method) => [method.id!.trim(), method.imageUrl!.trim()])
  )

  return {
    ...payment,
    payment_methods_config: methods
      .filter((method) => method.id?.trim() && method.label?.trim())
      .map((method) => ({
        id: method.id!.trim(),
        label: method.label!.trim(),
        imageUrl:
          typeof method.imageUrl === 'string' && method.imageUrl.trim()
            ? method.imageUrl.trim()
            : null,
      })),
    payment_methods: paymentMethods,
    payment_method_images: paymentMethodImages,
  }
}

function pickPaymentPayload(
  enriched: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const key of keys) {
    if (key in enriched) payload[key] = enriched[key]
  }
  return payload
}

const INSTALLMENT_KEYS = [
  'installment_max',
  'installment_interest_free',
  'installment_min_value',
  'installment_interest_rate',
  'installment_interest_rates',
  'installment_text_free',
  'installment_text_interest',
] as const

const CONTACT_PAGE_KEYS = [
  'contact_page_title',
  'contact_page_intro',
  'contact_page_support_topics',
] as const

const PAYMENT_METHOD_KEYS = [
  'payment_methods_config',
  'payment_methods',
  'payment_method_images',
  'payment_checkout_config',
] as const

async function updatePaymentFields(
  supabase: SupabaseClient,
  payment: Record<string, unknown>
): Promise<{
  paymentSaveSkipped: boolean
  paymentConfigSkipped: boolean
  paymentUpdateError: string | null
}> {
  const enriched = enrichPaymentPayload(payment)
  let paymentSaveSkipped = false
  let paymentConfigSkipped = false

  const methodsPayload = pickPaymentPayload(enriched, PAYMENT_METHOD_KEYS)
  if (Object.keys(methodsPayload).length > 0) {
    const { error } = await supabase
      .from('site_settings')
      .update(methodsPayload)
      .eq('id', SITE_SETTINGS_ID)

    if (error && isMissingColumnError(error) && 'payment_methods_config' in methodsPayload) {
      paymentConfigSkipped = true
      const legacyPayload = pickPaymentPayload(enriched, ['payment_methods', 'payment_method_images'])
      if (Object.keys(legacyPayload).length > 0) {
        const retry = await supabase
          .from('site_settings')
          .update(legacyPayload)
          .eq('id', SITE_SETTINGS_ID)

        if (retry.error && !isMissingColumnError(retry.error)) {
          return {
            paymentSaveSkipped: true,
            paymentConfigSkipped: true,
            paymentUpdateError: retry.error.message ?? 'Erro ao salvar ícones de pagamento',
          }
        }
      }
    } else if (error && isMissingColumnError(error)) {
      paymentSaveSkipped = true
      paymentConfigSkipped = true
    } else if (error) {
      return {
        paymentSaveSkipped: true,
        paymentConfigSkipped: true,
        paymentUpdateError: error.message ?? 'Erro ao salvar formas de pagamento',
      }
    }
  }

  const installmentPayload = pickPaymentPayload(enriched, INSTALLMENT_KEYS)
  if (Object.keys(installmentPayload).length > 0) {
    const { error } = await supabase
      .from('site_settings')
      .update(installmentPayload)
      .eq('id', SITE_SETTINGS_ID)

    if (error && isMissingColumnError(error)) {
      paymentSaveSkipped = true
    } else if (error) {
      return {
        paymentSaveSkipped: true,
        paymentConfigSkipped,
        paymentUpdateError: error.message ?? 'Erro ao salvar parcelamento',
      }
    }
  }

  return { paymentSaveSkipped, paymentConfigSkipped, paymentUpdateError: null }
}

export type AdminSiteSettings = {
  id: string
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
  updated_at: string
  installment_max: number
  installment_interest_free: number
  installment_min_value: number
  installment_interest_rate: number
  installment_interest_rates: Record<number, number>
  installment_text_free: string
  installment_text_interest: string
  contact_page_title: string
  contact_page_intro: string | null
  contact_page_support_topics: Array<{ title: string; description: string }>
  payment_methods_config: PaymentMethod[]
  payment_checkout_config: {
    pixEnabled: boolean
    pixDiscount: number
    cardEnabled: boolean
  }
  _paymentColumnsAvailable?: boolean
  _seoColumnsAvailable?: boolean
}

function withPaymentDefaults(row: Record<string, unknown>): AdminSiteSettings {
  const storeName = row.store_name as string
  return {
    id: row.id as string,
    store_name: storeName,
    logo_image_url: (row.logo_image_url as string | null) ?? null,
    phone_area_code: row.phone_area_code as string,
    phone_number: row.phone_number as string,
    phone_href: row.phone_href as string,
    help_label: row.help_label as string,
    help_href: row.help_href as string,
    seo_title: (row.seo_title as string | null) ?? null,
    seo_title_template: (row.seo_title_template as string | null) ?? null,
    seo_description: (row.seo_description as string | null) ?? null,
    seo_og_image_url: (row.seo_og_image_url as string | null) ?? null,
    favicon_url: (row.favicon_url as string | null) ?? null,
    updated_at: row.updated_at as string,
    installment_max: Number(row.installment_max ?? DEFAULT_PAYMENT_SETTINGS.maxInstallments),
    installment_interest_free: Number(
      row.installment_interest_free ?? DEFAULT_PAYMENT_SETTINGS.interestFreeInstallments
    ),
    installment_min_value: Number(
      row.installment_min_value ?? DEFAULT_PAYMENT_SETTINGS.minInstallmentValue
    ),
    installment_interest_rate: Number(
      row.installment_interest_rate ?? DEFAULT_PAYMENT_SETTINGS.monthlyInterestRate
    ),
    installment_interest_rates: parseInstallmentInterestRates(row.installment_interest_rates),
    installment_text_free:
      (row.installment_text_free as string) ?? DEFAULT_PAYMENT_SETTINGS.installmentTextInterestFree,
    installment_text_interest:
      (row.installment_text_interest as string) ??
      DEFAULT_PAYMENT_SETTINGS.installmentTextWithInterest,
    payment_methods_config: parsePaymentMethods(row),
    payment_checkout_config: parseCheckoutPaymentConfig(row.payment_checkout_config),
    contact_page_title: (row.contact_page_title as string) ?? 'Central de Atendimento',
    contact_page_intro: (row.contact_page_intro as string | null) ?? null,
    contact_page_support_topics: Array.isArray(row.contact_page_support_topics)
      ? (row.contact_page_support_topics as Array<{ title: string; description: string }>)
      : [],
    _paymentColumnsAvailable: Boolean(row._paymentColumnsAvailable),
    _seoColumnsAvailable: Boolean(row._seoColumnsAvailable),
  }
}

function isMissingColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return (
    error.code === '42703' ||
    msg.includes('column') ||
    msg.includes('does not exist') ||
    msg.includes('could not find')
  )
}

async function fetchOptionalColumns(
  supabase: SupabaseClient,
  columns: string
): Promise<Record<string, unknown> | null> {
  const result = await supabase
    .from('site_settings')
    .select(columns)
    .eq('id', SITE_SETTINGS_ID)
    .single()

  if (result.error || !result.data) return null
  return result.data as unknown as Record<string, unknown>
}

export async function fetchAdminSiteSettings(
  supabase: SupabaseClient
): Promise<{ data: AdminSiteSettings | null; paymentColumnsAvailable: boolean }> {
  const baseColumns = `${BASE_SITE_SETTINGS_COLUMNS}, ${LOGO_SITE_SETTINGS_COLUMNS}`
  const baseRow = await fetchOptionalColumns(supabase, baseColumns)

  if (!baseRow) {
    const minimalRow = await fetchOptionalColumns(supabase, BASE_SITE_SETTINGS_COLUMNS)
    if (!minimalRow) return { data: null, paymentColumnsAvailable: false }

    return {
      data: withPaymentDefaults({
        ...minimalRow,
        _paymentColumnsAvailable: false,
        _seoColumnsAvailable: false,
      }),
      paymentColumnsAvailable: false,
    }
  }

  const row: Record<string, unknown> = { ...baseRow }
  let paymentColumnsAvailable = false
  let seoColumnsAvailable = false

  const seoRow = await fetchOptionalColumns(supabase, SEO_SITE_SETTINGS_COLUMNS)
  if (seoRow) {
    Object.assign(row, seoRow)
    seoColumnsAvailable = true
  }

  const installmentRow = await fetchOptionalColumns(supabase, INSTALLMENT_SITE_SETTINGS_COLUMNS)
  if (installmentRow) {
    Object.assign(row, installmentRow)
    paymentColumnsAvailable = true
  }

  const contactPageRow = await fetchOptionalColumns(supabase, CONTACT_PAGE_SETTINGS_COLUMNS)
  if (contactPageRow) {
    Object.assign(row, contactPageRow)
  }

  const paymentMethodsRow = await fetchOptionalColumns(supabase, PAYMENT_METHODS_ONLY_COLUMNS)
  if (paymentMethodsRow) {
    Object.assign(row, paymentMethodsRow)
    paymentColumnsAvailable = true
  }

  return {
    data: withPaymentDefaults({
      ...row,
      _paymentColumnsAvailable: paymentColumnsAvailable,
      _seoColumnsAvailable: seoColumnsAvailable,
    }),
    paymentColumnsAvailable,
  }
}

export function splitSettingsUpdate(payload: Record<string, unknown>) {
  const base: Record<string, unknown> = {}
  const payment: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(payload)) {
    if ((PAYMENT_KEYS as readonly string[]).includes(key)) {
      payment[key] = value
    } else if ((CONTACT_PAGE_KEYS as readonly string[]).includes(key)) {
      base[key] = value
    } else {
      base[key] = value
    }
  }

  return { base, payment }
}

export async function updateAdminSiteSettings(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
): Promise<{
  data: AdminSiteSettings | null
  paymentColumnsAvailable: boolean
  paymentSaveSkipped: boolean
  paymentConfigSkipped: boolean
  paymentUpdateError: string | null
}> {
  const { base, payment } = splitSettingsUpdate(payload)
  let paymentSaveSkipped = false
  let paymentConfigSkipped = false
  let paymentUpdateError: string | null = null

  if (Object.keys(base).length > 0) {
    const { error } = await supabase
      .from('site_settings')
      .update(base)
      .eq('id', SITE_SETTINGS_ID)

    if (error) {
      return {
        data: null,
        paymentColumnsAvailable: false,
        paymentSaveSkipped: false,
        paymentConfigSkipped: false,
        paymentUpdateError: error.message ?? 'Erro ao salvar configurações',
      }
    }
  }

  if (Object.keys(payment).length > 0) {
    const paymentResult = await updatePaymentFields(supabase, payment)
    paymentSaveSkipped = paymentResult.paymentSaveSkipped
    paymentConfigSkipped = paymentResult.paymentConfigSkipped
    paymentUpdateError = paymentResult.paymentUpdateError

    if (paymentUpdateError) {
      return {
        data: null,
        paymentColumnsAvailable: false,
        paymentSaveSkipped,
        paymentConfigSkipped,
        paymentUpdateError,
      }
    }
  }

  const result = await fetchAdminSiteSettings(supabase)
  return { ...result, paymentSaveSkipped, paymentConfigSkipped, paymentUpdateError: null }
}
