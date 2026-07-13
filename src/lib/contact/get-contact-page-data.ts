import { getFooterData } from '@/lib/layout/get-footer-data'
import { getSiteSettings, getSocialLinks, SITE_SETTINGS_ID } from '@/lib/layout/queries'
import { filterStorefrontSocialLinks } from '@/lib/layout/social-links'
import {
  formatOpeningHoursLong,
  formatPhoneDisplay,
  formatStoreAddressInline,
} from '@/lib/store-profile/format'
import { getStoreProfile } from '@/lib/store-profile/queries'
import { createPublicClient, isSupabasePublicConfigured } from '@/lib/supabase/public'
import type { ContactSupportTopic } from '@/types/payment'
import { DEFAULT_CONTACT_SUPPORT_TOPICS } from '@/types/payment'
import type { SocialLink } from '@/types/layout'
import { z } from 'zod'

const socialTypeSchema = z.enum(['whatsapp', 'facebook', 'instagram'])

export type ContactPageData = {
  storeName: string
  pageTitle: string
  intro: string | null
  supportTopics: ContactSupportTopic[]
  address: string | null
  phoneDisplay: string | null
  phoneHref: string | null
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
  if (parsed.data === 'whatsapp') return null
  return {
    type: parsed.data,
    href: row.href,
    label: row.label,
    ...(row.display ? { display: row.display } : {}),
  }
}

function parseSupportTopics(raw: unknown): ContactSupportTopic[] {
  if (!Array.isArray(raw)) return DEFAULT_CONTACT_SUPPORT_TOPICS
  const topics = raw
    .filter(
      (item): item is ContactSupportTopic =>
        typeof item === 'object' &&
        item != null &&
        typeof (item as ContactSupportTopic).title === 'string' &&
        typeof (item as ContactSupportTopic).description === 'string' &&
        (item as ContactSupportTopic).title.trim().length > 0
    )
    .map((item) => ({
      title: item.title.trim().slice(0, 80),
      description: item.description.trim().slice(0, 300),
    }))
  return topics.length > 0 ? topics : DEFAULT_CONTACT_SUPPORT_TOPICS
}

async function fetchContactPageSettings(supabase: ReturnType<typeof createPublicClient>) {
  const { data } = await supabase
    .from('site_settings')
    .select('contact_page_title, contact_page_intro, contact_page_support_topics')
    .eq('id', SITE_SETTINGS_ID)
    .maybeSingle()

  return {
    pageTitle: (data?.contact_page_title as string | null)?.trim() || 'Central de Atendimento',
    intro: (data?.contact_page_intro as string | null)?.trim() || null,
    supportTopics: parseSupportTopics(data?.contact_page_support_topics),
  }
}

export async function getContactPageData(): Promise<ContactPageData> {
  if (!isSupabasePublicConfigured()) {
    return {
      storeName: '',
      pageTitle: 'Central de Atendimento',
      intro: DEFAULT_INTRO,
      supportTopics: DEFAULT_CONTACT_SUPPORT_TOPICS,
      address: null,
      phoneDisplay: null,
      phoneHref: null,
      email: null,
      businessHours: null,
      socialLinks: [],
    }
  }

  const supabase = createPublicClient()

  const [settings, storeProfile, socialRows, footerData, contactPageSettings] = await Promise.all([
    getSiteSettings(supabase),
    getStoreProfile(supabase),
    getSocialLinks(supabase),
    getFooterData(),
    fetchContactPageSettings(supabase),
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

  const socialLinks = filterStorefrontSocialLinks(
    socialRows.map(mapSocial).filter((s): s is SocialLink => s !== null)
  )

  return {
    storeName: profile?.store_name ?? settings.store_name ?? '',
    pageTitle: contactPageSettings.pageTitle,
    intro:
      contactPageSettings.intro ??
      (profile?.store_description?.trim() || DEFAULT_INTRO),
    supportTopics: contactPageSettings.supportTopics,
    address,
    phoneDisplay,
    phoneHref: profile?.phone_href?.trim() || settings.phone_href?.trim() || null,
    email: profile?.contact_email ?? footerData.contact.email,
    businessHours,
    socialLinks,
  }
}
