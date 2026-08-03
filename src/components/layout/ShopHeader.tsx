'use client'

import { useEffect, useRef, useState } from 'react'
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
  freeShippingAbove?: number | null
}

export function ShopHeader({ className, ...props }: ShopHeaderProps) {
  const pathname = usePathname()
  const headerRef = useRef<HTMLDivElement>(null)
  const topBarRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const isHome = pathname === '/'
  const overlay = isDesktop && isHome && !scrolled

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const syncViewport = () => setIsDesktop(media.matches)
    syncViewport()
    media.addEventListener('change', syncViewport)
    return () => media.removeEventListener('change', syncViewport)
  }, [])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [pathname])

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
  }, [pathname])

  return (
    <div
      ref={headerRef}
      data-header-mode={overlay ? 'overlay' : 'solid'}
      className={`shop-header sticky top-0 z-50 overflow-visible transition-[background-color,box-shadow,border-color,color] duration-[400ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${
        overlay
          ? 'border-b border-transparent bg-[var(--color-header-overlay)] text-white shadow-none backdrop-blur-md'
          : 'border-b border-[#e7e7e7] bg-surface text-[#272225] shadow-[0_1px_3px_rgba(36,29,31,0.08)] backdrop-blur-none'
      } ${className ?? ''}`}
    >
      <div ref={topBarRef}>
        <TopBar
          storeName={props.storeName}
          policyLinks={props.policyLinks}
          socialLinks={props.socialLinks}
          freeShippingAbove={props.freeShippingAbove}
        />
      </div>
      <SiteHeader {...props} overlay={overlay} />
      <MainNav
        categories={props.menuCategories}
        phone={props.phone}
        overlay={overlay}
        className="hidden md:block"
      />
    </div>
  )
}
