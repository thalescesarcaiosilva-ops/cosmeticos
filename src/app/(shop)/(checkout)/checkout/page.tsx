import type { Metadata } from 'next'
import { CheckoutView } from '@/components/checkout/CheckoutView'
import { getSiteLayoutData } from '@/lib/layout/get-site-layout-data'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Checkout',
  description: 'Finalize sua compra com endereço, frete e pagamento seguro.',
  path: '/checkout',
  noindex: true,
})

export default async function CheckoutPage() {
  const layoutData = await getSiteLayoutData()

  return <CheckoutView storeName={layoutData.storeName} logo={layoutData.logo} />
}
