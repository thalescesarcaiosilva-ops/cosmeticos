import type { Metadata } from 'next'
import { OrderThankYouView } from '@/components/checkout/OrderThankYouView'
import { listAdsConversionSendTos } from '@/lib/seo/analytics'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { getPublicStoreProfile } from '@/lib/store-profile/public'

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
  const profile = await getPublicStoreProfile()

  return (
    <OrderThankYouView
      orderId={id}
      initialToken={token ?? null}
      adsConversionSendTos={listAdsConversionSendTos(profile.tracking)}
    />
  )
}
