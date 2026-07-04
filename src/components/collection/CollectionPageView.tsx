import Link from 'next/link'
import { CollectionBanner } from '@/components/collection/CollectionBanner'
import { CollectionCatalog } from '@/components/collection/CollectionCatalog'
import type { InstallmentDisplay } from '@/types/payment'
import type { ProductCardData } from '@/types/product'
import type { CollectionDetail, CollectionFilterMeta } from '@/types/collection'

type CollectionPageViewProps = {
  collection: CollectionDetail
  products: ProductCardData[]
  total: number
  page: number
  hasMore: boolean
  meta: CollectionFilterMeta
  installments: Map<string, InstallmentDisplay | null>
  searchParams: Record<string, string | undefined>
}

export function CollectionPageView({
  collection,
  products,
  total,
  page,
  hasMore,
  meta,
  installments,
  searchParams,
}: CollectionPageViewProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <nav className="mb-4 text-sm text-text-secondary" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text-primary">{collection.name}</span>
      </nav>

      <CollectionBanner collection={collection} />

      <header className="mb-8 max-w-5xl">
        <h1 className="text-xl font-bold text-text-primary md:text-lg">{collection.pageTitle}</h1>
        {collection.description && (
          <p className="mt-3 text-sm leading-relaxed text-text-secondary md:text-sm">
            {collection.description}
          </p>
        )}
      </header>

      <CollectionCatalog
        slug={collection.slug}
        products={products}
        total={total}
        page={page}
        hasMore={hasMore}
        meta={meta}
        installments={installments}
        searchParams={searchParams}
      />
    </div>
  )
}
