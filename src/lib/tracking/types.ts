export const TRACKING_ORIGIN = {
  city: 'Salvador',
  state: 'BA',
} as const

export const TRACKING_CARRIER = 'Batista Logística'

export type TrackingEventType =
  | 'packed'
  | 'departed'
  | 'in_transit'
  | 'arrived_hub'
  | 'out_for_delivery'
  | 'delivered'

export type TrackingHub = {
  city: string
  state: string
}

export type PlannedTrackingEvent = {
  sequence: number
  eventType: TrackingEventType
  city: string
  state: string
  message: string
  scheduledAt: Date
  /** Se true, já marca como ocorrido no despacho */
  occurImmediately?: boolean
}

export type TrackingEventRow = {
  id: string
  order_id: string
  sequence: number
  event_type: TrackingEventType
  city: string
  state: string
  message: string
  scheduled_at: string
  occurred_at: string | null
  is_manual: boolean
  created_at: string
}

export const TRACKING_EVENT_LABELS: Record<TrackingEventType, string> = {
  packed: 'Embalado',
  departed: 'Despachado',
  in_transit: 'Em transporte',
  arrived_hub: 'Centro de distribuição',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
}
