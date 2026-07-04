import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { HomeBanner, HomeBannerPublic } from '@/types/home-banner'
import type { BannerDeviceTarget } from '@/schemas/banner-schema'

const BANNER_COLUMNS =
  'id, title, alt_text, link_href, image_url, storage_path, width, height, file_size, sort_order, active, device_target, created_at'

const BANNER_COLUMNS_LEGACY =
  'id, title, alt_text, link_href, image_url, storage_path, width, height, file_size, sort_order, active, created_at'

const BANNER_PUBLIC_COLUMNS =
  'id, title, alt_text, link_href, image_url, width, height, device_target'

const BANNER_PUBLIC_COLUMNS_LEGACY =
  'id, title, alt_text, link_href, image_url, width, height'

function mapPublicBanner(row: Record<string, unknown>): HomeBannerPublic {
  return {
    id: row.id as string,
    title: row.title as string,
    alt_text: (row.alt_text as string | null) ?? null,
    link_href: (row.link_href as string | null) ?? null,
    image_url: row.image_url as string,
    width: (row.width as number | null) ?? null,
    height: (row.height as number | null) ?? null,
    device_target: (row.device_target as BannerDeviceTarget | undefined) ?? 'both',
  }
}

export async function getHomeBannersPublic(): Promise<HomeBannerPublic[]> {
  const supabase = await createClient()
  const full = await supabase
    .from('home_banners')
    .select(BANNER_PUBLIC_COLUMNS)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (!full.error && full.data) {
    return full.data.map((row) => mapPublicBanner(row as Record<string, unknown>))
  }

  const legacy = await supabase
    .from('home_banners')
    .select(BANNER_PUBLIC_COLUMNS_LEGACY)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (legacy.error || !legacy.data) return []
  return legacy.data.map((row) => mapPublicBanner(row as Record<string, unknown>))
}

export function splitBannersByDevice(banners: HomeBannerPublic[]) {
  return {
    desktop: banners.filter(
      (banner) => banner.device_target === 'both' || banner.device_target === 'desktop'
    ),
    mobile: banners.filter(
      (banner) => banner.device_target === 'both' || banner.device_target === 'mobile'
    ),
  }
}

export async function getAdminHomeBanners(
  supabase?: SupabaseClient
): Promise<HomeBanner[]> {
  const client = supabase ?? (await createClient())
  const full = await client
    .from('home_banners')
    .select(BANNER_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (!full.error && full.data) {
    return full.data.map((row) => ({
      ...(row as HomeBanner),
      device_target: (row.device_target as BannerDeviceTarget | undefined) ?? 'both',
    }))
  }

  const legacy = await client
    .from('home_banners')
    .select(BANNER_COLUMNS_LEGACY)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (legacy.error || !legacy.data) return []
  return legacy.data.map((row) => ({
    ...(row as Omit<HomeBanner, 'device_target'>),
    device_target: 'both' as const,
  }))
}

export { BANNER_COLUMNS }
