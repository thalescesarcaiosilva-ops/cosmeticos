import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  FooterPageRow,
  MenuItemRow,
  PolicyLinkRow,
  SiteSettingsRow,
  SocialLinkRow,
} from '@/types/database-layout'

export class LayoutQueryError extends Error {
  constructor(
    readonly table: string,
    cause: unknown
  ) {
    const hint = getLayoutErrorHint(cause)
    super(
      hint
        ? `Erro ao carregar dados de layout (${table}): ${hint}`
        : `Erro ao carregar dados de layout (${table})`
    )
    this.name = 'LayoutQueryError'
    this.cause = cause
  }
}

function getLayoutErrorHint(cause: unknown): string | null {
  if (!cause || typeof cause !== 'object') return null

  const details = 'details' in cause && typeof cause.details === 'string' ? cause.details : ''
  const message = 'message' in cause && typeof cause.message === 'string' ? cause.message : ''

  if (details.includes('ENOTFOUND') || message.includes('fetch failed')) {
    return 'verifique NEXT_PUBLIC_SUPABASE_URL no .env.local (Project URL do dashboard Supabase)'
  }

  if ('code' in cause && cause.code === 'PGRST116') {
    return 'registro não encontrado — confira se as migrations foram aplicadas'
  }

  return null
}

const SITE_SETTINGS_BASE_COLUMNS =
  'id, store_name, logo_brand, logo_suffix, logo_tagline, logo_image_url, phone_area_code, phone_number, phone_href, help_label, help_href'

const SITE_SETTINGS_MINIMAL_COLUMNS =
  'id, store_name, logo_brand, logo_suffix, logo_tagline, phone_area_code, phone_number, phone_href, help_label, help_href'

const SITE_SETTINGS_FOOTER_COLUMNS =
  'logo_image_url, cnpj, company_legal_name, footer_phone_label, business_hours, contact_whatsapp_label, contact_whatsapp_href, contact_page_label, contact_page_href, footer_social_heading, footer_security_heading, footer_payment_text, footer_security_text, footer_disclaimers, installment_interest_free, contact_email, contact_address, contact_address_label, payment_methods_config, payment_methods, payment_method_images'

const SITE_SETTINGS_SEO_COLUMNS =
  'seo_title, seo_title_template, seo_description, seo_og_image_url, favicon_url'

const SITE_SETTINGS_COLUMNS = `${SITE_SETTINGS_BASE_COLUMNS}, ${SITE_SETTINGS_FOOTER_COLUMNS}, ${SITE_SETTINGS_SEO_COLUMNS}`

const POLICY_LINK_COLUMNS = 'id, label, href, sort_order'

const SOCIAL_LINK_COLUMNS = 'id, type, href, label, display, sort_order'

const MENU_ITEM_COLUMNS = 'id, label, slug, href, has_dropdown, sort_order'

const FOOTER_PAGE_COLUMNS = 'id, slug, title, page_type, sort_order, show_in_footer'

const FOOTER_ASSET_COLUMNS = 'id, asset_type, image_url, alt_text, href, sort_order'

export const SITE_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

export async function getSiteSettings(
  supabase: SupabaseClient
): Promise<SiteSettingsRow> {
  const tiers = [
    SITE_SETTINGS_COLUMNS,
    `${SITE_SETTINGS_BASE_COLUMNS}, ${SITE_SETTINGS_FOOTER_COLUMNS}, ${SITE_SETTINGS_SEO_COLUMNS}`,
    `${SITE_SETTINGS_BASE_COLUMNS}, ${SITE_SETTINGS_FOOTER_COLUMNS}`,
    SITE_SETTINGS_BASE_COLUMNS,
    SITE_SETTINGS_MINIMAL_COLUMNS,
  ]

  let row: Record<string, unknown> | null = null

  for (const columns of tiers) {
    const result = await supabase
      .from('site_settings')
      .select(columns)
      .eq('id', SITE_SETTINGS_ID)
      .single()

    if (!result.error && result.data) {
      row = result.data as unknown as Record<string, unknown>
      break
    }
  }

  if (!row) {
    throw new LayoutQueryError('site_settings', new Error('site_settings unavailable'))
  }

  if (
    row.payment_methods_config === undefined &&
    row.payment_method_images === undefined &&
    row.payment_methods === undefined
  ) {
    const paymentMethods = await supabase
      .from('site_settings')
      .select('payment_methods_config, payment_methods, payment_method_images')
      .eq('id', SITE_SETTINGS_ID)
      .single()

    if (!paymentMethods.error && paymentMethods.data) {
      Object.assign(row, paymentMethods.data)
    }
  }

  return row as unknown as SiteSettingsRow
}

