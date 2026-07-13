import { z } from 'zod'
import { filterStorefrontSocialLinks } from '@/lib/layout/social-links'
import { toSiteMediaUrl } from '@/lib/media/public-url'
import type { LayoutQueryResult } from '@/types/database-layout'
import type { SiteLayoutData, SocialLink } from '@/types/layout'

const socialTypeSchema = z.enum(['whatsapp', 'facebook', 'instagram'])

function mapSocialLink(row: LayoutQueryResult['socialLinks'][number]): SocialLink | null {
  const parsedType = socialTypeSchema.safeParse(row.type)
  if (!parsedType.success) {
    return null
  }

  return {
    type: parsedType.data,
    href: row.href,
    label: row.label,
    ...(row.display ? { display: row.display } : {}),
  }
}

export function mapToSiteLayoutData(result: LayoutQueryResult): SiteLayoutData {
  const { settings, policyLinks, socialLinks, menuItems } = result

  const phoneDisplay = `${settings.phone_area_code}${settings.phone_number}`

  const childrenByParent = new Map<string, typeof menuItems>()
  for (const item of menuItems) {
    if (item.parent_id) {
      const list = childrenByParent.get(item.parent_id) ?? []
      list.push(item)
      childrenByParent.set(item.parent_id, list)
    }
  }

  const rootItems = menuItems
    .filter((item) => !item.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order)

  return {
    storeName: settings.store_name,
    logo: {
      imageUrl: toSiteMediaUrl(settings.logo_image_url ?? null),
    },
    policyLinks: policyLinks.map((link) => ({
      label: link.label,
      href: link.href,
    })),
    socialLinks: filterStorefrontSocialLinks(
      socialLinks.map(mapSocialLink).filter((link): link is SocialLink => link !== null)
    ),
    phone: {
      areaCode: settings.phone_area_code,
      number: settings.phone_number,
      display: phoneDisplay,
      href: settings.phone_href,
    },
    helpLink: {
      label: settings.help_label,
      href: settings.help_href,
    },
    contactPage: {
      label: settings.contact_page_label?.trim() || 'Fale Conosco',
      href: settings.contact_page_href?.trim() || '/paginas/fale-conosco',
    },
    menuCategories: rootItems.map((item) => {
      const children = (childrenByParent.get(item.id) ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((child) => ({
          id: child.id,
          label: child.label,
          href: child.href,
        }))
      const hasDropdown = item.has_dropdown || children.length > 0

      return {
        id: item.id,
        label: item.label,
        href: item.href,
        slug: item.slug,
        ...(hasDropdown ? { hasDropdown: true } : {}),
        ...(children.length > 0 ? { children } : {}),
      }
    }),
  }
}
