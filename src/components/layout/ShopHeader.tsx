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
}

export function ShopHeader({ className, ...props }: ShopHeaderProps) {
  const pathname = usePathname()
  const headerRef = useRef<HTMLDivElement>(null)
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
    <div
      ref={headerRef}
      data-header-mode={overlay ? 'overlay' : 'solid'}
      className={`shop-header sticky top-0 z-50 overflow-visible border-b border-border bg-surface text-text-primary shadow-[rgba(74,32,42,0.08)_0px_1px_2px_0px] transition-[background-color,box-shadow,border-color] duration-[400ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${
        overlay
          ? 'md:border-white/10 md:bg-black/45 md:text-white md:shadow-none md:backdrop-blur-md'
          : ''
      } ${className ?? ''}`}
    >
      <TopBar
        storeName={props.storeName}
        policyLinks={props.policyLinks}
        socialLinks={props.socialLinks}
        overlay={overlay}
      />
      <SiteHeader {...props} overlay={overlay} />
      <MainNav categories={props.menuCategories} overlay={overlay} className="hidden md:block" />
    </div>
  )
}
