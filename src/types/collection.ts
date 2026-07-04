export type CollectionDetail = {
  id: string
  name: string
  slug: string
  pageTitle: string
  description: string | null
  bannerImageUrl: string | null
  imageUrl: string | null
}

export type CollectionFilterBrand = {
  id: string
  name: string
  slug: string
  count: number
}

export type CollectionFilterCategory = {
  id: string
  name: string
  slug: string
  count: number
}

export type CollectionFilterMeta = {
  brands: CollectionFilterBrand[]
  categories: CollectionFilterCategory[]
  priceMin: number
  priceMax: number
  totalProducts: number
}

export type CollectionProductsResult = {
  products: import('@/types/product').ProductCardData[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
