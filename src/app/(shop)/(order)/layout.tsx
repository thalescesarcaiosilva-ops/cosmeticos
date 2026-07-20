import { SiteLayout } from '@/components/layout/SiteLayout'
import { TrackingScripts } from '@/components/seo/TrackingScripts'
import { getPublicStoreProfile } from '@/lib/store-profile/public'

export default async function OrderShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getPublicStoreProfile()

  return (
    <SiteLayout chrome="minimal">
      {children}
      <TrackingScripts profile={profile} placement="checkout" />
    </SiteLayout>
  )
}
