import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductPageView } from '@/components/product/ProductPageView'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildInstallmentMap } from '@/lib/payment/build-installment-map'
import { getCheckoutPaymentSettings, getPaymentIcons } from '@/lib/payment/queries'
import { getPaymentSettings } from '@/lib/payment/queries'
import { getProductBySlug, getRelatedProducts } from '@/lib/products/queries'
import { buildReviewSummary, getApprovedProductReviews } from '@/lib/products/reviews'
import { buildBreadcrumbJsonLd } from '@/lib/seo/json-ld/breadcrumb'
import { buildProductJsonLd } from '@/lib/seo/json-ld/product'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { getMerchantSeoContext } from '@/lib/seo/get-merchant-seo-context'

type ProductPageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: 'Produto não encontrado', robots: { index: false } }

  const title = product.meta_title ?? product.name
  const description =
    product.meta_description ?? product.description?.slice(0, 160) ?? undefined

  return buildPageMetadata({
    title,
    description,
    path: `/produto/${slug}`,
    imageUrl: product.images[0]?.url,
    imageAlt: product.images[0]?.alt ?? product.name,
    type: 'website',
  })
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const [product, paymentSettings, paymentIcons, checkoutSettings, merchantContext] =
    await Promise.all([
    getProductBySlug(slug),
    getPaymentSettings(),
    getPaymentIcons(),
    getCheckoutPaymentSettings(),
    getMerchantSeoContext(),
  ])

  if (!product) notFound()

  const categoryIds =
    product.product_categories?.map((pc) => pc.category_id).filter(Boolean) ?? []

  const relatedProducts = await getRelatedProducts(product.id, categoryIds)
  const approvedReviews = await getApprovedProductReviews(product.id)
  const reviewSummary = buildReviewSummary(approvedReviews)

  const relatedInstallments = buildInstallmentMap(relatedProducts, paymentSettings)

  const primaryCategory = product.categories[0] ?? null
  const breadcrumbItems = [
    { name: 'Início', path: '/' },
    ...(product.brandName ? [{ name: product.brandName }] : []),
    ...(primaryCategory
      ? [{ name: primaryCategory.name, path: `/colecoes/${primaryCategory.slug}` }]
      : []),
    { name: product.name },
  ]

  const productJsonLd = buildProductJsonLd(product, merchantContext)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbItems)
  const structuredData = [productJsonLd, breadcrumbJsonLd].filter(Boolean) as Record<
    string,
    unknown
  >[]

  return (
    <>
      <JsonLd data={structuredData.length > 0 ? structuredData : null} />
      <ProductPageView
        product={product}
        reviewSummary={reviewSummary}
        approvedReviews={approvedReviews}
        paymentSettings={paymentSettings}
        checkoutSettings={checkoutSettings}
        paymentIcons={paymentIcons}
        relatedProducts={relatedProducts}
        relatedInstallments={relatedInstallments}
      />
    </>
  )
}
