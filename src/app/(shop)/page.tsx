import type { Metadata } from 'next'
import { CategoryGrid } from '@/components/collection/CategoryGrid'
import { HomeBannerCarousel } from '@/components/home/HomeBannerCarousel'
import { ProductCarouselSection } from '@/components/home/ProductCarouselSection'
import { getHomeBannersPublic, splitBannersByDevice } from '@/lib/banners/queries'
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
    getHomeCategorySections(),
    getPaymentSettings(),
  ])

  const { desktop: desktopBanners, mobile: mobileBanners } = splitBannersByDevice(banners)
  const allProducts = categorySections.flatMap((section) => section.products)
  const installments = buildInstallmentMap(allProducts, paymentSettings)

  return (
    <>
      <HomeBannerCarousel banners={desktopBanners} className="home-hero-banner hidden md:block" />
      <HomeBannerCarousel banners={mobileBanners} className="home-hero-banner md:hidden" />

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <section className="mb-12">
          <h2 className="section-title">Compre por categoria</h2>
          <CategoryGrid items={collections} />
        </section>

        {categorySections.map((section) => (
          <ProductCarouselSection
            key={section.id}
            title={section.name}
            viewAllHref={`/colecoes/${section.slug}`}
            products={section.products}
            installments={installments}
          />
        ))}

        <section className="rounded-lg bg-surface-muted px-6 py-10 text-center">
          <h2 className="mb-2 text-xl font-bold">Clube de Ofertas</h2>
          <p className="mb-4 text-sm text-text-secondary">
            Cadastre-se e receba novidades e ofertas exclusivas.
          </p>
          <form className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
            <input
              type="email"
              placeholder="Seu e-mail"
              className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm"
              aria-label="E-mail para newsletter"
            />
            <button type="submit" className="btn-primary">
              Cadastrar
            </button>
          </form>
        </section>
      </div>
    </>
  )
}
