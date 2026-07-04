export const MEDIA_BUCKETS = ['product-images', 'site-assets', 'categories'] as const

export type MediaBucket = (typeof MEDIA_BUCKETS)[number]

export const MEDIA_BUCKET_LABELS: Record<MediaBucket, string> = {
  'product-images': 'Produtos',
  'site-assets': 'Site',
  categories: 'Categorias',
}

export const DEFAULT_PRODUCT_MEDIA_BUCKET: MediaBucket = 'product-images'
export const DEFAULT_SITE_MEDIA_BUCKET: MediaBucket = 'site-assets'

export function isMediaBucket(value: string | null | undefined): value is MediaBucket {
  return value != null && (MEDIA_BUCKETS as readonly string[]).includes(value)
}

export const MEDIA_PAGE_SIZE = 24
