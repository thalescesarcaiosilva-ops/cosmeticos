import {
  parsePayoutBrRefusedReason,
  type PayoutBrRefusedReason,
} from '@/lib/payoutbr/refused-reason'

const DEFAULT_API_URL = 'https://api.payoutbr.com.br/v1'

export type PayoutBrTransactionStatus =
  | 'paid'
  | 'waiting_payment'
  | 'refused'
  | 'canceled'
  | 'cancelled'
  | 'refunded'
  | 'chargedback'
  | 'in_analysis'
  | string

export type PayoutBrCardHashInput = {
  hash: string
}

export type PayoutBrCustomer = {
  name: string
  email: string
  phone?: string
  document?: { number: string; type: 'cpf' | 'cnpj' }
  externalRef?: string
}

export type PayoutBrItem = {
  title: string
  unitPrice: number
  quantity: number
  tangible: boolean
  externalRef?: string
}

export type PayoutBrShipping = {
  fee: number
  address: {
    street: string
    streetNumber: string
    complement?: string | null
    zipCode: string
    neighborhood: string
    city: string
    state: string
    country: string
  }
}

export type CreatePayoutBrCardTransactionInput = {
  amount: number
  installments: number
  cardHash: string
  customer: PayoutBrCustomer
  items: PayoutBrItem[]
  shipping?: PayoutBrShipping
  postbackUrl?: string
  metadata?: string
  ip?: string | null
}

export type { PayoutBrRefusedReason }

export type PayoutBrTransaction = {
  id: number
  amount: number
  installments: number | null
  paymentMethod: string
  status: PayoutBrTransactionStatus
  secureId?: string | null
  secureUrl?: string | null
  paidAt?: string | null
  refusedReason?: PayoutBrRefusedReason | null
  metadata?: string | null
}

export class PayoutBrError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'PayoutBrError'
  }
}

export function getPayoutBrSecretKey(): string {
  const key = process.env.PAYOUTBR_SECRET_KEY?.trim()
  if (!key) throw new PayoutBrError('PAYOUTBR_SECRET_KEY não configurada', 500)
  return key
}

export function getPayoutBrPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_PAYOUTBR_PUBLIC_KEY?.trim() || null
}

export function getPayoutBrApiUrl(): string {
  return (process.env.PAYOUTBR_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, '')
}

export function getPayoutBrRecipientId(): number | null {
  const raw = process.env.PAYOUTBR_RECIPIENT_ID?.trim()
  if (!raw) return null
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
}

function basicAuthHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:x`, 'utf8').toString('base64')}`
}

function extractErrorMessage(json: unknown, status: number): string {
  if (!json || typeof json !== 'object') return `PayoutBR API error (${status})`
  const record = json as Record<string, unknown>
  if (typeof record.message === 'string' && record.message.trim()) return record.message
  if (typeof record.error === 'string' && record.error.trim()) return record.error
  if (Array.isArray(record.errors) && record.errors.length > 0) {
    const first = record.errors[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && typeof (first as { message?: string }).message === 'string') {
      return (first as { message: string }).message
    }
  }
  return `PayoutBR API error (${status})`
}

async function payoutFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getPayoutBrApiUrl()}${path.startsWith('/') ? path : `/${path}`}`
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: basicAuthHeader(getPayoutBrSecretKey()),
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
      cache: 'no-store',
    })
  } catch {
    throw new PayoutBrError('Serviço de pagamento indisponível no momento', 503)
  }

  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  if (!res.ok) {
    throw new PayoutBrError(extractErrorMessage(json, res.status), res.status, json)
  }

  return json as T
}

export async function createPayoutBrCardTransaction(
  input: CreatePayoutBrCardTransactionInput
): Promise<PayoutBrTransaction> {
  const recipientId = getPayoutBrRecipientId()
  const body: Record<string, unknown> = {
    amount: input.amount,
    paymentMethod: 'credit_card',
    installments: input.installments,
    card: { hash: input.cardHash },
    customer: input.customer,
    items: input.items,
  }

  if (input.shipping) body.shipping = input.shipping
  if (input.postbackUrl) body.postbackUrl = input.postbackUrl
  if (input.metadata) body.metadata = input.metadata
  if (input.ip) body.ip = input.ip
  if (recipientId) {
    body.splits = [
      {
        recipientId,
        amount: input.amount,
        chargeProcessingFee: true,
      },
    ]
  }

  const raw = await payoutFetch<Partial<PayoutBrTransaction>>('/transactions', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (!raw?.id || typeof raw.amount !== 'number' || !raw.status) {
    throw new PayoutBrError('Resposta inválida da PayoutBR ao criar a transação', 502, raw)
  }

  return {
    id: Number(raw.id),
    amount: Number(raw.amount),
    installments: raw.installments != null ? Number(raw.installments) : input.installments,
    paymentMethod: String(raw.paymentMethod ?? 'credit_card'),
    status: String(raw.status),
    secureId: typeof raw.secureId === 'string' ? raw.secureId : null,
    secureUrl: typeof raw.secureUrl === 'string' ? raw.secureUrl : null,
    paidAt: typeof raw.paidAt === 'string' ? raw.paidAt : null,
    refusedReason: parsePayoutBrRefusedReason(raw.refusedReason) ?? null,
    metadata: typeof raw.metadata === 'string' ? raw.metadata : null,
  }
}

export async function getPayoutBrTransaction(transactionId: number): Promise<PayoutBrTransaction> {
  const raw = await payoutFetch<Partial<PayoutBrTransaction>>(
    `/transactions/${encodeURIComponent(String(transactionId))}`,
    { method: 'GET' }
  )

  if (!raw?.id || !raw.status) {
    throw new PayoutBrError('Transação não encontrada na PayoutBR', 404, raw)
  }

  return {
    id: Number(raw.id),
    amount: Number(raw.amount ?? 0),
    installments: raw.installments != null ? Number(raw.installments) : null,
    paymentMethod: String(raw.paymentMethod ?? 'credit_card'),
    status: String(raw.status),
    secureId: typeof raw.secureId === 'string' ? raw.secureId : null,
    secureUrl: typeof raw.secureUrl === 'string' ? raw.secureUrl : null,
    paidAt: typeof raw.paidAt === 'string' ? raw.paidAt : null,
    refusedReason: parsePayoutBrRefusedReason(raw.refusedReason) ?? null,
    metadata: typeof raw.metadata === 'string' ? raw.metadata : null,
  }
}

export function isPayoutBrPaidStatus(status: string | null | undefined): boolean {
  return (status ?? '').trim().toLowerCase() === 'paid'
}

export function isPayoutBrFailedStatus(status: string | null | undefined): boolean {
  const value = (status ?? '').trim().toLowerCase()
  return (
    value === 'refused' ||
    value === 'canceled' ||
    value === 'cancelled' ||
    value === 'refunded' ||
    value === 'chargedback'
  )
}
