import { getFooterData } from '@/lib/layout/get-footer-data'
import { getSiteSettings, getSocialLinks } from '@/lib/layout/queries'
import {
  formatOpeningHoursLong,
  formatPhoneDisplay,
  formatStoreAddressInline,
} from '@/lib/store-profile/format'
import { getStoreProfile } from '@/lib/store-profile/queries'
import { createPublicClient, isSupabasePublicConfigured } from '@/lib/supabase/public'
import type { SocialLink } from '@/types/layout'
import { z } from 'zod'

const socialTypeSchema = z.enum(['whatsapp', 'facebook', 'instagram'])

export type ContactPageData = {
  storeName: string
  intro: string | null
  address: string | null
  phoneDisplay: string | null
  phoneHref: string | null
  whatsappHref: string | null
  whatsappLabel: string
  email: string | null
  businessHours: string | null
  socialLinks: SocialLink[]
}

const DEFAULT_INTRO =
  'Estamos aqui para ajudar! Se você tem alguma dúvida sobre um pedido, precisa de ajuda com produtos ou quer falar sobre parcerias, entre em contato.'

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

export async function getContactPageData(): Promise<ContactPageData> {
  if (!isSupabasePublicConfigured()) {
    return {
      storeName: '',
      intro: DEFAULT_INTRO,
      address: null,
      phoneDisplay: null,
      phoneHref: null,
      whatsappHref: null,
      whatsappLabel: 'WhatsApp',
      email: null,
      businessHours: null,
      socialLinks: [],
    }
  }

  const supabase = createPublicClient()

  const [settings, storeProfile, socialRows, footerData] = await Promise.all([
    getSiteSettings(supabase),
    getStoreProfile(supabase),
    getSocialLinks(supabase),
    getFooterData(),
  ])

  const profile = storeProfile
  const phoneDisplay =
    profile && (profile.phone_area_code || profile.phone_number)
      ? formatPhoneDisplay(profile.phone_area_code, profile.phone_number)
      : formatPhoneDisplay(settings.phone_area_code ?? '', settings.phone_number ?? '')

  const address =
    (profile ? formatStoreAddressInline(profile) : null) ??
    footerData.contact.address

  const businessHours =
    (profile ? formatOpeningHoursLong(profile.store_opening_hours) : null) ??
    footerData.contact.businessHours

  const socialLinks = socialRows
    .map(mapSocial)
    .filter((s): s is SocialLink => s !== null)
    .filter((s) => s.type !== 'whatsapp')

  const whatsappSocial = socialRows.find((s) => s.type === 'whatsapp')

  return {
    storeName: profile?.store_name ?? settings.store_name ?? '',
    intro: profile?.store_description?.trim() || DEFAULT_INTRO,
    address,
    phoneDisplay,
    phoneHref: profile?.phone_href?.trim() || settings.phone_href?.trim() || null,
    whatsappHref:
      settings.contact_whatsapp_href ?? whatsappSocial?.href ?? null,
    whatsappLabel: settings.contact_whatsapp_label ?? 'WhatsApp',
    email: profile?.contact_email ?? footerData.contact.email,
    businessHours,
    socialLinks,
  }
}
