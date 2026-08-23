import { HomeBannerCarousel } from '@/components/home/HomeBannerCarousel'
import type { HomeBannerPublic } from '@/types/home-banner'

type ResponsiveHomeBannersProps = {
  desktopBanners: HomeBannerPublic[]
  mobileBanners: HomeBannerPublic[]
}

/**
 * Dois carrosséis no SSR (CSS show/hide) — evita flash mobile→desktop na hidratação.
 * O 1º slide de cada viewport vai eager (não lazy): labs desktop/mobile medem LCP
 * no carrossel visível; banners ~20KB tornam o dual-eager barato.
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
