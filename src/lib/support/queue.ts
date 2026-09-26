import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency } from '@/lib/products/format'
import {
  buildSupportWhatsappMessage,
  formatBrazilPhone,
  paymentMethodLabel,
  shortOrderNumber,
  toBrazilPhoneDigits,
  whatsappUrl,
} from '@/lib/support/contact'
import {
  isSupportQueueEligible,
  matchesSupportQueuePeriod,
  type SupportQueuePeriod,
  SUPPORT_QUEUE_EXCLUDED_PAYMENTS,
  SUPPORT_QUEUE_EXCLUDED_STATUSES,
  supportQueueCutoffIso,
  supportQueueSinceIso,
} from '@/lib/support/eligibility'
import { SITE_SETTINGS_ID } from '@/lib/layout/queries'
import type { SupportQueueItem } from '@/lib/support/types'

export type { SupportQueueItem } from '@/lib/support/types'

type AddressFields = {
  street?: string | null
  number?: string | null
  complement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
}

const QUEUE_COLUMNS = [
  'id',
  'status',
  'payment_status',
  'payment_method',
  'total',
  'subtotal',
  'shipping_price',
  'discount_amount',
  'customer_name',
  'customer_email',
  'customer_phone',
  'shipping_address',
  'payment_proof_pending',
  'created_at',
  'profiles(name, phone)',
  'addresses(street, number, complement, neighborhood, city, state, zip_code)',
  'order_items(quantity, unit_price, subtotal, products(name))',
].join(', ')

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asAddress(value: unknown): AddressFields | null {
  const record = asRecord(value)
  if (!record) return null
  return record as AddressFields
}

function formatAddress(address: AddressFields | null): string {
  if (!address?.street && !address?.city) return 'Endereço não informado'
  const line1 = [address.street, address.number].filter(Boolean).join(', ')
  const line2 = [address.complement, address.neighborhood].filter(Boolean).join(' — ')
  const cityState = [address.city, address.state].filter(Boolean).join('/')
  const line3 = [cityState, address.zip_code].filter(Boolean).join(' · ')
  const text = [line1, line2, line3].filter(Boolean).join('\n')
  return text || 'Endereço não informado'
}

function readItems(value: unknown): SupportQueueItem['items'] {
  if (!Array.isArray(value)) return []
  return value.map((row) => {
    const item = asRecord(row) ?? {}
    const productRaw = item.products
    const product = Array.isArray(productRaw) ? asRecord(productRaw[0]) : asRecord(productRaw)
    const quantity = Number(item.quantity ?? 0)
    const unit = Number(item.unit_price ?? 0)
    const lineTotal = Number(item.subtotal ?? quantity * unit)
    return {
      name: typeof product?.name === 'string' && product.name.trim() ? product.name.trim() : 'Produto',
      quantity,
      lineTotal,
      lineTotalLabel: formatCurrency(lineTotal),
    }
  })
}

