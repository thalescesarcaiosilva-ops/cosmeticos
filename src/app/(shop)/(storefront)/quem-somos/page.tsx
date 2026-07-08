import type { Metadata } from 'next'
import { AboutView } from '@/components/about/AboutView'
import { storeContent } from '@/lib/store-content/content'
import { buildPageMetadata } from '@/lib/seo/metadata'

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: 'Quem somos | Batista Cosméticos',
    description: storeContent.about.hero.description,
    path: '/quem-somos',
  })
}

export default function QuemSomosPage() {
  return <AboutView />
}
