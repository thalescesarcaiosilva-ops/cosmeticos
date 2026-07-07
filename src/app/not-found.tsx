import { NotFoundContent } from '@/components/layout/NotFoundContent'
import { ShopShell } from '@/components/layout/ShopShell'

export const metadata = {
  title: 'Página não encontrada',
  robots: { index: false, follow: false },
}

export default async function NotFoundPage() {
  return (
    <ShopShell chrome="full">
      <NotFoundContent />
    </ShopShell>
  )
}
