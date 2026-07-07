import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { CollectionPageView } from '@/components/collection/CollectionPageView'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  getCollectionBySlug,
  getCollectionFilterMeta,
  getCollectionProducts,
} from '@/lib/collections/queries'
import { buildInstallmentMap } from '@/lib/payment/build-installment-map'
import { getPaymentSettings } from '@/lib/payment/queries'
import { buildBreadcrumbJsonLd } from '@/lib/seo/json-ld/breadcrumb'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { collectionFiltersSchema } from '@/schemas/category-schema'

type CollectionPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

export async function generateMetadata({ params, searchParams }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params
  const rawParams = await searchParams
  const hasFilters = Object.keys(rawParams).some((key) => rawParams[key])

  const collection = await getCollectionBySlug(slug)
  if (!collection) return { title: 'Coleção', robots: { index: false } }

  const description =
    collection.description?.slice(0, 160) ?? `Confira os produtos da coleção ${collection.name}.`

  return buildPageMetadata({
    title: collection.pageTitle,
    description,
    path: `/colecoes/${slug}`,
    imageUrl: collection.bannerImageUrl ?? collection.imageUrl,
    imageAlt: collection.pageTitle,
    noindex: hasFilters,
  })
}

export default async function CollectionPage({ params, searchParams }: CollectionPageProps) {
  const { slug } = await params
  const rawParams = await searchParams

  const collection = await getCollectionBySlug(slug)
  if (!collection) notFound()

  const filters = collectionFiltersSchema.parse(rawParams)

  const [result, meta, paymentSettings] = await Promise.all([
    getCollectionProducts(collection.id, filters),
    getCollectionFilterMeta(collection.id),
    getPaymentSettings(),
  ])

  const installments = buildInstallmentMap(result.products, paymentSettings)

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Início', path: '/' },
    { name: collection.name, path: `/colecoes/${collection.slug}` },
  ])

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl animate-pulse px-4 py-8 md:px-6">
          <div className="mb-8 h-48 rounded-xl bg-surface-muted" />
          <div className="mb-4 h-8 w-2/3 rounded bg-surface-muted" />
          <div className="h-24 rounded bg-surface-muted" />
        </div>
      }
    >
      <JsonLd data={breadcrumbJsonLd} />
      <CollectionPageView
        collection={collection}
        products={result.products}
        total={result.total}
        page={result.page}
        hasMore={result.hasMore}
        meta={meta}
        installments={installments}
        searchParams={rawParams}
      />
    </Suspense>
  )
}
