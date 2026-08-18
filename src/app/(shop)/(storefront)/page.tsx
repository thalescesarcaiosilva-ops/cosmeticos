import type { Metadata } from 'next'
import { Fragment } from 'react'
import { CategoryGrid } from '@/components/collection/CategoryGrid'
import { NewsletterSection } from '@/components/home/NewsletterSection'
import { ProductCarouselSection } from '@/components/home/ProductCarouselSection'
import { HomeLcpPreload } from '@/components/home/HomeLcpPreload'
import { ResponsiveHomeBanners } from '@/components/home/ResponsiveHomeBanners'
import { StoreAboutSection } from '@/components/home/StoreAboutSection'
import { splitBannersByDevice } from '@/lib/banners/queries'
import { getCachedHomePageData } from '@/lib/home/queries'
import { buildInstallmentMap } from '@/lib/payment/build-installment-map'
import { getSeoSettings } from '@/lib/seo/get-seo-settings'
import { buildPageMetadata } from '@/lib/seo/metadata'

/** HTML da home em cache — catálogo completo no SSR para o Googlebot. */
export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings()
  return buildPageMetadata({
    title: { absolute: seo.defaultTitle },
    description: seo.description,
    path: '/',
    imageUrl: seo.ogImageUrl,
    imageAlt: seo.siteName,
  })
}

export default async function HomePage() {
  const { banners, collections, categorySections, paymentSettings } =
    await getCachedHomePageData()

  const { desktop: desktopBanners, mobile: mobileBanners } = splitBannersByDevice(banners)
  const lcpMobileUrl = mobileBanners[0]?.image_url ?? null
  const lcpDesktopUrl = desktopBanners[0]?.image_url ?? null
  const allProducts = categorySections.flatMap((section) => section.products)
  const installments = buildInstallmentMap(allProducts, paymentSettings)

  return (
    <>
      <HomeLcpPreload mobileBannerUrl={lcpMobileUrl} desktopBannerUrl={lcpDesktopUrl} />
      <ResponsiveHomeBanners
        desktopBanners={desktopBanners}
        mobileBanners={mobileBanners}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <section className="mb-12 min-h-[11rem] sm:min-h-[12rem]">
          <h2 className="section-title">Compre por categoria</h2>
          <CategoryGrid items={collections} />
        </section>

        {categorySections.map((section) => (
          <Fragment key={section.id}>
            <ProductCarouselSection
              title={section.name}
              viewAllHref={`/colecoes/${section.slug}`}
              products={section.products}
              installments={installments}
            />
            {section.slug === 'cuidados-capilares' && <StoreAboutSection />}
          </Fragment>
        ))}

        <NewsletterSection />
      </div>
    </>
  )
}
