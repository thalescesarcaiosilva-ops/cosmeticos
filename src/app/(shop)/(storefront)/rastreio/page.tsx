import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TrackingPageView } from '@/components/tracking/TrackingPageView'
import { buildPageMetadata } from '@/lib/seo/metadata'

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: 'Rastreio de pedido',
    description:
      'Acompanhe o status e o caminho do seu pedido com o código de rastreio da Batista Cosméticos.',
    path: '/rastreio',
  })
}

export default function RastreioPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-14 text-center text-sm text-text-secondary">
          Carregando rastreio…
        </div>
      }
    >
      <TrackingPageView />
    </Suspense>
  )
}
