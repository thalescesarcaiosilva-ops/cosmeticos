import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { CatalogWithFilters } from '@/components/catalog/CatalogWithFilters'
import { JsonLd } from '@/components/seo/JsonLd'
import { getBrandBySlug, getBrandFilterMeta, getBrandProducts } from '@/lib/brands/queries'
import { buildInstallmentMap } from '@/lib/payment/build-installment-map'
import { getPaymentSettings } from '@/lib/payment/queries'
import { buildBreadcrumbJsonLd } from '@/lib/seo/json-ld/breadcrumb'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { collectionFiltersSchema } from '@/schemas/category-schema'

type BrandPageProps = {
  params: Promise<{ brandSlug: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

export async function generateMetadata({ params, searchParams }: BrandPageProps): Promise<Metadata> {
  const { brandSlug } = await params
  const rawParams = await searchParams
  const hasFilters = Object.keys(rawParams).some((key) => rawParams[key])

  const brand = await getBrandBySlug(brandSlug)
  if (!brand) return { title: 'Marca não encontrada', robots: { index: false } }

  return buildPageMetadata({
    title: brand.name,
    description: `Produtos ${brand.name} na Batista Cosméticos. Confira a linha completa.`,
    path: `/${brand.slug}`,
    noindex: hasFilters,
  })
}

export default async function BrandPage({ params, searchParams }: BrandPageProps) {
  const { brandSlug } = await params
  const rawParams = await searchParams
  const brand = await getBrandBySlug(brandSlug)
  if (!brand) notFound()

  const filters = collectionFiltersSchema.parse(rawParams)

  const [result, meta, paymentSettings] = await Promise.all([
    getBrandProducts(brand.id, filters),
    getBrandFilterMeta(brand.id),
    getPaymentSettings(),
  ])

  const installments = buildInstallmentMap(result.products, paymentSettings)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Início', path: '/' },
    { name: brand.name },
  ])

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl animate-pulse px-4 py-8 md:px-6">
          <div className="mb-4 h-8 w-1/3 rounded bg-surface-muted" />
          <div className="h-64 rounded bg-surface-muted" />
        </div>
      }
    >
      <JsonLd data={breadcrumbJsonLd} />
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <nav className="mb-6 text-sm text-text-secondary" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-1.5">
            <li>
              <Link href="/" className="hover:text-brand">
                Início
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li className="text-text-primary" aria-current="page">
              {brand.name}
            </li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary md:text-3xl">{brand.name}</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Produtos da marca {brand.name}
          </p>
        </header>

        <CatalogWithFilters
          basePath={`/${brand.slug}`}
          products={result.products}
          total={result.total}
          page={result.page}
          hasMore={result.hasMore}
          meta={meta}
          installments={installments}
          searchParams={rawParams}
          hideBrandFilter
        />
      </div>
    </Suspense>
  )
}
