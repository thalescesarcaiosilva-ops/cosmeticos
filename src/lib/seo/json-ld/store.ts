import type { FooterData } from '@/lib/layout/get-footer-data'
import type { SiteLayoutData } from '@/types/layout'
import type { MerchantSeoContext } from '@/lib/seo/get-merchant-seo-context'
import type { StoreProfile } from '@/lib/store-profile/queries'
import { toAbsoluteSiteMediaUrl } from '@/lib/media/public-url'
import { absoluteUrl } from '@/lib/seo/site-url'
import {
  buildMerchantReturnPolicy,
  buildShippingServiceJsonLd,
  organizationId,
} from '@/lib/seo/json-ld/merchant-schemas'

type StoreJsonLdInput = {
  layout: SiteLayoutData
  footer: FooterData
  profile: StoreProfile
  merchant: MerchantSeoContext
}

function formatTelephone(profile: StoreProfile): string | null {
  if (profile.phone_href?.trim()) {
    const digits = profile.phone_href.replace(/\D/g, '')
    if (digits.length >= 10) {
      if (digits.startsWith('55') && digits.length >= 12) {
        return `+${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`
      }
      return `+55-${digits.slice(0, 2)}-${digits.slice(2)}`
    }
  }

  const digits = `${profile.phone_area_code}${profile.phone_number}`.replace(/\D/g, '')
  if (digits.length < 10) return null
  return `+55-${digits.slice(0, 2)}-${digits.slice(2)}`
}

function buildPostalAddress(profile: StoreProfile): Record<string, unknown> | null {
  const streetParts = [
    profile.store_street,
    profile.store_street_number,
    profile.store_complement,
  ].filter(Boolean)

  if (streetParts.length === 0 && !profile.store_city) {
    return null
  }

  return {
    '@type': 'PostalAddress',
    streetAddress: streetParts.join(', ') || undefined,
    addressLocality: profile.store_city ?? undefined,
    addressRegion: profile.store_state ?? undefined,
    postalCode: profile.store_postal_code ?? undefined,
    addressCountry: profile.store_country || 'BR',
  }
}

export function buildStoreJsonLd({
  layout,
  footer,
  profile,
  merchant,
}: StoreJsonLdInput): Record<string, unknown> | null {
  const siteUrl = absoluteUrl('/')
  const orgId = organizationId()
  if (!siteUrl || !orgId) return null

  const displayName = profile.store_name.trim() || layout.storeName || footer.legal.storeName
  const legalName =
    profile.company_legal_name?.trim() ||
    footer.legal.companyLegalName?.trim() ||
    displayName

  const store: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': orgId,
    name: displayName,
    legalName,
    url: siteUrl,
  }

  const image = toAbsoluteSiteMediaUrl(profile.logo_image_url || layout.logo.imageUrl)
  if (image) {
    store.image = image
    store.logo = image
  }

  const description = profile.store_description?.trim()
  if (description) store.description = description

  const email = profile.contact_email?.trim() || footer.contact.email?.trim()
  const phone = formatTelephone(profile)
  if (email) store.email = email
  if (phone) store.telephone = phone

  const taxId = profile.cnpj?.trim() || footer.legal.cnpj?.trim()
  if (taxId) store.taxID = taxId

  const address = buildPostalAddress(profile)
  if (address) store.address = address

  if (profile.store_opening_hours.length > 0) {
    store.openingHoursSpecification = profile.store_opening_hours.map((slot) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: slot.dayOfWeek,
      opens: slot.opens,
      closes: slot.closes,
    }))
  }

  const sameAs = [
    ...footer.socialLinks.map((s) => s.href),
    ...(footer.contact.whatsappHref ? [footer.contact.whatsappHref] : []),
  ].filter(Boolean)

  if (sameAs.length > 0) {
    store.sameAs = sameAs
  }

  const returnPolicy = buildMerchantReturnPolicy(merchant)
  if (returnPolicy) {
    store.hasMerchantReturnPolicy = returnPolicy
  }

  store.hasShippingService = buildShippingServiceJsonLd()

  return store
}

/** @deprecated use buildStoreJsonLd */
export const buildOrganizationJsonLd = buildStoreJsonLd
