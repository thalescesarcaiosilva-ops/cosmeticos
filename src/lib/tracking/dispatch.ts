import { createAdminClient } from '@/lib/supabase/admin'
import { recordWebhookEvent } from '@/lib/checkout/create-order'
import { sendOrderShippedEmail } from '@/lib/email/order-shipped'
import { buildTrackingRoute } from '@/lib/tracking/build-route'
import { generateTrackingCode } from '@/lib/tracking/generate-code'
import { TRACKING_CARRIER } from '@/lib/tracking/types'

type ShippingAddress = {
  city?: string
  state?: string
}

function readShippingAddress(value: unknown): ShippingAddress {
  if (!value || typeof value !== 'object') return {}
  const address = value as ShippingAddress
  return {
    city: typeof address.city === 'string' ? address.city : undefined,
    state: typeof address.state === 'string' ? address.state : undefined,
  }
}

async function allocateTrackingCode(
  admin: ReturnType<typeof createAdminClient>
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateTrackingCode()
    const { data } = await admin
      .from('orders')
      .select('id')
      .eq('tracking_code', code)
      .maybeSingle()
    if (!data) return code
  }
  return `${generateTrackingCode()}${Date.now().toString().slice(-2)}`
}

export async function dispatchOrderTracking(
  orderId: string,
  options?: { sendEmail?: boolean; force?: boolean }
): Promise<{ ok: boolean; trackingCode?: string; reason?: string }> {
  const admin = createAdminClient()
  const sendEmail = options?.sendEmail !== false

  const { data: order, error } = await admin
    .from('orders')
    .select(
      `id, status, payment_status, tracking_code, customer_email, customer_name,
       shipping_address, shipping_method_name, shipping_method_id`
    )
    .eq('id', orderId)
    .maybeSingle()

  if (error || !order) {
    return { ok: false, reason: 'order_not_found' }
  }

  if (order.tracking_code && !options?.force) {
    if (order.status !== 'shipped' && order.status !== 'delivered' && order.status !== 'cancelled') {
      await admin.from('orders').update({ status: 'shipped' }).eq('id', orderId)
    }
    return { ok: true, trackingCode: order.tracking_code, reason: 'already_dispatched' }
  }

  if (['cancelled', 'delivered'].includes(order.status) && !options?.force) {
    return { ok: false, reason: 'invalid_status' }
  }

  const address = readShippingAddress(order.shipping_address)

  let estimatedDaysMin: number | null = null
  let estimatedDaysMax: number | null = null
  if (order.shipping_method_id) {
    const { data: method } = await admin
      .from('shipping_methods')
      .select('estimated_days_min, estimated_days_max')
      .eq('id', order.shipping_method_id)
      .maybeSingle()
    estimatedDaysMin = method?.estimated_days_min ?? null
    estimatedDaysMax = method?.estimated_days_max ?? null
  }

  const shippedAt = new Date()
  const trackingCode = order.tracking_code || (await allocateTrackingCode(admin))
  const planned = buildTrackingRoute({
    destinationCity: address.city || 'Destino',
    destinationState: address.state || 'BA',
    shippedAt,
    estimatedDaysMin,
    estimatedDaysMax,
  })
  await admin.from('tracking_events').delete().eq('order_id', orderId)

  const { error: eventsError } = await admin.from('tracking_events').insert(
    planned.map((event) => ({
      order_id: orderId,
      sequence: event.sequence,
      event_type: event.eventType,
      city: event.city,
      state: event.state,
      message: event.message,
      scheduled_at: event.scheduledAt.toISOString(),
      occurred_at: event.occurImmediately ? shippedAt.toISOString() : null,
      is_manual: false,
    }))
  )

  if (eventsError) {
    return { ok: false, reason: eventsError.message }
  }

  const { error: updateError } = await admin
    .from('orders')
    .update({
      status: 'shipped',
      tracking_code: trackingCode,
      carrier: TRACKING_CARRIER,
      shipped_at: shippedAt.toISOString(),
      delivered_at: null,
      tracking_simulation_paused: false,
    })
    .eq('id', orderId)

  if (updateError) {
    return { ok: false, reason: updateError.message }
  }

  if (sendEmail && order.customer_email?.trim()) {
    const dedupe = await recordWebhookEvent({
      eventId: `order-shipped-email:${orderId}:${trackingCode}`,
      orderId,
      payload: { source: 'dispatch_order_tracking', trackingCode },
    }).catch(() => true)

    if (dedupe) {
      const sent = await sendOrderShippedEmail({
        orderId,
        customerEmail: order.customer_email,
        customerName: order.customer_name,
        trackingCode,
        shippingMethodName: order.shipping_method_name,
        destinationCity: address.city ?? null,
        destinationState: address.state ?? null,
      })
      if (!sent.ok && process.env.NODE_ENV !== 'production') {
        console.error('[order-shipped-email]', sent.reason)
      }
    }
  }

  return { ok: true, trackingCode }
}
