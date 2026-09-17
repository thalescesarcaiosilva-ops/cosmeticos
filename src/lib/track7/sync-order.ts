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

function money(value: number): number {
  return Math.round(Number(value) * 100) / 100
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
  shipping_price?: number | string | null
  discount_amount?: number | string | null
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

function toCents(value: number): number {
  return Math.round(Number(value) * 100)
}

function fromCents(cents: number): number {
  return cents / 100
}

function lineSumCents(
  products: Array<{ price: number; quantity: number }>
): number {
  return products.reduce(
    (sum, item) => sum + toCents(item.price) * item.quantity,
    0
  )
}

/**
 * Track7 exige: total === soma(price × quantity).
 * Inclui frete e aplica desconto/ajuste para refletir o total pago na loja.
 */
function buildProductsAndTotal(order: OrderRow): {
  products: Track7OrderPayload['products']
  total: number
} | null {
  const products: Track7OrderPayload['products'] = (order.order_items ?? [])
    .map((item) => ({
      name: item.products?.name?.trim() || 'Produto',
      quantity: Number(item.quantity ?? 0),
      price: money(Number(item.unit_price ?? 0)),
    }))
    .filter((item) => item.quantity > 0 && item.price >= 0)

  if (!products.length) return null

  const shippingCents = toCents(Number(order.shipping_price ?? 0))
  if (shippingCents > 0) {
    products.push({
      name: 'Frete',
      quantity: 1,
      price: fromCents(shippingCents),
    })
  }

  let sumCents = lineSumCents(products)
  const orderTotalCents = toCents(Number(order.total ?? fromCents(sumCents)))
  let diffCents = orderTotalCents - sumCents

  if (diffCents > 0) {
    products.push({
      name: 'Taxas',
      quantity: 1,
      price: fromCents(diffCents),
    })
    sumCents += diffCents
  } else if (diffCents < 0) {
    // Desconto: reduz o preço unitário dos produtos (Track7 não aceita preço negativo).
    let remaining = -diffCents
    for (const item of products) {
      if (remaining <= 0) break
      if (item.name === 'Frete' || item.name === 'Taxas') continue
      const lineCents = toCents(item.price) * item.quantity
      if (lineCents <= 0) continue
      const take = Math.min(lineCents, remaining)
      const newLineCents = lineCents - take
      item.price = money(fromCents(newLineCents) / item.quantity)
      remaining -= take
    }
    sumCents = lineSumCents(products)
    // Resíduo de arredondamento: ajusta o 1º produto
    diffCents = orderTotalCents - sumCents
    if (diffCents !== 0 && products[0]) {
      const first = products[0]
      const firstLine = toCents(first.price) * first.quantity + diffCents
      if (firstLine >= 0) {
        first.price = money(fromCents(firstLine) / first.quantity)
        sumCents = lineSumCents(products)
      }
    }
  }

  // Fonte da verdade para a Track7: soma exata das linhas
  const total = fromCents(lineSumCents(products))
  return { products, total }
}

function buildPayload(order: OrderRow): Track7OrderPayload | null {
  const name = order.customer_name?.trim() ?? ''
  const email = order.customer_email?.trim() ?? ''
  const phone = normalizePhone(order.customer_phone)
  const document = normalizeDocument(order.customer_document)
  const address = readAddress(order.shipping_address)

  if (!name || !email || !phone || !document || !address) {
    console.warn('[track7] incomplete fields', order.id, {
      name: Boolean(name),
      email: Boolean(email),
      phone: Boolean(phone),
      document: Boolean(document),
      address: Boolean(address),
    })
    return null
  }

  const built = buildProductsAndTotal(order)
  if (!built) {
    console.warn('[track7] no products', order.id)
    return null
  }

  return {
    transaction_id: order.id,
    currency: 'BRL',
    total: built.total,
    customer: { name, email, phone, document },
    address,
    products: built.products,
  }
}

async function markSyncError(orderId: string, message: string) {
  try {
    const admin = createAdminClient()
    await admin
      .from('orders')
      .update({
        track7_last_status: `Erro: ${message.slice(0, 180)}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
  } catch {
    // ignore
  }
}

export type SyncTrack7Result = {
  ok: boolean
  reason?: string
  trackingCode?: string | null
}

/**
 * Sync seguro: nunca propaga erro para o fluxo de pagamento.
 * Idempotente quando já há track7_synced_at.
 *
 * A Track7 pode aceitar o pedido no painel sem devolver tracking_code na hora.
 * Nesse caso ainda marcamos track7_synced_at para não perder o envio.
 */
export async function syncOrderToTrack7(
  orderId: string,
  options?: { force?: boolean }
): Promise<SyncTrack7Result> {
  try {
    if (!isTrack7Configured()) {
      console.warn('[track7] sync skipped: TRACK7_API_KEY not configured', orderId)
      return { ok: false, reason: 'not_configured' }
    }

    const admin = createAdminClient()
    const { data: order, error } = await admin
      .from('orders')
      .select(
        `id, total, shipping_price, discount_amount,
         customer_name, customer_email, customer_phone, customer_document,
         shipping_address, tracking_code, track7_synced_at,
         order_items(quantity, unit_price, products(name))`
      )
      .eq('id', orderId)
      .maybeSingle()

    if (error || !order) {
      console.warn('[track7] order not found', orderId, error?.message)
      return { ok: false, reason: 'order_not_found' }
    }

    const row = order as OrderRow
    if (row.track7_synced_at && !options?.force) {
      return { ok: true, reason: 'already_synced', trackingCode: row.tracking_code }
    }
    // Rastreio interno legado (BC…) — não sobrescreve
    if (row.tracking_code && !row.track7_synced_at && !options?.force) {
      return { ok: true, reason: 'has_local_tracking', trackingCode: row.tracking_code }
    }
    if (row.tracking_code && row.track7_synced_at && !options?.force) {
      return { ok: true, reason: 'already_synced', trackingCode: row.tracking_code }
    }

    const payload = buildPayload(row)
    if (!payload) {
      await markSyncError(orderId, 'dados incompletos para envio')
      return { ok: false, reason: 'incomplete_payload' }
    }

    let trackingCode: string | null = null
    let lastStatus: string | null = null
    let createSucceeded = false

    // Se o pedido já existe na Track7 (retry após falha local), recupera antes de recriar.
    try {
      const existing = await getTrackingByOrderId(orderId)
      trackingCode = existing.tracking_code
      lastStatus = existing.current_status ?? existing.status
      if (trackingCode || existing.events.length || lastStatus) {
        createSucceeded = true
        console.info('[track7] recovered existing order', orderId, {
          trackingCode,
          status: lastStatus,
        })
      }
    } catch (err) {
      if (!(err instanceof Track7Error && err.code === 'NOT_FOUND')) {
        console.warn(
          '[track7] GET by order failed',
          orderId,
          err instanceof Error ? err.message : err
        )
      }
    }

    if (!createSucceeded) {
      try {
        const created = await createTrack7Order(payload)
        createSucceeded = true
        trackingCode = created.tracking_code ?? trackingCode
        lastStatus = created.current_status ?? created.status ?? lastStatus
        console.info('[track7] create ok', orderId, {
          trackingCode,
          status: lastStatus,
        })
      } catch (err) {
        if (err instanceof Track7Error && err.status === 422) {
          console.warn('[track7] create rejected', orderId, err.message)
          await markSyncError(orderId, err.message)
          return { ok: false, reason: 'validation' }
        }
        if (err instanceof Track7Error && (err.status === 409 || err.status === 400)) {
          console.warn('[track7] create conflict, retrying GET', orderId, err.message)
          try {
            const existing = await getTrackingByOrderId(orderId)
            trackingCode = existing.tracking_code
            lastStatus = existing.current_status ?? existing.status ?? lastStatus
            createSucceeded = true
          } catch {
            await markSyncError(orderId, err.message)
            return { ok: false, reason: err.code }
          }
        } else if (err instanceof Track7Error) {
          console.error('[track7] create failed', orderId, err.status, err.code, err.message)
          await markSyncError(orderId, err.message)
          return { ok: false, reason: err.code }
        } else {
          throw err
        }
      }
    }

    if (!createSucceeded && !trackingCode) {
      await markSyncError(orderId, 'falha ao criar pedido na Track7')
      return { ok: false, reason: 'create_failed' }
    }

    const now = new Date().toISOString()
    const update: Record<string, unknown> = {
      track7_synced_at: now,
      track7_last_status: lastStatus ?? (trackingCode ? null : 'Aguardando código'),
      carrier: 'Track7',
      updated_at: now,
    }

    if (trackingCode) {
      update.tracking_code = trackingCode
      update.shipped_at = now
      update.status = 'shipped'
    }

    const { error: updateError } = await admin
      .from('orders')
      .update(update)
      .eq('id', orderId)
      .neq('status', 'cancelled')
      .neq('status', 'delivered')

    if (updateError) {
      console.error('[track7] persist failed', orderId, updateError.message)
      return { ok: false, reason: 'persist_failed' }
    }

    return {
      ok: true,
      trackingCode,
      reason: trackingCode ? 'synced' : 'synced_pending_code',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    console.error('[track7] sync failed', orderId, message)
    await markSyncError(orderId, message)
    return { ok: false, reason: message }
  }
}

/** Aguarda o sync (serverless); captura qualquer rejeição. */
export async function syncOrderToTrack7Safe(orderId: string): Promise<void> {
  await syncOrderToTrack7(orderId).catch((error) => {
    const message = error instanceof Error ? error.message : 'unknown'
    console.error('[track7] sync safe wrapper', orderId, message)
  })
}
