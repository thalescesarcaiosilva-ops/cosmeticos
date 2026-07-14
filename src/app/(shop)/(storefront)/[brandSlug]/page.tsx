import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductGrid } from '@/components/product/ProductGrid'
import { JsonLd } from '@/components/seo/JsonLd'
import { getBrandBySlug, getBrandProducts } from '@/lib/brands/queries'
import { buildInstallmentMap } from '@/lib/payment/build-installment-map'
import { getPaymentSettings } from '@/lib/payment/queries'
import { buildBreadcrumbJsonLd } from '@/lib/seo/json-ld/breadcrumb'
import { buildPageMetadata } from '@/lib/seo/metadata'

type BrandPageProps = {
  params: Promise<{ brandSlug: string }>
}

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { brandSlug } = await params
  const brand = await getBrandBySlug(brandSlug)
  if (!brand) return { title: 'Marca não encontrada', robots: { index: false } }

  return buildPageMetadata({
    title: brand.name,
    description: `Produtos ${brand.name} na Batista Cosméticos. Confira a linha completa.`,
    path: `/${brand.slug}`,
  })
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { brandSlug } = await params
  const brand = await getBrandBySlug(brandSlug)
  if (!brand) notFound()

  const [products, paymentSettings] = await Promise.all([
    getBrandProducts(brand.id),
    getPaymentSettings(),
  ])

  const installments = buildInstallmentMap(products, paymentSettings)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Início', path: '/' },
    { name: brand.name },
  ])

  return (
    <>
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

        <h1 className="text-2xl font-bold text-text-primary md:text-3xl">{brand.name}</h1>
        <p className="mt-2 text-sm text-text-secondary">
          {products.length} produto{products.length === 1 ? '' : 's'}
        </p>

        {products.length === 0 ? (
          <p className="mt-6 text-text-secondary">
            Nenhum produto encontrado para esta marca.{' '}
            <Link href="/" className="text-brand hover:underline">
              Voltar à loja
            </Link>
            .
          </p>
        ) : (
          <div className="mt-6">
            <ProductGrid products={products} installments={installments} />
          </div>
        )}
      </div>
    </>
  )
}
