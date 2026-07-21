import type { Metadata } from 'next'
import { Fragment } from 'react'
import { CategoryGrid } from '@/components/collection/CategoryGrid'
import { DeferredHomeSection } from '@/components/home/DeferredHomeSection'
import { HomeBannerCarousel } from '@/components/home/HomeBannerCarousel'
import { NewsletterSection } from '@/components/home/NewsletterSection'
import { ProductCarouselSection } from '@/components/home/ProductCarouselSection'
import { StoreAboutSection } from '@/components/home/StoreAboutSection'
import { getHomeBannersPublic, splitBannersByDevice } from '@/lib/banners/queries'
import { HOME_CATEGORY_SLUGS } from '@/lib/home/config'
import { getCollectionsForCarousel } from '@/lib/collections/queries'
import { getHomeCategorySections } from '@/lib/home/queries'
import { buildInstallmentMap } from '@/lib/payment/build-installment-map'
import { getPaymentSettings } from '@/lib/payment/queries'
import { getSeoSettings } from '@/lib/seo/get-seo-settings'
import { buildPageMetadata } from '@/lib/seo/metadata'

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
  const [banners, collections, categorySections, paymentSettings] = await Promise.all([
    getHomeBannersPublic(),
    getCollectionsForCarousel(),
    getHomeCategorySections(
      HOME_CATEGORY_SLUGS.length > 0 ? { slugs: HOME_CATEGORY_SLUGS } : undefined
    ),
    getPaymentSettings(),
  ])

  const { desktop: desktopBanners, mobile: mobileBanners } = splitBannersByDevice(banners)
  const allProducts = categorySections.flatMap((section) => section.products)
  const installments = buildInstallmentMap(allProducts, paymentSettings)

  return (
    <>
      {/* Above-the-fold: banner + categorias — sem defer (evita tela branca / CLS).
          Só o carrossel mobile usa priority: preload duplo (mobile+desktop) atrasa o LCP. */}
      <HomeBannerCarousel
        banners={desktopBanners}
        variant="desktop"
        className="home-hero-banner hidden md:block"
      />
      <HomeBannerCarousel
        banners={mobileBanners}
        variant="mobile"
        className="md:hidden"
        prioritizeFirst
      />

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <section className="mb-12">
          <h2 className="section-title">Compre por categoria</h2>
          <CategoryGrid items={collections} />
        </section>

        {/* Below-the-fold: HTML no SSR, pintura adiada; nunca desmonta ao rolar. */}
        {categorySections.map((section) => (
          <Fragment key={section.id}>
            <DeferredHomeSection estimatedHeightPx={560}>
              <ProductCarouselSection
                title={section.name}
                viewAllHref={`/colecoes/${section.slug}`}
                products={section.products}
                installments={installments}
              />
            </DeferredHomeSection>
            {section.slug === 'cuidados-capilares' && (
              <DeferredHomeSection estimatedHeightPx={420}>
                <StoreAboutSection />
              </DeferredHomeSection>
            )}
          </Fragment>
        ))}

        <DeferredHomeSection estimatedHeightPx={280}>
          <NewsletterSection />
        </DeferredHomeSection>
      </div>
    </>
  )
}
