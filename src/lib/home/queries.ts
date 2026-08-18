import { getHomeBannersPublic } from '@/lib/banners/queries'
import { cacheStorefrontQuery, HOME_CACHE_TAG } from '@/lib/cache/storefront'
import {
  getCollectionsForCarousel,
  type CollectionsForCarouselOptions,
} from '@/lib/collections/queries'
import { HOME_CATEGORY_SLUGS } from '@/lib/home/config'
import { getPaymentSettings } from '@/lib/payment/queries'
import { getProductsForCards } from '@/lib/products/queries'
import type { HomeBannerPublic } from '@/types/home-banner'
import type { PaymentSettings } from '@/types/payment'
import type { ProductCardData } from '@/types/product'

export type HomeCategorySection = {
  id: string
  name: string
  slug: string
  imageUrl: string | null
  products: ProductCardData[]
}

const PRODUCTS_PER_CATEGORY = 12

export async function getHomeCategorySections(
  options?: CollectionsForCarouselOptions
): Promise<HomeCategorySection[]> {
  const collections = await getCollectionsForCarousel(options)

  return Promise.all(
    collections.map(async (collection) => ({
      ...collection,
      products: await getProductsForCards({
        categorySlug: collection.slug,
        limit: PRODUCTS_PER_CATEGORY,
      }),
    }))
  )
}

export type HomePageData = {
  banners: HomeBannerPublic[]
  collections: Awaited<ReturnType<typeof getCollectionsForCarousel>>
  categorySections: HomeCategorySection[]
  paymentSettings: PaymentSettings
}

/**
 * Home em HTML completo (produtos, banners, categorias) com cache de 60s.
 * O bot recebe o catálogo no SSR — não há fetch no cliente.
 */
export const getCachedHomePageData = cacheStorefrontQuery(
  async (): Promise<HomePageData> => {
    const slugs =
      HOME_CATEGORY_SLUGS.length > 0 ? { slugs: HOME_CATEGORY_SLUGS } : undefined
    const [banners, collections, categorySections, paymentSettings] = await Promise.all([
      getHomeBannersPublic(),
      getCollectionsForCarousel(slugs),
      getHomeCategorySections(slugs),
      getPaymentSettings(),
    ])
    return { banners, collections, categorySections, paymentSettings }
  },
  'home-page-data',
  [HOME_CACHE_TAG]
)
