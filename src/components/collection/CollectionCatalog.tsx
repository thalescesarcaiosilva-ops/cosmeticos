import { CatalogWithFilters } from '@/components/catalog/CatalogWithFilters'
import type { InstallmentDisplay } from '@/types/payment'
import type { ProductCardData } from '@/types/product'
import type { CollectionFilterMeta } from '@/types/collection'

type CollectionCatalogProps = {
  slug: string
  products: ProductCardData[]
  total: number
  page: number
  hasMore: boolean
  meta: CollectionFilterMeta
  installments: Map<string, InstallmentDisplay | null>
  searchParams: Record<string, string | undefined>
}

export function CollectionCatalog({
  slug,
  products,
  total,
  page,
  hasMore,
  meta,
  installments,
  searchParams,
}: CollectionCatalogProps) {
  return (
    <CatalogWithFilters
      basePath={`/colecoes/${slug}`}
      products={products}
      total={total}
      page={page}
      hasMore={hasMore}
      meta={meta}
      installments={installments}
      searchParams={searchParams}
    />
  )
}
