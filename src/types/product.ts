export type Brand = {
  id: string
  name: string
  slug: string
  active: boolean
}

export type MediaAsset = {
  id: string
  filename: string
  storage_path: string
  bucket: string
  public_url: string
  mime_type: string
  size_bytes: number
  alt_text: string | null
  created_at: string
}

export type ProductImage = {
  id: string
  sort_order: number
  media: MediaAsset
}

export type ProductCategoryRef = {
  category_id: string
  categories: {
    id: string
    name: string
    slug: string
  }
}

export type Product = {
  id: string
  name: string
  slug: string
  description: string | null
  short_description: string | null
  benefits: string[] | null
  price: number
  original_price: number | null
  stock: number
  sku: string | null
  gtin: string | null
  meta_title: string | null
  meta_description: string | null
  active: boolean
  brand_id: string | null
  brand?: Brand | null
  product_categories?: ProductCategoryRef[]
  product_images?: ProductImage[]
  created_at: string
  updated_at: string
}

export type ProductCardData = {
  id: string
  slug: string
  name: string
  brandName: string | null
  price: number
  originalPrice: number | null
  imageUrl: string | null
  imageAlt: string | null
}

export type ProductDetail = Product & {
  images: { id: string; url: string; alt: string }[]
  categories: { name: string; slug: string }[]
  categorySlugs: string[]
  brandName: string | null
  brandSlug: string | null
}
