import { SiteHtmlSnippets } from '@/components/seo/HeadScripts'
import { getTrackingHtmlByPlacement } from '@/lib/seo/get-tracking-html'
import type { StoreProfile } from '@/lib/store-profile/queries'

type TrackingScriptsProps = {
  profile: Pick<StoreProfile, 'tracking_tags' | 'head_scripts'>
  placement: 'head' | 'body' | 'checkout'
}

export function TrackingScripts({ profile, placement }: TrackingScriptsProps) {
  const html = getTrackingHtmlByPlacement(
    profile.tracking_tags,
    placement,
    placement === 'head' ? profile.head_scripts : null
  )
  return <SiteHtmlSnippets html={html} />
}
