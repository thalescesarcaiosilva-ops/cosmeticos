import { cache } from 'react'
import { createPublicClient, isSupabasePublicConfigured } from '@/lib/supabase/public'
import { getCachedStoreProfile } from '@/lib/store-profile/queries'
import { absoluteUrl } from '@/lib/seo/site-url'

export type MerchantSeoContext = {
  country: 'BR'
  returnPolicyUrl: string | null
  returnDays: number | null
  returnMethod: 'ReturnByMail' | 'ReturnInStore'
  returnFees: 'FreeReturn' | 'ReturnShippingFees' | 'RestockingFees'
  handlingDaysMin: number
  handlingDaysMax: number
  transitDaysMin: number
  transitDaysMax: number
  defaultShippingRate: number | null
}

const DEFAULT_CONTEXT: MerchantSeoContext = {
  country: 'BR',
  returnPolicyUrl: null,
  returnDays: null,
  returnMethod: 'ReturnByMail',
  returnFees: 'FreeReturn',
  handlingDaysMin: 1,
  handlingDaysMax: 2,
  transitDaysMin: 5,
  transitDaysMax: 10,
  defaultShippingRate: 24.9,
}

async function loadMerchantSeoContext(): Promise<MerchantSeoContext> {
  if (!isSupabasePublicConfigured()) {
    return DEFAULT_CONTEXT
  }

  const supabase = createPublicClient()

  const [profile, shippingResult] = await Promise.all([
    getCachedStoreProfile(),
    supabase
      .from('shipping_methods')
      .select('base_price, estimated_days_min, estimated_days_max')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
  ])

  let returnPolicyUrl: string | null = null
  let returnDays: number | null = null
  let returnMethod: MerchantSeoContext['returnMethod'] = 'ReturnByMail'
  let returnFees: MerchantSeoContext['returnFees'] = 'FreeReturn'
  let handlingDaysMin = DEFAULT_CONTEXT.handlingDaysMin
  let handlingDaysMax = DEFAULT_CONTEXT.handlingDaysMax

  if (profile) {
    handlingDaysMin = profile.seo_handling_days_min
    handlingDaysMax = profile.seo_handling_days_max

    if (profile.return_enabled && profile.return_days != null && profile.return_days > 0) {
      returnDays = profile.return_days
      returnMethod = profile.return_method
      returnFees = profile.return_fees
      if (profile.return_policy_page_slug) {
        returnPolicyUrl = absoluteUrl(`/paginas/${profile.return_policy_page_slug}`)
      }
    }
  }

  const methods = (shippingResult.data ?? []) as Array<{
    base_price: number
    estimated_days_min: number | null
    estimated_days_max: number | null
  }>

  let transitDaysMin = DEFAULT_CONTEXT.transitDaysMin
  let transitDaysMax = DEFAULT_CONTEXT.transitDaysMax
  let defaultShippingRate: number | null = null

  if (methods.length > 0) {
    const mins = methods
      .map((m) => m.estimated_days_min)
      .filter((v): v is number => v != null)
    const maxs = methods
      .map((m) => m.estimated_days_max)
      .filter((v): v is number => v != null)

    if (mins.length > 0) transitDaysMin = Math.min(...mins)
    if (maxs.length > 0) transitDaysMax = Math.max(...maxs)

    defaultShippingRate = Math.min(...methods.map((m) => Number(m.base_price)))
  }

  return {
    country: 'BR',
    returnPolicyUrl,
    returnDays,
    returnMethod,
    returnFees,
    handlingDaysMin,
    handlingDaysMax,
    transitDaysMin,
    transitDaysMax,
    defaultShippingRate,
  }
}

export const getMerchantSeoContext = cache(loadMerchantSeoContext)
