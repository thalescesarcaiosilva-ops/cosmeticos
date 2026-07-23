import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchOrderTracking } from '@/lib/tracking/dispatch'
import type { TrackingEventRow } from '@/lib/tracking/types'

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

function startOfUtcDay(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    .toISOString()
    .slice(0, 10)
}

async function markEventOccurred(
  admin: ReturnType<typeof createAdminClient>,
  event: Pick<TrackingEventRow, 'id' | 'event_type' | 'order_id'>,
  occurredAt: Date
) {
  await admin
    .from('tracking_events')
    .update({ occurred_at: occurredAt.toISOString() })
    .eq('id', event.id)

  if (event.event_type === 'delivered') {
    await admin
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: occurredAt.toISOString(),
      })
      .eq('id', event.order_id)
  }
}

export async function advanceDueTrackingEvents(now = new Date()): Promise<{
  advanced: number
  delivered: number
}> {
  const admin = createAdminClient()
  const { data: dueEvents, error } = await admin
    .from('tracking_events')
    .select('id, order_id, sequence, event_type, city, state, scheduled_at, occurred_at')
    .is('occurred_at', null)
    .lte('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(200)

  if (error || !dueEvents?.length) {
    return { advanced: 0, delivered: 0 }
  }

  const orderIds = [...new Set(dueEvents.map((event) => event.order_id))]
  const { data: orders } = await admin
    .from('orders')
    .select('id, status, tracking_simulation_paused')
    .in('id', orderIds)

  const orderMap = new Map((orders ?? []).map((order) => [order.id, order]))
  const advancedToday = new Map<string, boolean>()
  let advanced = 0
  let delivered = 0

  for (const event of dueEvents) {
    const order = orderMap.get(event.order_id)
    if (!order) continue
    if (order.tracking_simulation_paused) continue
    if (order.status === 'cancelled') continue

    // No máximo uma chegada de cidade (hub) por dia por pedido
    if (event.event_type === 'arrived_hub') {
      const dayKey = `${event.order_id}:${startOfUtcDay(now)}`
      if (advancedToday.get(dayKey)) continue

      const dayStart = `${startOfUtcDay(now)}T00:00:00.000Z`
      const dayEnd = `${startOfUtcDay(now)}T23:59:59.999Z`
      const { data: sameDayHub } = await admin
        .from('tracking_events')
        .select('id')
        .eq('order_id', event.order_id)
        .eq('event_type', 'arrived_hub')
        .not('occurred_at', 'is', null)
        .gte('occurred_at', dayStart)
        .lte('occurred_at', dayEnd)
        .limit(1)

      if (sameDayHub?.length) {
        advancedToday.set(dayKey, true)
        continue
      }
      advancedToday.set(dayKey, true)
    }

    // Só avança o próximo evento pendente na sequência
    const { data: earlierPending } = await admin
      .from('tracking_events')
      .select('id')
      .eq('order_id', event.order_id)
      .is('occurred_at', null)
      .lt('sequence', event.sequence)
      .limit(1)

    if (earlierPending?.length) continue

    await markEventOccurred(admin, event, now)
    advanced += 1
    if (event.event_type === 'delivered') delivered += 1
  }

  return { advanced, delivered }
}

export async function dispatchEligibleOrders(now = new Date()): Promise<{
  dispatched: number
  errors: number
}> {
  const admin = createAdminClient()
  const cutoff = new Date(now.getTime() - TWO_DAYS_MS).toISOString()

  const { data: orders, error } = await admin
    .from('orders')
    .select('id')
    .eq('status', 'confirmed')
    .is('tracking_code', null)
    .lte('created_at', cutoff)
    .neq('payment_status', 'refused')
    .limit(100)

  if (error || !orders?.length) {
    return { dispatched: 0, errors: 0 }
  }

  let dispatched = 0
  let errors = 0

  for (const order of orders) {
    const result = await dispatchOrderTracking(order.id)
    if (result.ok && result.reason !== 'already_dispatched') dispatched += 1
    else if (!result.ok) errors += 1
  }

  return { dispatched, errors }
}

export async function runTrackingCron(now = new Date()) {
  const dispatchResult = await dispatchEligibleOrders(now)
  const advanceResult = await advanceDueTrackingEvents(now)
  return { ...dispatchResult, ...advanceResult }
}

export async function advanceNextTrackingEvent(
  orderId: string
): Promise<{ ok: boolean; reason?: string }> {
  const admin = createAdminClient()
  const { data: event } = await admin
    .from('tracking_events')
    .select('id, order_id, sequence, event_type')
    .eq('order_id', orderId)
    .is('occurred_at', null)
    .order('sequence', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!event) return { ok: false, reason: 'no_pending_events' }

  await markEventOccurred(admin, event, new Date())
  return { ok: true }
}

export async function registerManualTrackingLocation(params: {
  orderId: string
  city: string
  state: string
  message?: string
}): Promise<{ ok: boolean; reason?: string }> {
  const admin = createAdminClient()
  const city = params.city.trim()
  const state = params.state.trim().toUpperCase().slice(0, 2)

  if (!city || state.length !== 2) {
    return { ok: false, reason: 'invalid_location' }
  }

  const { data: last } = await admin
    .from('tracking_events')
    .select('sequence')
    .eq('order_id', params.orderId)
    .order('sequence', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: nextPending } = await admin
    .from('tracking_events')
    .select('sequence')
    .eq('order_id', params.orderId)
    .is('occurred_at', null)
    .order('sequence', { ascending: true })
    .limit(1)
    .maybeSingle()

  const sequence = nextPending?.sequence ?? (last?.sequence ?? 0) + 1
  const now = new Date()
  const message =
    params.message?.trim() ||
    `Chegou ao centro de distribuição de ${city}/${state}`

  // Empurra eventos futuros para manter a ordem
  if (nextPending) {
    const { data: pending } = await admin
      .from('tracking_events')
      .select('id, sequence')
      .eq('order_id', params.orderId)
      .gte('sequence', nextPending.sequence)
      .order('sequence', { ascending: false })

    for (const row of pending ?? []) {
      await admin
        .from('tracking_events')
        .update({ sequence: row.sequence + 1 })
        .eq('id', row.id)
    }
  }

  const { error } = await admin.from('tracking_events').insert({
    order_id: params.orderId,
    sequence,
    event_type: 'arrived_hub',
    city,
    state,
    message,
    scheduled_at: now.toISOString(),
    occurred_at: now.toISOString(),
    is_manual: true,
  })

  if (error) return { ok: false, reason: error.message }

  await admin
    .from('orders')
    .update({ status: 'shipped', tracking_simulation_paused: false })
    .eq('id', params.orderId)
    .in('status', ['confirmed', 'pending', 'shipped'])

  return { ok: true }
}

export async function completeTrackingAsDelivered(
  orderId: string
): Promise<{ ok: boolean; reason?: string }> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  await admin
    .from('tracking_events')
    .update({ occurred_at: now })
    .eq('order_id', orderId)
    .is('occurred_at', null)

  const { error } = await admin
    .from('orders')
    .update({
      status: 'delivered',
      delivered_at: now,
    })
    .eq('id', orderId)

  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}

export async function setTrackingSimulationPaused(
  orderId: string,
  paused: boolean
): Promise<{ ok: boolean; reason?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('orders')
    .update({ tracking_simulation_paused: paused })
    .eq('id', orderId)

  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}
