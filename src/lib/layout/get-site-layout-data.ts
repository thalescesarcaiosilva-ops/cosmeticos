import { mapToSiteLayoutData } from '@/lib/layout/mappers'
import {
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
  }
}

/**
 * Fonte única de dados do layout (top bar, header, menu).
 * Lê via Supabase anon + RLS (somente SELECT público).
 * Revalidação controlada em `src/app/layout.tsx` (revalidate = 60).
 */
export async function getSiteLayoutData(): Promise<SiteLayoutData> {
  if (!isSupabasePublicConfigured()) {
    return emptySiteLayoutData()
  }

  const supabase = createPublicClient()

  const [settings, policyLinks, socialLinks, menuItems] = await Promise.all([
    getSiteSettings(supabase),
    getPolicyLinks(supabase),
    getSocialLinks(supabase),
    getMenuItems(supabase),
  ])

  return mapToSiteLayoutData({
    settings,
    policyLinks,
    socialLinks,
    menuItems,
  })
}
