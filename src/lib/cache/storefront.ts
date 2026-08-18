import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'

/** ISR curto: HTML completo para o bot, TTFB baixo na vitrine. */
export const STOREFRONT_REVALIDATE_SECONDS = 60

export const HOME_CACHE_TAG = 'home-page'
export const SITE_LAYOUT_CACHE_TAG = 'site-layout'

export function cacheStorefrontQuery<T>(
  fn: () => Promise<T>,
  key: string,
  tags: string[]
): () => Promise<T> {
  return unstable_cache(fn, [key], {
    revalidate: STOREFRONT_REVALIDATE_SECONDS,
    tags,
  })
}

/** Invalida vitrine após mudança no admin (catálogo, banner, layout). */
export function revalidateStorefront() {
  revalidateTag(HOME_CACHE_TAG, 'max')
  revalidateTag(SITE_LAYOUT_CACHE_TAG, 'max')
  revalidatePath('/', 'layout')
}
