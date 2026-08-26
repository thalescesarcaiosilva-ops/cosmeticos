import type { Metadata } from 'next'
import { CartPageView } from '@/components/cart/CartPageView'
import { getCheckoutPaymentSettings, getPaymentSettings } from '@/lib/payment/queries'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Carrinho',
  description: 'Revise os itens do seu carrinho antes de finalizar a compra.',
  path: '/carrinho',
  noindex: true,
})

export default async function CartPage() {
  const [paymentSettings, checkoutSettings] = await Promise.all([
    getPaymentSettings(),
    getCheckoutPaymentSettings(),
  ])

  return (
    <CartPageView paymentSettings={paymentSettings} checkoutSettings={checkoutSettings} />
  )
}
