import { createClient } from '@/lib/supabase/server'
import { createPublicClient, isSupabasePublicConfigured } from '@/lib/supabase/public'
import { getStoreProfile, type StoreProfile } from '@/lib/store-profile/queries'

const EMPTY: StoreProfile = {
  store_name: '',
  company_legal_name: null,
  cnpj: null,
  logo_image_url: null,
  store_description: null,
  contact_email: null,
  phone_area_code: '',
  phone_number: '',
  phone_href: '',
  store_street: null,
  store_street_number: null,
  store_complement: null,
  store_neighborhood: null,
  store_city: null,
  store_state: null,
  store_postal_code: null,
  store_country: 'BR',
  store_opening_hours: [],
  return_enabled: false,
  return_days: null,
  return_method: 'ReturnByMail',
  return_fees: 'FreeReturn',
  return_policy_page_slug: null,
  return_policy_notes: null,
  seo_handling_days_min: 1,
  seo_handling_days_max: 2,
  google_analytics_id: null,
  google_tag_manager_id: null,
  microsoft_clarity_id: null,
}

export async function getPublicStoreProfile(): Promise<StoreProfile> {
  if (!isSupabasePublicConfigured()) return EMPTY

  const supabase = createPublicClient()
  const profile = await getStoreProfile(supabase)
  return profile ?? EMPTY
}

export async function getServerStoreProfile(): Promise<StoreProfile> {
  const supabase = await createClient()
  const profile = await getStoreProfile(supabase)
  return profile ?? EMPTY
}
