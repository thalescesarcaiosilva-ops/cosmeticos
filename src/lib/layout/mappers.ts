import { z } from 'zod'
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

  return {
    storeName: settings.store_name,
    logo: {
      imageUrl: settings.logo_image_url ?? null,
    },
    policyLinks: policyLinks.map((link) => ({
      label: link.label,
      href: link.href,
    })),
    socialLinks: socialLinks
      .map(mapSocialLink)
      .filter((link): link is SocialLink => link !== null),
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
    menuCategories: menuItems.map((item) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      slug: item.slug,
      ...(item.has_dropdown ? { hasDropdown: true } : {}),
    })),
  }
}
