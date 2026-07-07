/** Tipos das rows do Supabase — layout/CMS. Substituir por `database.ts` gerado quando disponível. */

export type SiteSettingsRow = {
  id: string
  store_name: string
  logo_brand: string
  logo_suffix: string
  logo_tagline: string | null
  logo_image_url?: string | null
  phone_area_code: string
  phone_number: string
  phone_href: string
  help_label: string
  help_href: string
  cnpj?: string | null
  company_legal_name?: string | null
  footer_phone_label?: string | null
  business_hours?: string | null
  contact_whatsapp_label?: string | null
  contact_whatsapp_href?: string | null
  contact_page_label?: string | null
  contact_page_href?: string | null
  footer_social_heading?: string | null
  footer_security_heading?: string | null
  footer_payment_text?: string | null
  footer_security_text?: string | null
  footer_disclaimers?: string[] | null
  installment_interest_free?: number | null
  seo_title?: string | null
  seo_title_template?: string | null
  seo_description?: string | null
  seo_og_image_url?: string | null
  favicon_url?: string | null
  contact_email?: string | null
  contact_address?: string | null
  contact_address_label?: string | null
  payment_method_images?: Record<string, string | null> | null
  payment_methods?: string[] | null
  payment_methods_config?: Array<{ id: string; label: string; imageUrl: string | null }> | null
}

export type PolicyLinkRow = {
  id: string
  label: string
  href: string
  sort_order: number
}

export type SocialLinkRow = {
  id: string
  type: string
  href: string
  label: string
  display: string | null
  sort_order: number
}

export type MenuItemRow = {
  id: string
  label: string
  slug: string
  href: string
  parent_id?: string | null
  has_dropdown: boolean
  sort_order: number
}

export type FooterPageType = 'institutional' | 'policy' | 'services' | 'support'

export type FooterPageRow = {
  id: string
  slug: string
  title: string
  page_type?: FooterPageType | string
  sort_order?: number
  show_in_footer?: boolean
}

export type FooterMenuItemRow = {
  id: string
  label: string
  href: string
  sort_order: number
}

export type FooterMenuRow = {
  id: string
  title: string
  sort_order: number
  items: FooterMenuItemRow[]
}

export type FooterAssetRow = {
  id: string
  asset_type: 'payment' | 'security'
  image_url: string
  alt_text: string | null
  href: string | null
  sort_order: number
}

export type LayoutQueryResult = {
  settings: SiteSettingsRow
  policyLinks: PolicyLinkRow[]
  socialLinks: SocialLinkRow[]
  menuItems: MenuItemRow[]
}
