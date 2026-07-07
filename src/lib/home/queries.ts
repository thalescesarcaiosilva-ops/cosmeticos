import {
  getCollectionsForCarousel,
  type CollectionsForCarouselOptions,
} from '@/lib/collections/queries'
import { getProductsForCards } from '@/lib/products/queries'
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
