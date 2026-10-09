/** Categorias ocultas por completo na vitrine (página, filtros e sitemap). */
export const STOREFRONT_HIDDEN_CATEGORY_SLUGS = ['mamae-e-bebe'] as const

/**
 * Coleções acessíveis por URL e no sitemap/feed, mas fora do menu,
 * carrossel e filtros da loja. Snapshot estático — não atualiza sozinho.
 */
export const STOREFRONT_NAV_HIDDEN_CATEGORY_SLUGS = ['mais-vendidos'] as const

export function isStorefrontCategoryHidden(slug: string): boolean {
  return (STOREFRONT_HIDDEN_CATEGORY_SLUGS as readonly string[]).includes(slug)
}

export function isStorefrontCategoryNavHidden(slug: string): boolean {
  return (
    isStorefrontCategoryHidden(slug) ||
    (STOREFRONT_NAV_HIDDEN_CATEGORY_SLUGS as readonly string[]).includes(slug)
  )
}

/** Remove categorias que não devem aparecer em menu, grid ou filtros. */
export function filterStorefrontCategories<T extends { slug: string }>(items: T[]): T[] {
  return items.filter((item) => !isStorefrontCategoryNavHidden(item.slug))
}

/** Remove só as totalmente ocultas (mantém coleções só-sitemap/feed). */
export function filterSitemapCategories<T extends { slug: string }>(items: T[]): T[] {
  return items.filter((item) => !isStorefrontCategoryHidden(item.slug))
}
