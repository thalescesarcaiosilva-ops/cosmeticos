import type { SocialLink } from '@/types/layout'

/** Links de redes exibidos na vitrine (sem WhatsApp). */
export function filterStorefrontSocialLinks(links: SocialLink[]): SocialLink[] {
  return links.filter((link) => link.type !== 'whatsapp')
}