export async function getPolicyLinks(
  supabase: SupabaseClient
): Promise<PolicyLinkRow[]> {
  const { data, error } = await supabase
    .from('policy_links')
    .select(POLICY_LINK_COLUMNS)
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new LayoutQueryError('policy_links', error)
  }

  return data ?? []
}

export async function getSocialLinks(
  supabase: SupabaseClient
): Promise<SocialLinkRow[]> {
  const { data, error } = await supabase
    .from('social_links')
    .select(SOCIAL_LINK_COLUMNS)
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new LayoutQueryError('social_links', error)
  }

  return data ?? []
}

export async function getMenuItems(
  supabase: SupabaseClient
): Promise<MenuItemRow[]> {
  const { data, error } = await supabase
    .from('menu_items')
    .select(MENU_ITEM_COLUMNS)
    .eq('visible', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new LayoutQueryError('menu_items', error)
  }

  return data ?? []
}

export async function getFooterPages(
  supabase: SupabaseClient
): Promise<FooterPageRow[]> {
  const full = await supabase
    .from('footer_pages')
    .select(FOOTER_PAGE_COLUMNS)
    .eq('active', true)
    .eq('show_in_footer', true)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (!full.error) {
    return full.data ?? []
  }

  const legacy = await supabase
    .from('footer_pages')
    .select('id, slug, title, page_type')
    .eq('active', true)
    .order('title', { ascending: true })

  if (legacy.error) {
    throw new LayoutQueryError('footer_pages', legacy.error)
  }

  return legacy.data ?? []
}

const FOOTER_MENU_COLUMNS = 'id, title, sort_order, active'
const FOOTER_MENU_ITEM_COLUMNS = 'id, menu_id, label, href, sort_order, active'

export async function getFooterMenus(
  supabase: SupabaseClient
): Promise<import('@/types/database-layout').FooterMenuRow[]> {
  const { data: menus, error: menusError } = await supabase
    .from('footer_menus')
    .select(FOOTER_MENU_COLUMNS)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (menusError) {
    if (menusError.code === '42P01') return []
    throw new LayoutQueryError('footer_menus', menusError)
  }

  if (!menus?.length) return []

  const { data: items, error: itemsError } = await supabase
    .from('footer_menu_items')
    .select(FOOTER_MENU_ITEM_COLUMNS)
    .eq('active', true)
    .in(
      'menu_id',
      menus.map((m) => m.id)
    )
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true })

  if (itemsError) {
    if (itemsError.code === '42P01') return []
    throw new LayoutQueryError('footer_menu_items', itemsError)
  }

  const itemsByMenu = new Map<string, import('@/types/database-layout').FooterMenuItemRow[]>()
  for (const item of items ?? []) {
    const list = itemsByMenu.get(item.menu_id) ?? []
    list.push({
      id: item.id,
      label: item.label,
      href: item.href,
      sort_order: item.sort_order,
    })
    itemsByMenu.set(item.menu_id, list)
  }

  return menus.map((menu) => ({
    id: menu.id,
    title: menu.title,
    sort_order: menu.sort_order,
    items: itemsByMenu.get(menu.id) ?? [],
  }))
}

export async function getFooterAssets(
  supabase: SupabaseClient
): Promise<import('@/types/database-layout').FooterAssetRow[]> {
  const { data, error } = await supabase
    .from('footer_assets')
    .select(FOOTER_ASSET_COLUMNS)
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new LayoutQueryError('footer_assets', error)
  }

  return data ?? []
}
