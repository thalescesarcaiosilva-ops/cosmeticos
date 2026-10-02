import { createAdminClient } from '@/lib/supabase/admin'
import {
  getTrackingByCode as getTrack7ByCode,
  getTrackingByOrderId as getTrack7ByOrderId,
  isTrack7Configured,
  parseTrack7DateToIso,
  Track7Error,
  type Track7TrackingResult,
} from '@/lib/track7/client'
import { getTrackingByCode as getLocalTrackingByCode } from '@/lib/tracking/queries'
import type { PublicTrackingResult } from '@/lib/tracking/queries'
import { normalizeTrackingCode } from '@/lib/tracking/generate-code'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function looksLikeOrderId(value: string): boolean {
  return UUID_RE.test(value.trim())
}

function mapTrack7StatusToOrderStatus(status: string | null): string {
  const normalized = (status ?? '').toLowerCase()
  if (!normalized) return 'shipped'
  if (normalized.includes('entreg') || normalized.includes('deliver')) {
    return 'delivered'
  }
  if (
    normalized.includes('cancel') ||
    normalized.includes('devol') ||
    normalized.includes('return')
  ) {
    return 'cancelled'
  }
  return 'shipped'
}

function mapTrack7EventType(status: string, description: string): string {
  const text = `${status} ${description}`.toLowerCase()
  if (text.includes('entreg') || text.includes('deliver')) return 'delivered'
  if (
    text.includes('saiu') ||
    text.includes('out for') ||
    text.includes('rota de entrega') ||
    text.includes('para entrega')
  ) {
    return 'out_for_delivery'
  }
  if (
    text.includes('destino') ||
    text.includes('tratamento regional') ||
    text.includes('cidade de destino') ||
    text.includes('unidade de tratamento')
  ) {
    return 'arrived_hub'
  }
  if (text.includes('colet')) return 'departed'
  if (text.includes('postad')) return 'packed'
  if (
    text.includes('movimento') ||
    text.includes('trâns') ||
    text.includes('transito') ||
    text.includes('trânsito') ||
    text.includes('hub') ||
    text.includes('centro') ||
    text.includes('logística')
  ) {
    return 'in_transit'
  }
  return 'in_transit'
}

function parseLocation(location: string): { city: string; state: string } {
  const trimmed = location.trim()
  if (!trimmed) return { city: '—', state: '--' }
  const match = trimmed.match(/^(.+?)[\/\-–—]\s*([A-Za-z]{2})$/)
  if (match) {
    return { city: match[1]!.trim() || '—', state: match[2]!.toUpperCase() }
  }
  // UF sozinha (ex.: "DF")
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return { city: trimmed.toUpperCase(), state: trimmed.toUpperCase() }
  }
  return { city: trimmed, state: '--' }
}

function eventTimeMs(date: string): number {
  const iso = parseTrack7DateToIso(date)
  if (iso) {
    const ms = Date.parse(iso)
    if (Number.isFinite(ms)) return ms
  }
  const ms = Date.parse(date)
  return Number.isFinite(ms) ? ms : 0
}

export function mapTrack7ToPublicResult(
  tracking: Track7TrackingResult,
  extras?: {
    carrier?: string | null
    shippedAt?: string | null
    deliveredAt?: string | null
    destinationCity?: string | null
    destinationState?: string | null
  }
): PublicTrackingResult {
  const current = tracking.current_status ?? tracking.status
  const sorted = [...tracking.events].sort(
    (a, b) => eventTimeMs(b.date) - eventTimeMs(a.date)
  )
  const total = sorted.length
  const events = sorted.map((event, index) => {
    const { city, state } = parseLocation(event.location)
    const occurredAt = parseTrack7DateToIso(event.date) ?? (event.date || null)
    const statusLabel = event.status?.trim() || null
    const description = event.description?.trim() || statusLabel || 'Atualização'
    return {
      id: `track7-${index}-${occurredAt ?? 'na'}`,
      sequence: total - index,
      eventType: mapTrack7EventType(event.status, event.description),
      city,
      state,
      message: description,
      statusLabel,
      scheduledAt: occurredAt ?? new Date(0).toISOString(),
      occurredAt,
      isManual: false,
    }
  })

  const orderStatus = mapTrack7StatusToOrderStatus(current)
  const firstOccurred =
    events.find((event) => event.occurredAt)?.occurredAt ?? null

  return {
    trackingCode: tracking.tracking_code ?? '',
    status: orderStatus,
    carrier: extras?.carrier ?? 'Track7',
    shippedAt: extras?.shippedAt ?? firstOccurred,
    deliveredAt:
      extras?.deliveredAt ??
      (orderStatus === 'delivered' ? events[0]?.occurredAt ?? null : null),
    destinationCity: extras?.destinationCity ?? null,
    destinationState: extras?.destinationState ?? null,
    events,
    source: 'track7',
    currentStatus: current || 'Aguardando atualização',
    hasEvents: events.length > 0,
  }
}

async function loadOrderById(orderId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('orders')
    .select(
      `id, status, tracking_code, carrier, shipped_at, delivered_at,
       shipping_address, track7_synced_at, track7_last_status`
    )
    .eq('id', orderId)
    .maybeSingle()
  return data
}

async function loadOrderByTrackingCode(code: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('orders')
    .select(
      `id, status, tracking_code, carrier, shipped_at, delivered_at,
       shipping_address, track7_synced_at, track7_last_status`
    )
    .eq('tracking_code', code)
    .maybeSingle()
  return data
}

