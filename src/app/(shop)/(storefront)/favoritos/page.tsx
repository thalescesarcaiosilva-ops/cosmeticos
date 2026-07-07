import { FavoritesView } from '@/components/favorites/FavoritesView'
import { getPaymentSettings } from '@/lib/payment/queries'

export const metadata = {
  title: 'Meus favoritos',
  robots: { index: false, follow: false },
}

export default async function FavoritesPage() {
  const paymentSettings = await getPaymentSettings()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <h1 className="mb-2 text-2xl font-bold text-text-primary">Meus favoritos</h1>
      <p className="mb-8 text-sm text-text-secondary">
        Produtos que você salvou para comprar depois.
      </p>
      <FavoritesView paymentSettings={paymentSettings} />
    </div>
  )
}
