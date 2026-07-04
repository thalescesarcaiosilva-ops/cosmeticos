export type PolicyLink = {
  label: string
  href: string
}

export type SocialLink = {
  type: 'whatsapp' | 'facebook' | 'instagram'
  href: string
  label: string
  display?: string
}

export type PhoneContact = {
  areaCode: string
  number: string
  display: string
  href: string
}

export type MenuCategory = {
  id: string
  label: string
  href: string
  slug: string
  hasDropdown?: boolean
}

export type HelpLink = {
  label: string
  href: string
}

export type StoreLogo = {
  imageUrl: string | null
}

export type SiteLayoutData = {
  storeName: string
  logo: StoreLogo
  policyLinks: PolicyLink[]
  socialLinks: SocialLink[]
  phone: PhoneContact
  helpLink: HelpLink
  menuCategories: MenuCategory[]
}
