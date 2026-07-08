'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
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
}

export function ShopHeader({ className, ...props }: ShopHeaderProps) {
  const pathname = usePathname()
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = headerRef.current
    if (!node) return

    function syncHeaderHeight() {
      if (!node) return
      const height = node.getBoundingClientRect().height
      document.documentElement.style.setProperty('--shop-header-height', `${height}px`)
    }

    syncHeaderHeight()
    const observer = new ResizeObserver(syncHeaderHeight)
    observer.observe(node)
    window.addEventListener('resize', syncHeaderHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncHeaderHeight)
      document.documentElement.style.removeProperty('--shop-header-height')
    }
  }, [pathname])

  return (
    <>
      <div
        ref={headerRef}
        data-header-mode="solid"
        className={`shop-header fixed inset-x-0 top-0 z-50 overflow-visible border-b border-border bg-surface text-text-primary shadow-[rgba(74,32,42,0.08)_0px_1px_2px_0px] ${className ?? ''}`}
      >
        <TopBar
          storeName={props.storeName}
          policyLinks={props.policyLinks}
          socialLinks={props.socialLinks}
        />
        <SiteHeader {...props} />
        <MainNav categories={props.menuCategories} className="hidden md:block" />
      </div>
      <div
        aria-hidden="true"
        className="shop-header-spacer shrink-0"
        style={{ height: 'var(--shop-header-height)' }}
      />
    </>
  )
}