function addressBits(shippingAddress: unknown) {
  if (!shippingAddress || typeof shippingAddress !== 'object') {
    return { city: null as string | null, state: null as string | null }
  }
  const address = shippingAddress as { city?: string; state?: string }
  return {
    city: address.city ?? null,
    state: address.state ?? null,
  }
}

function withLocalSource(result: PublicTrackingResult): PublicTrackingResult {
  return {
    ...result,
    source: result.source ?? 'local',
    currentStatus: result.currentStatus ?? null,
    hasEvents: result.hasEvents ?? result.events.length > 0,
  }
}

async function touchTrack7LastStatus(
  orderId: string | null | undefined,
  status: string | null | undefined
) {
  if (!orderId || !status) return
  try {
    const admin = createAdminClient()
    await admin
      .from('orders')
      .update({ track7_last_status: status })
      .eq('id', orderId)
  } catch {
    // ignore persistence errors on lookup
  }
}

type Track7LookupExtras = {
  carrier?: string | null
  shippedAt?: string | null
  deliveredAt?: string | null
  destinationCity?: string | null
  destinationState?: string | null
  trackingCode?: string | null
  orderId?: string | null
}

function orderUsesTrack7(order: {
  track7_synced_at?: string | null
  carrier?: string | null
} | null | undefined): boolean {
  if (!order) return false
  return Boolean(order.track7_synced_at) || order.carrier === 'Track7'
}

async function tryTrack7ByCode(
  code: string,
  orderExtras?: Track7LookupExtras
): Promise<PublicTrackingResult | null> {
  if (!isTrack7Configured()) return null
  try {
    const tracking = await getTrack7ByCode(code)
    if (!tracking.tracking_code && !tracking.events.length) return null
    if (!tracking.tracking_code) tracking.tracking_code = code
    const result = mapTrack7ToPublicResult(tracking, orderExtras)
    await touchTrack7LastStatus(orderExtras?.orderId, result.currentStatus)
    return result
  } catch (error) {
    if (error instanceof Track7Error && error.code === 'NOT_FOUND') return null
    throw error
  }
}

async function tryTrack7ByOrderId(
  orderId: string,
  orderExtras?: Track7LookupExtras
): Promise<PublicTrackingResult | null> {
  if (!isTrack7Configured()) return null
  try {
    const tracking = await getTrack7ByOrderId(orderId)
    if (!tracking.tracking_code && orderExtras?.trackingCode) {
      tracking.tracking_code = orderExtras.trackingCode
    }
    if (!tracking.tracking_code && !tracking.events.length) return null
    const result = mapTrack7ToPublicResult(tracking, orderExtras)
    await touchTrack7LastStatus(orderId, result.currentStatus)
    return result
  } catch (error) {
    if (error instanceof Track7Error && error.code === 'NOT_FOUND') {
      if (orderExtras?.trackingCode) {
        return tryTrack7ByCode(orderExtras.trackingCode, {
          ...orderExtras,
          orderId,
        })
      }
      return null
    }
    throw error
  }
}

/**
 * Resolve rastreio priorizando sempre a Track7 quando o pedido usa Track7.
 * Simulação local só entra se a Track7 não tiver dados.
 */
export async function resolvePublicTracking(params: {
  code?: string | null
  orderId?: string | null
}): Promise<PublicTrackingResult | null> {
  const orderId = params.orderId?.trim() || null
  const rawCode = params.code?.trim() || null

  if (orderId || (rawCode && looksLikeOrderId(rawCode))) {
    const id = orderId ?? rawCode!
    const order = await loadOrderById(id)
    if (!order) return null

    const dest = addressBits(order.shipping_address)
    const extras: Track7LookupExtras = {
      carrier: order.carrier,
      shippedAt: order.shipped_at,
      deliveredAt: order.delivered_at,
      destinationCity: dest.city,
      destinationState: dest.state,
      trackingCode: order.tracking_code,
      orderId: order.id,
    }

    if (orderUsesTrack7(order) || isTrack7Configured()) {
      const fromTrack7 = await tryTrack7ByOrderId(order.id, extras)
      if (fromTrack7) return fromTrack7
      if (order.tracking_code) {
        const byCode = await tryTrack7ByCode(order.tracking_code, extras)
        if (byCode) return byCode
      }
    }

    if (order.tracking_code) {
      const local = await getLocalTrackingByCode(order.tracking_code)
      if (local) return withLocalSource(local)
    }

    return null
  }

  if (!rawCode) return null

  const normalized = normalizeTrackingCode(rawCode) || rawCode.toUpperCase()
  const order = await loadOrderByTrackingCode(normalized)
  const extras: Track7LookupExtras = {
    carrier: order?.carrier ?? 'Track7',
    shippedAt: order?.shipped_at ?? null,
    deliveredAt: order?.delivered_at ?? null,
    destinationCity: addressBits(order?.shipping_address).city,
    destinationState: addressBits(order?.shipping_address).state,
    trackingCode: order?.tracking_code ?? normalized,
    orderId: order?.id ?? null,
  }

  // Track7 primeiro — nunca preferir eventos locais simulados sobre a API.
  if (isTrack7Configured()) {
    const fromTrack7 = await tryTrack7ByCode(normalized, extras)
    if (fromTrack7) return fromTrack7
    if (order?.id) {
      const byOrder = await tryTrack7ByOrderId(order.id, extras)
      if (byOrder) return byOrder
    }
  }

  const local = await getLocalTrackingByCode(normalized)
  if (local) return withLocalSource(local)
  return null
}
