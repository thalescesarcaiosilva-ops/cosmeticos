import { getSiteSettings } from '@/lib/layout/queries'
import { toAbsoluteSiteMediaUrl } from '@/lib/media/public-url'
import { createPublicClient, isSupabasePublicConfigured } from '@/lib/supabase/public'

export type SeoSettings = {
  siteName: string
  defaultTitle: string
  titleTemplate: string
  description: string
  ogImageUrl: string | null
  faviconUrl: string | null
}

const FALLBACK: SeoSettings = {
  siteName: 'Loja de Cosméticos',
  defaultTitle: 'Loja de Cosméticos',
  titleTemplate: '%s | Loja de Cosméticos',
  description: 'Ecommerce de cosméticos',
  ogImageUrl: null,
  faviconUrl: null,
}

export async function getSeoSettings(): Promise<SeoSettings> {
  if (!isSupabasePublicConfigured()) {
    return FALLBACK
  }

  const supabase = createPublicClient()
  const settings = await getSiteSettings(supabase)

  const siteName = settings.store_name || FALLBACK.siteName
  const defaultTitle = settings.seo_title?.trim() || siteName
  const titleTemplate =
    settings.seo_title_template?.trim() || `%s | ${siteName}`
  const description =
    settings.seo_description?.trim() ||
    `Compre cosméticos e produtos de beleza na ${siteName}.`
  const ogImageUrl =
    toAbsoluteSiteMediaUrl(
      settings.seo_og_image_url?.trim() || settings.logo_image_url?.trim() || null
    ) ?? null
  const faviconUrl = toAbsoluteSiteMediaUrl(settings.favicon_url?.trim() || null) ?? null

  return {
    siteName,
    defaultTitle,
    titleTemplate,
    description,
    ogImageUrl,
    faviconUrl,
  }
}
