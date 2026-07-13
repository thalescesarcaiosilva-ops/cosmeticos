import { filterStorefrontSocialLinks } from '@/lib/layout/social-links'
import {
  getFooterAssets,
  getFooterMenus,
  getSiteSettings,
  getSocialLinks,
} from '@/lib/layout/queries'
import {
  formatOpeningHoursLong,
  formatPhoneDisplay,
  formatStoreAddressInline,
} from '@/lib/store-profile/format'
import { getStoreProfile } from '@/lib/store-profile/queries'
import { createPublicClient, isSupabasePublicConfigured } from '@/lib/supabase/public'
import type { FooterAssetRow, FooterMenuRow } from '@/types/database-layout'
import type { SocialLink } from '@/types/layout'
import { z } from 'zod'

const socialTypeSchema = z.enum(['whatsapp', 'facebook', 'instagram'])

export type FooterBrand = {
  logoUrl: string | null
  storeName: string
  description: string | null
}

export type FooterContact = {
  phoneDisplay: string | null
  phoneHref: string | null
  businessHours: string | null
  email: string | null
  address: string | null
}

export type FooterLegal = {
  storeName: string
  companyLegalName: string | null
  cnpj: string | null
  disclaimers: string[]
  securityText: string | null
}

export type FooterData = {
  brand: FooterBrand | null
  menus: FooterMenuRow[]
  securityAssets: FooterAssetRow[]
  socialLinks: SocialLink[]
  contact: FooterContact
  legal: FooterLegal
  socialHeading: string
  securityHeading: string
  paymentHeading: string
  paymentText: string | null
}

function mapSocial(row: {
  type: string
  href: string
  label: string
  display: string | null
}): SocialLink | null {
  const parsed = socialTypeSchema.safeParse(row.type)
  if (!parsed.success) return null
  return {
    type: parsed.data,
    href: row.href,
    label: row.label,
    ...(row.display ? { display: row.display } : {}),
  }
}

function buildBrand(
  storeProfile: Awaited<ReturnType<typeof getStoreProfile>>,
  settings: Awaited<ReturnType<typeof getSiteSettings>>
): FooterBrand | null {
  const logoUrl = storeProfile?.logo_image_url ?? settings.logo_image_url ?? null
  const storeName = storeProfile?.store_name ?? settings.store_name ?? ''
  const description = storeProfile?.store_description?.trim() || null

  if (!logoUrl && !description) return null

  return { logoUrl, storeName, description }
}

function emptyFooterData(): FooterData {
  return {
    brand: null,
    menus: [],
    securityAssets: [],
    socialLinks: [],
    contact: {
      phoneDisplay: null,
      phoneHref: null,
      businessHours: null,
      email: null,
      address: null,
    },
    legal: {
      storeName: '',
      companyLegalName: null,
      cnpj: null,
      disclaimers: [],
      securityText: null,
    },
    socialHeading: 'Redes Sociais',
    securityHeading: 'Segurança',
    paymentHeading: 'Formas de Pagamento',
    paymentText: null,
  }
}

export async function getFooterData(): Promise<FooterData> {
  if (!isSupabasePublicConfigured()) {
    return emptyFooterData()
  }

  const supabase = createPublicClient()

  const [settings, menus, assets, socialRows, storeProfile] = await Promise.all([
    getSiteSettings(supabase),
    getFooterMenus(supabase),
    getFooterAssets(supabase).catch(() => [] as FooterAssetRow[]),
    getSocialLinks(supabase),
    getStoreProfile(supabase),
  ])

  const socialLinks = filterStorefrontSocialLinks(
    socialRows.map(mapSocial).filter((s): s is SocialLink => s !== null)
  )

  const installmentFree = settings.installment_interest_free ?? 5

  const phoneDisplay = storeProfile
    ? formatPhoneDisplay(storeProfile.phone_area_code, storeProfile.phone_number)
    : formatPhoneDisplay(settings.phone_area_code ?? '', settings.phone_number ?? '')

  const phoneHref =
    storeProfile?.phone_href?.trim() || settings.phone_href?.trim() || null

  const configuredPaymentText = settings.footer_payment_text?.trim() || null
  const paymentText = configuredPaymentText
    ? configuredPaymentText.replace('{count}', String(installmentFree))
    : null

  const profileAddress = storeProfile ? formatStoreAddressInline(storeProfile) : null
  const profileHours = storeProfile
    ? formatOpeningHoursLong(storeProfile.store_opening_hours)
    : null

  const brand = buildBrand(storeProfile, settings)

  const contact: FooterContact = {
    phoneDisplay,
    phoneHref,
    businessHours: profileHours ?? settings.business_hours ?? null,
    email: storeProfile?.contact_email ?? settings.contact_email?.trim() ?? null,
    address: profileAddress ?? settings.contact_address?.trim() ?? null,
  }

  return {
    brand,
    menus,
    securityAssets: assets.filter((a) => a.asset_type === 'security'),
    socialLinks,
    contact,
    legal: {
      storeName: storeProfile?.store_name ?? settings.store_name,
      companyLegalName:
        storeProfile?.company_legal_name ?? settings.company_legal_name ?? null,
      cnpj: storeProfile?.cnpj ?? settings.cnpj ?? null,
      disclaimers: Array.isArray(settings.footer_disclaimers)
        ? settings.footer_disclaimers
        : [],
      securityText: settings.footer_security_text ?? null,
    },
    socialHeading: settings.footer_social_heading ?? 'Redes Sociais',
    securityHeading: settings.footer_security_heading ?? 'Segurança',
    paymentHeading: 'Formas de Pagamento',
    paymentText,
  }
}
