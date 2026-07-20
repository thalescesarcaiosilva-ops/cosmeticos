import type { TrackingPlacement, TrackingTag } from '@/types/tracking-tags'

export function getTrackingHtmlByPlacement(
  tags: TrackingTag[] | null | undefined,
  placement: TrackingPlacement,
  legacyHeadScripts?: string | null
): string | null {
  const parts = (tags ?? [])
    .filter((tag) => tag.enabled && tag.placement === placement && tag.html.trim())
    .map((tag) => tag.html.trim())

  if (placement === 'head' && legacyHeadScripts?.trim()) {
    parts.unshift(legacyHeadScripts.trim())
  }

  return parts.length > 0 ? parts.join('\n') : null
}
