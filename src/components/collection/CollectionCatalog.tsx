import Link from 'next/link'
import { CollectionFilters, CollectionFiltersMobile } from '@/components/collection/CollectionFilters'
import { ProductGrid } from '@/components/product/ProductGrid'
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

function buildPageHref(
  slug: string,
  searchParams: Record<string, string | undefined>,
  page: number
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== 'page') params.set(key, value)
  }
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `/colecoes/${slug}?${qs}` : `/colecoes/${slug}`
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
  const itemLabel = total === 1 ? 'item encontrado' : 'itens encontrados'

  return (
    <section aria-label="Catálogo de produtos">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-logo">
          {total} {itemLabel}
        </p>
        <CollectionFiltersMobile meta={meta} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
        <CollectionFilters meta={meta} className="hidden lg:block lg:sticky lg:top-24 lg:self-start" />

        <div>
          <ProductGrid
            products={products}
            installments={installments}
            emptyMessage="Nenhum produto encontrado com os filtros selecionados."
          />

          {(page > 1 || hasMore) && (
            <nav
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
              aria-label="Paginação"
            >
              {page > 1 && (
                <Link
                  href={buildPageHref(slug, searchParams, page - 1)}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-logo"
                >
                  Anterior
                </Link>
              )}
              <span className="text-sm text-text-secondary">Página {page}</span>
              {hasMore && (
                <Link
                  href={buildPageHref(slug, searchParams, page + 1)}
                  className="rounded-lg bg-logo px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Carregar mais
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </section>
  )
}
