'use client'

import { useEffect, useRef } from 'react'
import type {
  ContactPageLink,
  HelpLink,
  MenuCategory,
  PhoneContact,
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
  phone: PhoneContact
  helpLink: HelpLink
  contactPage: ContactPageLink
  socialLinks: SocialLink[]
  freeShippingAbove?: number | null
}

export function ShopHeader({ className, ...props }: ShopHeaderProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const topBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const headerNode = headerRef.current
    const topBarNode = topBarRef.current
    if (!headerNode) return

    function syncHeaderHeights() {
      if (!headerNode) return
      const headerHeight = headerNode.getBoundingClientRect().height
      const topBarHeight = topBarNode?.getBoundingClientRect().height ?? 0
      document.documentElement.style.setProperty('--shop-header-height', `${headerHeight}px`)
      document.documentElement.style.setProperty('--shop-topbar-height', `${topBarHeight}px`)
    }

    syncHeaderHeights()
    const observer = new ResizeObserver(syncHeaderHeights)
    observer.observe(headerNode)
    if (topBarNode) observer.observe(topBarNode)
    window.addEventListener('resize', syncHeaderHeights)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncHeaderHeights)
      document.documentElement.style.removeProperty('--shop-header-height')
      document.documentElement.style.removeProperty('--shop-topbar-height')
    }
  }, [])

  return (
    <div
      ref={headerRef}
      data-header-mode="solid"
      className={`shop-header sticky top-0 z-50 overflow-visible border-b border-[#e7e7e7] bg-surface text-[#272225] shadow-[0_1px_3px_rgba(36,29,31,0.08)] ${className ?? ''}`}
    >
      <div ref={topBarRef}>
        <TopBar
          storeName={props.storeName}
          policyLinks={props.policyLinks}
          socialLinks={props.socialLinks}
          freeShippingAbove={props.freeShippingAbove}
        />
      </div>
      <SiteHeader {...props} />
      <MainNav categories={props.menuCategories} phone={props.phone} className="hidden md:block" />
    </div>
  )
}
