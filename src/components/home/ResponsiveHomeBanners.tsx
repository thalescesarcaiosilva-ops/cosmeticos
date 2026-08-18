import { HomeBannerCarousel } from '@/components/home/HomeBannerCarousel'
import type { HomeBannerPublic } from '@/types/home-banner'

type ResponsiveHomeBannersProps = {
  desktopBanners: HomeBannerPublic[]
  mobileBanners: HomeBannerPublic[]
}

/**
 * Dois carrosséis no SSR (CSS show/hide) — evita flash mobile→desktop na hidratação.
 * Cada viewport prioriza só o banner visível (LCP).
 */
export function ResponsiveHomeBanners({
  desktopBanners,
  mobileBanners,
}: ResponsiveHomeBannersProps) {
  return (
    <>
      {mobileBanners.length > 0 && (
        <HomeBannerCarousel
          banners={mobileBanners}
          variant="mobile"
          className="home-hero-banner md:hidden"
          prioritizeFirst
        />
      )}
      {desktopBanners.length > 0 && (
        <HomeBannerCarousel
          banners={desktopBanners}
          variant="desktop"
          className="home-hero-banner hidden md:block"
          prioritizeFirst
        />
      )}
    </>
  )
}
