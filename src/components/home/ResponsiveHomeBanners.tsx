'use client'

import { useEffect, useState } from 'react'
import { HomeBannerCarousel } from '@/components/home/HomeBannerCarousel'
import type { HomeBannerPublic } from '@/types/home-banner'

type ResponsiveHomeBannersProps = {
  desktopBanners: HomeBannerPublic[]
  mobileBanners: HomeBannerPublic[]
}

/**
 * Um carrossel por viewport: não baixa o set desktop+mobile ao mesmo tempo.
 * Mantém priority no slide LCP do viewport ativo.
 */
export function ResponsiveHomeBanners({
  desktopBanners,
  mobileBanners,
}: ResponsiveHomeBannersProps) {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const sync = () => setIsDesktop(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  if (isDesktop) {
    return (
      <HomeBannerCarousel
        banners={desktopBanners}
        variant="desktop"
        className="home-hero-banner"
        prioritizeFirst
      />
    )
  }

  return (
    <HomeBannerCarousel
      banners={mobileBanners}
      variant="mobile"
      className="home-hero-banner"
      prioritizeFirst
    />
  )
}
