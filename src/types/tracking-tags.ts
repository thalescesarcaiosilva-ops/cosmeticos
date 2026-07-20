export const TRACKING_PLACEMENTS = ['head', 'body', 'checkout'] as const

export type TrackingPlacement = (typeof TRACKING_PLACEMENTS)[number]

export type TrackingTag = {
  id: string
  name: string
  placement: TrackingPlacement
  enabled: boolean
  html: string
}

export const TRACKING_PLACEMENT_LABELS: Record<TrackingPlacement, string> = {
  head: '<head> (todas as páginas)',
  body: '<body> (todas as páginas)',
  checkout: 'Checkout e página de obrigado',
}
