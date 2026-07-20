import { createPublicClient, isSupabasePublicConfigured } from '@/lib/supabase/public'
import { createAdminClient } from '@/lib/supabase/admin'
import { SITE_SETTINGS_ID } from '@/lib/layout/queries'
import {
  normalizeBuyTogetherSettings,
  type BuyTogetherSettingsInput,
} from '@/schemas/buy-together-settings-schema'
import { DEFAULT_BUY_TOGETHER_SETTINGS } from '@/types/buy-together-settings'

export async function getBuyTogetherSettings(): Promise<BuyTogetherSettingsInput> {
  if (!isSupabasePublicConfigured()) return DEFAULT_BUY_TOGETHER_SETTINGS

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('site_settings')
    .select('buy_together_settings')
    .eq('id', SITE_SETTINGS_ID)
    .maybeSingle()

  if (error || !data) return DEFAULT_BUY_TOGETHER_SETTINGS
  return normalizeBuyTogetherSettings(
    (data as { buy_together_settings?: unknown }).buy_together_settings
  )
}

export async function getAdminBuyTogetherSettings(): Promise<{
  settings: BuyTogetherSettingsInput
  columnAvailable: boolean
}> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('site_settings')
    .select('buy_together_settings')
    .eq('id', SITE_SETTINGS_ID)
    .maybeSingle()

  if (error) {
    const message = error.message ?? ''
    if (message.includes('buy_together_settings') || (error as { code?: string }).code === '42703') {
      return { settings: DEFAULT_BUY_TOGETHER_SETTINGS, columnAvailable: false }
    }
    return { settings: DEFAULT_BUY_TOGETHER_SETTINGS, columnAvailable: false }
  }

  return {
    settings: normalizeBuyTogetherSettings(
      (data as { buy_together_settings?: unknown } | null)?.buy_together_settings
    ),
    columnAvailable: true,
  }
}

export async function updateBuyTogetherSettings(
  settings: BuyTogetherSettingsInput
): Promise<{ settings: BuyTogetherSettingsInput | null; columnAvailable: boolean }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('site_settings')
    .update({ buy_together_settings: settings })
    .eq('id', SITE_SETTINGS_ID)
    .select('buy_together_settings')
    .maybeSingle()

  if (error) {
    return { settings: null, columnAvailable: false }
  }

  return {
    settings: normalizeBuyTogetherSettings(
      (data as { buy_together_settings?: unknown } | null)?.buy_together_settings
    ),
    columnAvailable: true,
  }
}
