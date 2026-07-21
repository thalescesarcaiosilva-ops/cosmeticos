import type { Metadata } from 'next'
import { AboutView } from '@/components/about/AboutView'
import { storeContent } from '@/lib/store-content/content'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { buildOpeningHoursSchedule } from '@/lib/store-profile/format'
import { getStoreProfile } from '@/lib/store-profile/queries'
import { createPublicClient, isSupabasePublicConfigured } from '@/lib/supabase/public'

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: 'Quem somos | Batista Cosméticos',
    description: storeContent.about.sobre.paragraphs[0],
    path: '/paginas/quem-somos',
  })
}

export default async function QuemSomosPage() {
  let openingHours = null
  if (isSupabasePublicConfigured()) {
    const profile = await getStoreProfile(createPublicClient())
    if (profile && profile.store_opening_hours.length > 0) {
      openingHours = buildOpeningHoursSchedule(profile.store_opening_hours)
    }
  }

  return <AboutView openingHours={openingHours} />
}
