import type { Metadata } from 'next'
import { AboutView } from '@/components/about/AboutView'
import { storeContent } from '@/lib/store-content/content'
import { buildPageMetadata } from '@/lib/seo/metadata'

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: 'Quem somos | Batista Cosméticos',
    description: storeContent.about.sobre.paragraphs[0],
    path: '/paginas/quem-somos',
  })
}

export default function QuemSomosPage() {
  return <AboutView />
}
