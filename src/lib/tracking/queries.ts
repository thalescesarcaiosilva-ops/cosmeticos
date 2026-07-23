import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeTrackingCode } from '@/lib/tracking/generate-code'
import type { TrackingEventRow } from '@/lib/tracking/types'

export type PublicTrackingResult = {
  trackingCode: string
  status: string
  carrier: string | null
  shippedAt: string | null
  deliveredAt: string | null
  destinationCity: string | null
  destinationState: string | null
  events: Array<{
    id: string
    sequence: number
    eventType: TrackingEventRow['event_type']
    city: string
    state: string
    message: string
    scheduledAt: string
    occurredAt: string | null
    isManual: boolean
  }>
}

function mapEvents(rows: TrackingEventRow[]) {
  return rows.map((event) => ({
    id: event.id,
    sequence: event.sequence,
    eventType: event.event_type,
    city: event.city,
    state: event.state,
    message: event.message,
    scheduledAt: event.scheduled_at,
    occurredAt: event.occurred_at,
    isManual: event.is_manual,
  }))
}

export async function getTrackingByCode(
  code: string
): Promise<PublicTrackingResult | null> {
  const trackingCode = normalizeTrackingCode(code)
  if (!trackingCode) return null

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select(
      'id, status, tracking_code, carrier, shipped_at, delivered_at, shipping_address'
    )
    .eq('tracking_code', trackingCode)
    .maybeSingle()

  if (!order?.tracking_code) return null

  const { data: events } = await admin
    .from('tracking_events')
    .select(
      'id, order_id, sequence, event_type, city, state, message, scheduled_at, occurred_at, is_manual, created_at'
    )
    .eq('order_id', order.id)
    .not('occurred_at', 'is', null)
    .order('sequence', { ascending: true })

  const address =
    order.shipping_address && typeof order.shipping_address === 'object'
      ? (order.shipping_address as { city?: string; state?: string })
      : null

  return {
    trackingCode: order.tracking_code,
    status: order.status,
    carrier: order.carrier,
    shippedAt: order.shipped_at,
    deliveredAt: order.delivered_at,
    destinationCity: address?.city ?? null,
    destinationState: address?.state ?? null,
    events: mapEvents((events ?? []) as TrackingEventRow[]),
  }
}

export async function getTrackingEventsForOrderIds(
  orderIds: string[]
): Promise<Record<string, TrackingEventRow[]>> {
  if (!orderIds.length) return {}
  const admin = createAdminClient()
  const { data } = await admin
    .from('tracking_events')
    .select(
      'id, order_id, sequence, event_type, city, state, message, scheduled_at, occurred_at, is_manual, created_at'
    )
    .in('order_id', orderIds)
    .order('sequence', { ascending: true })

  const map: Record<string, TrackingEventRow[]> = {}
  for (const row of (data ?? []) as TrackingEventRow[]) {
    if (!map[row.order_id]) map[row.order_id] = []
    map[row.order_id]!.push(row)
  }
  return map
}