function mapOrder(row: Record<string, unknown>, storeName: string): SupportQueueItem | null {
  const id = typeof row.id === 'string' ? row.id : ''
  const createdAt = typeof row.created_at === 'string' ? row.created_at : ''
  const status = typeof row.status === 'string' ? row.status : ''
  const paymentStatus = typeof row.payment_status === 'string' ? row.payment_status : ''
  if (!id || !createdAt) return null
  if (!isSupportQueueEligible({ status, payment_status: paymentStatus, created_at: createdAt })) {
    return null
  }

  const profile = asRecord(row.profiles)
  const customerName =
    (typeof row.customer_name === 'string' && row.customer_name.trim()) ||
    (typeof profile?.name === 'string' && profile.name.trim()) ||
    'Cliente'
  const customerEmail =
    typeof row.customer_email === 'string' && row.customer_email.trim()
      ? row.customer_email.trim()
      : 'Sem e-mail'
  const rawPhone =
    (typeof row.customer_phone === 'string' && row.customer_phone.trim()) ||
    (typeof profile?.phone === 'string' && profile.phone.trim()) ||
    ''
  const phoneDigits = toBrazilPhoneDigits(rawPhone)
  const phoneLabel = phoneDigits ? formatBrazilPhone(rawPhone) ?? `+${phoneDigits}` : 'Sem telefone'
  const cancelled = status === 'cancelled'
  const number = shortOrderNumber(id)
  const total = Number(row.total ?? 0)
  const subtotal = Number(row.subtotal ?? 0)
  const shipping = Number(row.shipping_price ?? 0)
  const discount = Number(row.discount_amount ?? 0)
  const items = readItems(row.order_items)
  const address = formatAddress(asAddress(row.shipping_address) ?? asAddress(row.addresses))
  const paymentMethod = paymentMethodLabel(
    typeof row.payment_method === 'string' ? row.payment_method : null
  )
  const statusLabel = cancelled ? 'Cancelado' : 'Aguardando pagamento'
  const whatsappMessage = buildSupportWhatsappMessage({
    customerName,
    storeName,
    orderNumber: number,
    total,
    cancelled,
  })
  const discountLabel = discount > 0 ? formatCurrency(discount) : null

  const copyLines = [
    `Pedido ${number}`,
    `Status: ${statusLabel}`,
    `Pagamento: ${paymentMethod}`,
    `Cliente: ${customerName}`,
    `E-mail: ${customerEmail}`,
    `Telefone: ${phoneLabel}`,
    `Endereço: ${address.replace(/\n/g, ', ')}`,
    'Produtos:',
    ...items.map((item) => `- ${item.quantity}x ${item.name} — ${item.lineTotalLabel}`),
    `Produtos: ${formatCurrency(subtotal)}`,
    ...(discountLabel ? [`Desconto: ${discountLabel}`] : []),
    `Frete: ${formatCurrency(shipping)}`,
    `Total: ${formatCurrency(total)}`,
  ]

  return {
    id,
    number,
    createdAt,
    status: cancelled ? 'cancelled' : 'pending',
    statusLabel,
    paymentMethod,
    proofPending: row.payment_proof_pending === true,
    customerName,
    customerEmail,
    phone: phoneDigits ? `+${phoneDigits}` : null,
    phoneLabel,
    telUrl: phoneDigits ? `tel:+${phoneDigits}` : null,
    whatsappUrl: phoneDigits ? whatsappUrl(phoneDigits, whatsappMessage) : null,
    whatsappMessage,
    address,
    items,
    subtotalLabel: formatCurrency(subtotal),
    discountLabel,
    shippingLabel: formatCurrency(shipping),
    total,
    totalLabel: formatCurrency(total),
    copyText: copyLines.join('\n'),
  }
}

function matchesSearch(item: SupportQueueItem, query: string): boolean {
  const term = query.trim().toLowerCase()
  if (!term) return true
  const digits = term.replace(/\D/g, '')
  const haystack = [item.number, item.id, item.customerName, item.customerEmail, item.phoneLabel, item.phone ?? '']
    .join(' ')
    .toLowerCase()
  if (haystack.includes(term)) return true
  if (digits.length >= 3) {
    const phoneDigits = (item.phone ?? '').replace(/\D/g, '')
    if (phoneDigits.includes(digits)) return true
  }
  return false
}

async function loadStoreName(): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('site_settings')
    .select('store_name')
    .eq('id', SITE_SETTINGS_ID)
    .maybeSingle()
  const name = typeof data?.store_name === 'string' ? data.store_name.trim() : ''
  return name || 'nossa loja'
}

export async function listSupportQueue(params: {
  period: SupportQueuePeriod
  search: string
  now?: number
}): Promise<{ storeName: string; orders: SupportQueueItem[] }> {
  const now = params.now ?? Date.now()
  const admin = createAdminClient()
  const storeName = await loadStoreName()
  const cutoff = supportQueueCutoffIso(now)
  const since = supportQueueSinceIso(params.period, now)

  let query = admin
    .from('orders')
    .select(QUEUE_COLUMNS)
    .lte('created_at', cutoff)
    .not('payment_status', 'in', `("${SUPPORT_QUEUE_EXCLUDED_PAYMENTS.join('","')}")`)
    .not('status', 'in', `("${SUPPORT_QUEUE_EXCLUDED_STATUSES.join('","')}")`)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (since) {
    query = query.gte('created_at', since)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  const orders = (data ?? [])
    .map((row) => mapOrder(row as Record<string, unknown>, storeName))
    .filter((item): item is SupportQueueItem => item != null)
    .filter((item) => matchesSupportQueuePeriod(item.createdAt, params.period, now))
    .filter((item) => matchesSearch(item, params.search))

  return { storeName, orders }
}
