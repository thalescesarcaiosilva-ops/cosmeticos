import type { SupabaseClient } from '@supabase/supabase-js'
import { SITE_SETTINGS_ID } from '@/lib/layout/queries'
import type { FooterAssetRow } from '@/types/database-layout'

export const FOOTER_SETTINGS_COLUMNS = [
  'cnpj',
  'company_legal_name',
  'footer_phone_label',
  'business_hours',
  'contact_whatsapp_label',
  'contact_whatsapp_href',
  'contact_page_label',
  'contact_page_href',
  'contact_email',
  'contact_address',
  'contact_address_label',
  'footer_social_heading',
  'footer_security_heading',
  'footer_payment_text',
  'footer_security_text',
  'footer_disclaimers',
  'store_name',
  'phone_area_code',
  'phone_number',
  'phone_href',
  'installment_interest_free',
].join(', ')

export type FooterSettings = {
  cnpj: string | null
  company_legal_name: string | null
  footer_phone_label: string
  business_hours: string | null
  contact_whatsapp_label: string
  contact_whatsapp_href: string | null
  contact_page_label: string
  contact_page_href: string
  contact_email: string | null
  contact_address: string | null
  contact_address_label: string
  footer_social_heading: string
  footer_security_heading: string
  footer_payment_text: string
  footer_security_text: string | null
  footer_disclaimers: string[]
  store_name: string
  phone_area_code: string
  phone_number: string
  phone_href: string
  installment_interest_free: number
  _footerColumnsAvailable?: boolean
}

const DEFAULTS: Omit<FooterSettings, '_footerColumnsAvailable'> = {
  cnpj: null,
  company_legal_name: null,
  footer_phone_label: 'Ligue para nós',
  business_hours: null,
  contact_whatsapp_label: 'WhatsApp',
  contact_whatsapp_href: null,
  contact_page_label: 'Fale Conosco',
  contact_page_href: '',
  contact_email: null,
  contact_address: null,
  contact_address_label: 'Endereço',
  footer_social_heading: 'Siga a gente:',
  footer_security_heading: 'Loja Segura',
  footer_payment_text: '',
  footer_security_text: null,
  footer_disclaimers: [],
  store_name: '',
  phone_area_code: '',
  phone_number: '',
  phone_href: '',
  installment_interest_free: 5,
}

function mapFooterSettings(row: Record<string, unknown>): FooterSettings {
  const disclaimers = row.footer_disclaimers
  return {
    cnpj: (row.cnpj as string | null) ?? null,
    company_legal_name: (row.company_legal_name as string | null) ?? null,
    footer_phone_label: (row.footer_phone_label as string) ?? DEFAULTS.footer_phone_label,
    business_hours: (row.business_hours as string | null) ?? DEFAULTS.business_hours,
    contact_whatsapp_label:
      (row.contact_whatsapp_label as string) ?? DEFAULTS.contact_whatsapp_label,
    contact_whatsapp_href: (row.contact_whatsapp_href as string | null) ?? null,
    contact_page_label: (row.contact_page_label as string) ?? DEFAULTS.contact_page_label,
    contact_page_href: (row.contact_page_href as string) ?? DEFAULTS.contact_page_href,
    contact_email: (row.contact_email as string | null) ?? null,
    contact_address: (row.contact_address as string | null) ?? null,
    contact_address_label:
      (row.contact_address_label as string) ?? DEFAULTS.contact_address_label,
    footer_social_heading:
      (row.footer_social_heading as string) ?? DEFAULTS.footer_social_heading,
    footer_security_heading:
      (row.footer_security_heading as string) ?? DEFAULTS.footer_security_heading,
    footer_payment_text:
      (row.footer_payment_text as string) ?? DEFAULTS.footer_payment_text,
    footer_security_text: (row.footer_security_text as string | null) ?? null,
    footer_disclaimers: Array.isArray(disclaimers)
      ? (disclaimers as string[])
      : DEFAULTS.footer_disclaimers,
    store_name: (row.store_name as string) ?? DEFAULTS.store_name,
    phone_area_code: (row.phone_area_code as string) ?? DEFAULTS.phone_area_code,
    phone_number: (row.phone_number as string) ?? DEFAULTS.phone_number,
    phone_href: (row.phone_href as string) ?? DEFAULTS.phone_href,
    installment_interest_free: Number(row.installment_interest_free ?? 5),
    _footerColumnsAvailable: Boolean(row._footerColumnsAvailable),
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

export async function fetchAdminFooterSettings(
  supabase: SupabaseClient
): Promise<{ data: FooterSettings | null; footerColumnsAvailable: boolean }> {
  const full = await supabase
    .from('site_settings')
    .select(FOOTER_SETTINGS_COLUMNS)
    .eq('id', SITE_SETTINGS_ID)
    .single()

  if (!full.error && full.data) {
    return {
      data: mapFooterSettings({
        ...(full.data as unknown as Record<string, unknown>),
        _footerColumnsAvailable: true,
      }),
      footerColumnsAvailable: true,
    }
  }

  if (!isMissingColumnError(full.error)) {
    return { data: null, footerColumnsAvailable: false }
  }

  const base = await supabase
    .from('site_settings')
    .select('store_name, phone_area_code, phone_number, phone_href')
    .eq('id', SITE_SETTINGS_ID)
    .single()

  if (base.error || !base.data) {
    return { data: null, footerColumnsAvailable: false }
  }

  return {
    data: mapFooterSettings({
      ...(base.data as unknown as Record<string, unknown>),
      _footerColumnsAvailable: false,
    }),
    footerColumnsAvailable: false,
  }
}

export async function updateAdminFooterSettings(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
): Promise<{ data: FooterSettings | null; footerColumnsAvailable: boolean }> {
  const { error } = await supabase
    .from('site_settings')
    .update(payload)
    .eq('id', SITE_SETTINGS_ID)

  if (error && isMissingColumnError(error)) {
    return { data: null, footerColumnsAvailable: false }
  }

  if (error) {
    return { data: null, footerColumnsAvailable: false }
  }

  return fetchAdminFooterSettings(supabase)
}

export async function fetchAdminFooterAssets(
  supabase: SupabaseClient
): Promise<FooterAssetRow[]> {
  const { data, error } = await supabase
    .from('footer_assets')
    .select('id, asset_type, image_url, alt_text, href, sort_order, active, created_at')
    .order('asset_type')
    .order('sort_order')

  if (error) return []
  return (data ?? []) as FooterAssetRow[]
}
