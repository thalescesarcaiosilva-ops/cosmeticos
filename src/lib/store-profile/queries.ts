import type { SupabaseClient } from '@supabase/supabase-js'
import { SITE_SETTINGS_ID } from '@/lib/layout/queries'
import type { StoreOpeningHoursSlot } from '@/schemas/store-profile-schema'

export type StoreProfile = {
  store_name: string
  company_legal_name: string | null
  cnpj: string | null
  logo_image_url: string | null
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
}

export const STORE_PROFILE_COLUMNS = [
  'store_name',
  'company_legal_name',
  'cnpj',
  'logo_image_url',
  'store_description',
  'contact_email',
  'phone_area_code',
  'phone_number',
  'phone_href',
  'store_street',
  'store_street_number',
  'store_complement',
  'store_neighborhood',
  'store_city',
  'store_state',
  'store_postal_code',
  'store_country',
  'store_opening_hours',
  'return_enabled',
  'return_days',
  'return_method',
  'return_fees',
  'return_policy_page_slug',
  'return_policy_notes',
  'seo_handling_days_min',
  'seo_handling_days_max',
  'head_scripts',
].join(', ')

const LEGACY_COLUMNS = [
  'store_name',
  'company_legal_name',
  'cnpj',
  'logo_image_url',
  'contact_email',
  'phone_area_code',
  'phone_number',
  'phone_href',
].join(', ')

function parseOpeningHours(raw: unknown): StoreOpeningHoursSlot[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (slot): slot is StoreOpeningHoursSlot =>
      typeof slot === 'object' &&
      slot !== null &&
      'opens' in slot &&
      'closes' in slot &&
      'dayOfWeek' in slot
  )
}

function mapRow(row: Record<string, unknown>, columnsAvailable: boolean): StoreProfile {
  return {
    store_name: String(row.store_name ?? ''),
    company_legal_name:
      typeof row.company_legal_name === 'string' ? row.company_legal_name : null,
    cnpj: typeof row.cnpj === 'string' ? row.cnpj : null,
    logo_image_url: typeof row.logo_image_url === 'string' ? row.logo_image_url : null,
    store_description:
      typeof row.store_description === 'string' ? row.store_description : null,
    contact_email: typeof row.contact_email === 'string' ? row.contact_email : null,
    phone_area_code: String(row.phone_area_code ?? ''),
    phone_number: String(row.phone_number ?? ''),
    phone_href: String(row.phone_href ?? ''),
    store_street: typeof row.store_street === 'string' ? row.store_street : null,
    store_street_number:
      typeof row.store_street_number === 'string' ? row.store_street_number : null,
    store_complement: typeof row.store_complement === 'string' ? row.store_complement : null,
    store_neighborhood:
      typeof row.store_neighborhood === 'string' ? row.store_neighborhood : null,
    store_city: typeof row.store_city === 'string' ? row.store_city : null,
    store_state: typeof row.store_state === 'string' ? row.store_state : null,
    store_postal_code:
      typeof row.store_postal_code === 'string' ? row.store_postal_code : null,
    store_country: typeof row.store_country === 'string' ? row.store_country : 'BR',
    store_opening_hours: parseOpeningHours(row.store_opening_hours),
    return_enabled: row.return_enabled === true,
    return_days:
      typeof row.return_days === 'number'
        ? row.return_days
        : row.return_days != null
          ? Number(row.return_days)
          : null,
    return_method:
      row.return_method === 'ReturnInStore' ? 'ReturnInStore' : 'ReturnByMail',
    return_fees:
      row.return_fees === 'ReturnShippingFees'
        ? 'ReturnShippingFees'
        : row.return_fees === 'RestockingFees'
          ? 'RestockingFees'
          : 'FreeReturn',
    return_policy_page_slug:
      typeof row.return_policy_page_slug === 'string'
        ? row.return_policy_page_slug
        : null,
    return_policy_notes:
      typeof row.return_policy_notes === 'string' ? row.return_policy_notes : null,
    seo_handling_days_min: Number(row.seo_handling_days_min ?? 1),
    seo_handling_days_max: Number(row.seo_handling_days_max ?? 2),
    head_scripts: typeof row.head_scripts === 'string' ? row.head_scripts : null,
    _storeProfileColumnsAvailable: columnsAvailable,
  }
}

export async function getStoreProfile(
  supabase: SupabaseClient
): Promise<StoreProfile | null> {
  const full = await supabase
    .from('site_settings')
    .select(STORE_PROFILE_COLUMNS)
    .eq('id', SITE_SETTINGS_ID)
    .maybeSingle()

  if (!full.error && full.data) {
    return mapRow(full.data as unknown as Record<string, unknown>, true)
  }

  const legacy = await supabase
    .from('site_settings')
    .select(LEGACY_COLUMNS)
    .eq('id', SITE_SETTINGS_ID)
    .maybeSingle()

  if (legacy.error || !legacy.data) return null

  return mapRow(legacy.data as unknown as Record<string, unknown>, false)
}

export async function updateStoreProfile(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
): Promise<{ data: StoreProfile | null; migrationNeeded: boolean }> {
  const full = await supabase
    .from('site_settings')
    .update(payload)
    .eq('id', SITE_SETTINGS_ID)
    .select(STORE_PROFILE_COLUMNS)
    .maybeSingle()

  if (!full.error && full.data) {
    return {
      data: mapRow(full.data as unknown as Record<string, unknown>, true),
      migrationNeeded: false,
    }
  }

  const legacyKeys = Object.keys(payload).filter((k) =>
    LEGACY_COLUMNS.split(', ').includes(k.trim())
  )
  if (legacyKeys.length === 0) {
    return { data: null, migrationNeeded: true }
  }

  const legacyPayload: Record<string, unknown> = {}
  for (const key of legacyKeys) legacyPayload[key] = payload[key]

  const legacy = await supabase
    .from('site_settings')
    .update(legacyPayload)
    .eq('id', SITE_SETTINGS_ID)
    .select(LEGACY_COLUMNS)
    .maybeSingle()

  if (legacy.error || !legacy.data) {
    return { data: null, migrationNeeded: true }
  }

  return {
    data: mapRow(legacy.data as unknown as Record<string, unknown>, false),
    migrationNeeded: legacyKeys.length < Object.keys(payload).length,
  }
}
