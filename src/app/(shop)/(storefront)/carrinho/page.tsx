import type { Metadata } from 'next'
import { CartPageView } from '@/components/cart/CartPageView'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Carrinho',
  description: 'Revise os itens do seu carrinho antes de finalizar a compra.',
  path: '/carrinho',
  noindex: true,
})

export default function CartPage() {
  return <CartPageView />
}
