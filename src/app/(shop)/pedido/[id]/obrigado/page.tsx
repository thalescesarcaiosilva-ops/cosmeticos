import type { Metadata } from 'next'
import { OrderThankYouView } from '@/components/checkout/OrderThankYouView'
import { buildPageMetadata } from '@/lib/seo/metadata'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  return buildPageMetadata({
    title: 'Pedido confirmado',
    description: 'Obrigado pela sua compra.',
    path: `/pedido/${id}/obrigado`,
    noindex: true,
  })
}

export default async function OrderThankYouPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { token } = await searchParams
  return <OrderThankYouView orderId={id} initialToken={token ?? null} />
}
