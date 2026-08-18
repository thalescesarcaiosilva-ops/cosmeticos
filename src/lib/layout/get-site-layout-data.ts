import { cache } from 'react'
import { cacheStorefrontQuery, SITE_LAYOUT_CACHE_TAG } from '@/lib/cache/storefront'
import { mapToSiteLayoutData } from '@/lib/layout/mappers'
import {
  getFreeShippingAbove,
  getMenuItems,
  getPolicyLinks,
  getSiteSettings,
  getSocialLinks,
} from '@/lib/layout/queries'
import { createPublicClient, isSupabasePublicConfigured } from '@/lib/supabase/public'
import type { SiteLayoutData } from '@/types/layout'

function emptySiteLayoutData(): SiteLayoutData {
  return {
    storeName: '',
    logo: { imageUrl: null },
    policyLinks: [],
    socialLinks: [],
    phone: { areaCode: '', number: '', display: '', href: '' },
    helpLink: { label: '', href: '' },
    contactPage: { label: 'Fale Conosco', href: '/paginas/fale-conosco' },
    menuCategories: [],
    freeShippingAbove: null,
  }
}

/**
 * Layout da vitrine em cache (60s) — HTML completo no SSR para o bot.
 */
const loadSiteLayoutData = cacheStorefrontQuery(
  async (): Promise<SiteLayoutData> => {
    if (!isSupabasePublicConfigured()) {
      return emptySiteLayoutData()
    }

    const supabase = createPublicClient()

    const [settings, policyLinks, socialLinks, menuItems, freeShippingAbove] =
      await Promise.all([
        getSiteSettings(supabase),
        getPolicyLinks(supabase),
        getSocialLinks(supabase),
        getMenuItems(supabase),
        getFreeShippingAbove(supabase),
      ])

    return mapToSiteLayoutData({
      settings,
      policyLinks,
      socialLinks,
      menuItems,
      freeShippingAbove,
    })
  },
  'site-layout-data',
  [SITE_LAYOUT_CACHE_TAG]
)

export const getSiteLayoutData = cache(async (): Promise<SiteLayoutData> => {
  return loadSiteLayoutData()
})
