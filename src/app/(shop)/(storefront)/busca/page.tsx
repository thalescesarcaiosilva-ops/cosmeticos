import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductGrid } from '@/components/product/ProductGrid'
import { buildInstallmentMap } from '@/lib/payment/build-installment-map'
import { getPaymentSettings } from '@/lib/payment/queries'
import { searchProductsPage } from '@/lib/products/search'
import { buildPageMetadata } from '@/lib/seo/metadata'

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams
  const term = (q ?? '').trim()

  return buildPageMetadata({
    title: term ? `Busca: ${term}` : 'Buscar produtos',
    description: term
      ? `Resultados de busca para “${term}” na loja.`
      : 'Busque produtos por nome, marca ou categoria.',
    path: term ? `/busca?q=${encodeURIComponent(term)}` : '/busca',
    noindex: true,
  })
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  const term = (q ?? '').trim()

  const [products, paymentSettings] = await Promise.all([
    term.length >= 2 ? searchProductsPage(term) : Promise.resolve([]),
    getPaymentSettings(),
  ])

  const installments = buildInstallmentMap(products, paymentSettings)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <nav className="mb-6 text-sm text-text-secondary" aria-label="Breadcrumb">
        <p>
          <Link href="/" className="hover:text-brand">
            Início
          </Link>
          <span className="mx-2">›</span>
          <span className="text-text-primary">Busca</span>
        </p>
      </nav>

      <h1 className="text-2xl font-bold text-text-primary md:text-3xl">
        {term ? `Resultados para “${term}”` : 'Buscar produtos'}
      </h1>

      {term.length < 2 ? (
        <p className="mt-4 text-text-secondary">
          Digite ao menos 2 caracteres na busca do topo da página.
        </p>
      ) : products.length === 0 ? (
        <p className="mt-4 text-text-secondary">
          Nenhum produto encontrado. Tente outro termo ou navegue pelas{' '}
          <Link href="/" className="text-brand hover:underline">
            categorias
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-text-secondary">
            {products.length} produto{products.length === 1 ? '' : 's'} encontrado
            {products.length === 1 ? '' : 's'}
          </p>
          <div className="mt-6">
            <ProductGrid products={products} installments={installments} />
          </div>
        </>
      )}
    </div>
  )
}
