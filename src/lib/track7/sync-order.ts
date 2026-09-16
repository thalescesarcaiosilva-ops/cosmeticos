import { createAdminClient } from '@/lib/supabase/admin'
import {
  createTrack7Order,
  getTrackingByOrderId,
  isTrack7Configured,
  type Track7OrderPayload,
  Track7Error,
} from '@/lib/track7/client'

function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

function normalizePhone(raw: string | null | undefined): string | null {
  let phone = digitsOnly(raw)
  if (phone.startsWith('55') && phone.length >= 12) {
    phone = phone.slice(2)
  }
  if (phone.length < 10) return null
  return phone
}

function normalizeDocument(raw: string | null | undefined): string | null {
  const document = digitsOnly(raw)
  if (document.length < 11) return null
  return document
}

function readAddress(value: unknown): Track7OrderPayload['address'] | null {
  if (!value || typeof value !== 'object') return null
  const address = value as Record<string, unknown>
  const street = typeof address.street === 'string' ? address.street.trim() : ''
  const number = typeof address.number === 'string' ? address.number.trim() : ''
  const neighborhood =
    typeof address.neighborhood === 'string' ? address.neighborhood.trim() : ''
  const city = typeof address.city === 'string' ? address.city.trim() : ''
  const state =
    typeof address.state === 'string'
      ? address.state.trim().toUpperCase().slice(0, 2)
      : ''
  const zipcode = digitsOnly(
    typeof address.zip_code === 'string'
      ? address.zip_code
      : typeof address.zipcode === 'string'
        ? address.zipcode
        : ''
  )
  const complement =
    typeof address.complement === 'string' ? address.complement.trim() : null

  if (!street || !number || !neighborhood || !city || state.length !== 2 || !zipcode) {
    return null
  }

  return {
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    zipcode,
  }
}

type OrderRow = {
  id: string
  total: number | string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_document: string | null
  shipping_address: unknown
  tracking_code: string | null
  track7_synced_at: string | null
  order_items?: Array<{
    quantity?: number | null
    unit_price?: number | null
    products?: { name?: string | null } | null
  }> | null
}

function buildPayload(order: OrderRow): Track7OrderPayload | null {
  const name = order.customer_name?.trim() ?? ''
  const email = order.customer_email?.trim() ?? ''
  const phone = normalizePhone(order.customer_phone)
  const document = normalizeDocument(order.customer_document)
  const address = readAddress(order.shipping_address)

  if (!name || !email || !phone || !document || !address) return null

  const products = (order.order_items ?? [])
    .map((item) => ({
      name: item.products?.name?.trim() || 'Produto',
      quantity: Number(item.quantity ?? 0),
      price: Number(item.unit_price ?? 0),
    }))
    .filter((item) => item.quantity > 0)

  if (!products.length) return null

  return {
    transaction_id: order.id,
    currency: 'BRL',
    total: Number(order.total ?? 0),
    customer: { name, email, phone, document },
    address,
    products,
  }
}

/**
 * Sync seguro: nunca propaga erro para o fluxo de pagamento.
 * Idempotente quando já há tracking_code / track7_synced_at.
 */
export async function syncOrderToTrack7(orderId: string): Promise<void> {
  try {
    if (!isTrack7Configured()) return

    const admin = createAdminClient()
    const { data: order, error } = await admin
      .from('orders')
      .select(
        `id, total, customer_name, customer_email, customer_phone, customer_document,
         shipping_address, tracking_code, track7_synced_at,
         order_items(quantity, unit_price, products(name))`
      )
      .eq('id', orderId)
      .maybeSingle()

    if (error || !order) return

    const row = order as OrderRow
    // Pedidos com rastreio interno (BC…) ou já syncados não são reenviados.
    if (row.track7_synced_at) return
    if (row.tracking_code) return

    const payload = buildPayload(row)
    if (!payload) {
      console.warn('[track7] sync aborted: incomplete order payload', orderId)
      return
    }

    let trackingCode: string | null = null
    let lastStatus: string | null = null

    try {
      const created = await createTrack7Order(payload)
      trackingCode = created.tracking_code
      lastStatus = created.current_status ?? created.status
    } catch (err) {
      if (err instanceof Track7Error && err.status === 422) {
        console.warn('[track7] create rejected', orderId, err.code)
        return
      }
      throw err
    }

    if (!trackingCode) {
      try {
        const existing = await getTrackingByOrderId(orderId)
        trackingCode = existing.tracking_code
        lastStatus = existing.current_status ?? existing.status
      } catch (err) {
        if (err instanceof Track7Error && err.code === 'NOT_FOUND') {
          console.warn('[track7] no tracking code after create', orderId)
          return
        }
        throw err
      }
    }

    if (!trackingCode) {
      console.warn('[track7] sync finished without tracking_code', orderId)
      return
    }

    const now = new Date().toISOString()
    await admin
      .from('orders')
      .update({
        tracking_code: trackingCode,
        track7_synced_at: now,
        track7_last_status: lastStatus,
        carrier: 'Track7',
        shipped_at: now,
        status: 'shipped',
        updated_at: now,
      })
      .eq('id', orderId)
      .neq('status', 'cancelled')
      .neq('status', 'delivered')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    console.error('[track7] sync failed', orderId, message)
  }
}

/** Aguarda o sync (serverless); captura qualquer rejeição. */
export async function syncOrderToTrack7Safe(orderId: string): Promise<void> {
  await syncOrderToTrack7(orderId).catch((error) => {
    const message = error instanceof Error ? error.message : 'unknown'
    console.error('[track7] sync safe wrapper', orderId, message)
  })
}
