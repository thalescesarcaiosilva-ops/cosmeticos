import type { SupabaseClient } from '@supabase/supabase-js'
import { cache } from 'react'
import { toSiteMediaUrl } from '@/lib/media/public-url'
import { SITE_SETTINGS_ID } from '@/lib/layout/queries'
import { createPublicClient, isSupabasePublicConfigured } from '@/lib/supabase/public'
import type { StoreOpeningHoursSlot } from '@/schemas/store-profile-schema'
import type { TrackingTag } from '@/types/tracking-tags'
import { TRACKING_PLACEMENTS } from '@/types/tracking-tags'

function trimStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim()
}

function trimNullable(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

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
  tracking_tags: TrackingTag[]
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
  'tracking_tags',
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

function parseTrackingTags(raw: unknown): TrackingTag[] {
  if (!Array.isArray(raw)) return []
  const tags: TrackingTag[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id.trim() : ''
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    const html = typeof row.html === 'string' ? row.html : ''
    const placement = TRACKING_PLACEMENTS.find((value) => value === row.placement)
    if (!id || !name || !placement) continue
    tags.push({
      id,
      name,
      placement,
      enabled: row.enabled !== false,
      html,
    })
  }

  return tags
}

function mapRow(row: Record<string, unknown>, columnsAvailable: boolean): StoreProfile {
  return {
    store_name: trimStr(row.store_name),
    company_legal_name: trimNullable(row.company_legal_name),
    cnpj: trimNullable(row.cnpj),
    logo_image_url:
      typeof row.logo_image_url === 'string'
        ? toSiteMediaUrl(row.logo_image_url)
        : null,
    store_description: trimNullable(row.store_description),
    contact_email: trimNullable(row.contact_email),
    phone_area_code: trimStr(row.phone_area_code),
    phone_number: trimStr(row.phone_number),
    phone_href: trimStr(row.phone_href),
    store_street: trimNullable(row.store_street),
    store_street_number: trimNullable(row.store_street_number),
    store_complement: trimNullable(row.store_complement),
    store_neighborhood: trimNullable(row.store_neighborhood),
    store_city: trimNullable(row.store_city),
    store_state: trimNullable(row.store_state),
    store_postal_code: trimNullable(row.store_postal_code),
    store_country: trimNullable(row.store_country) ?? 'BR',
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
    return_policy_page_slug: trimNullable(row.return_policy_page_slug),
    return_policy_notes: trimNullable(row.return_policy_notes),
    seo_handling_days_min: Number(row.seo_handling_days_min ?? 1),
    seo_handling_days_max: Number(row.seo_handling_days_max ?? 2),
    head_scripts: typeof row.head_scripts === 'string' ? row.head_scripts : null,
    tracking_tags: parseTrackingTags(row.tracking_tags),
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

/** Uma leitura por request React — evita 3–4 hits a site_settings no layout. */
export const getCachedStoreProfile = cache(async (): Promise<StoreProfile | null> => {
  if (!isSupabasePublicConfigured()) return null
  return getStoreProfile(createPublicClient())
})

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
