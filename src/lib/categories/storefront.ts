/** Categorias ocultas na vitrine (coleções, grid, filtros e sitemap). */
export const STOREFRONT_HIDDEN_CATEGORY_SLUGS = ['mamae-e-bebe'] as const

export function isStorefrontCategoryHidden(slug: string): boolean {
  return (STOREFRONT_HIDDEN_CATEGORY_SLUGS as readonly string[]).includes(slug)
}

export function filterStorefrontCategories<T extends { slug: string }>(items: T[]): T[] {
  return items.filter((item) => !isStorefrontCategoryHidden(item.slug))
}
