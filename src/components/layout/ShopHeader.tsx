import type {
  ContactPageLink,
  HelpLink,
  MenuCategory,
  PolicyLink,
  SocialLink,
  StoreLogo,
} from '@/types/layout'
import { MainNav } from './MainNav'
import { SiteHeader } from './SiteHeader'
import { TopBar } from './TopBar'

type ShopHeaderProps = {
  className?: string
  storeName: string
  logo: StoreLogo
  policyLinks: PolicyLink[]
  menuCategories: MenuCategory[]
  helpLink: HelpLink
  contactPage: ContactPageLink
  socialLinks: SocialLink[]
}

/** Header SSR (links/logo no HTML). JS só nos filhos interativos (busca, menu, carrinho). */
export function ShopHeader({ className, ...props }: ShopHeaderProps) {
  return (
    <div
      data-header-mode="solid"
      className={`shop-header sticky top-0 z-50 overflow-visible border-b border-[#e7e7e7] bg-surface text-[#272225] shadow-[0_1px_3px_rgba(36,29,31,0.08)] ${className ?? ''}`}
    >
      <TopBar
        storeName={props.storeName}
        policyLinks={props.policyLinks}
        socialLinks={props.socialLinks}
      />
      <SiteHeader {...props} />
      <MainNav categories={props.menuCategories} className="hidden md:block" />
    </div>
  )
}
