const DEFAULT_API_URL = 'https://api.payoutbr.com.br/v1'

export type PayoutTransactionItem = {
  title: string
  unitPrice: number
  quantity: number
  tangible: boolean
  externalRef?: string
}

export type PayoutCustomer = {
  name: string
  email: string
  phone: string
  document: { type: 'cpf' | 'cnpj'; number: string }
  address?: {
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

export type CreatePixTransactionPayload = {
  amount: number
  paymentMethod: 'pix'
  customer: PayoutCustomer
  shipping?: { fee: number; address: PayoutCustomer['address'] }
  items: PayoutTransactionItem[]
  postbackUrl: string
  metadata: string
  externalRef: string
  traceable?: boolean
  pix: { expiresInDays: number }
}

export type CreateCardTransactionPayload = {
  amount: number
  paymentMethod: 'credit_card'
  installments: number
  card: { hash: string }
  customer: PayoutCustomer
  shipping?: { fee: number; address: PayoutCustomer['address'] }
  items: PayoutTransactionItem[]
  postbackUrl: string
  metadata: string
  externalRef: string
  traceable?: boolean
}

export type PayoutPixResponse = {
  id: number
  status?: string
  secureId?: string
  pix?: {
    qrcode?: string
    qrcodeText?: string
    copyPaste?: string
    emv?: string
    expirationDate?: string
    expiresAt?: string
  }
  qrcode?: string
  qrcodeText?: string
  copyPaste?: string
  emv?: string
}

export type PayoutTransactionResponse = {
  id: number
  status?: string
  secureId?: string
  paymentMethod?: string
  pix?: PayoutPixResponse['pix']
}

export function getPayoutSecretKey(): string {
  const key = process.env.PAYOUT_SECRET_KEY?.trim()
  if (!key) throw new Error('PAYOUT_SECRET_KEY não configurada')
  return key
}

export function getPayoutPublicKey(): string {
  const key = process.env.PAYOUT_PUBLIC_KEY?.trim()
  if (!key) throw new Error('PAYOUT_PUBLIC_KEY não configurada')
  return key
}

export function getPayoutApiUrl(): string {
  return process.env.PAYOUT_API_URL?.trim() || DEFAULT_API_URL
}

function buildAuthHeader(): string {
  const secret = getPayoutSecretKey()
  return `Basic ${Buffer.from(`${secret}:x`).toString('base64')}`
}

export async function payoutFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${getPayoutApiUrl().replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: buildAuthHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  })

  const text = await res.text()
  let json: unknown = {}
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }
  }

  if (!res.ok) {
    const message =
      typeof json === 'object' &&
      json !== null &&
      'message' in json &&
      typeof (json as { message: unknown }).message === 'string'
        ? (json as { message: string }).message
        : `Payout API error (${res.status})`
    throw new Error(message)
  }

  return json as T
}

export async function createPixTransaction(
  payload: CreatePixTransactionPayload
): Promise<PayoutTransactionResponse> {
  return payoutFetch<PayoutTransactionResponse>('/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createCardTransaction(
  payload: CreateCardTransactionPayload
): Promise<PayoutTransactionResponse> {
  return payoutFetch<PayoutTransactionResponse>('/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getPayoutTransaction(transactionId: number): Promise<PayoutTransactionResponse> {
  return payoutFetch<PayoutTransactionResponse>(`/transactions/${transactionId}`)
}

export function toCents(value: number): number {
  return Math.round(value * 100)
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}
