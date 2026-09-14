const DEFAULT_API_URL = 'https://beta.venopayments.com'
const REQUEST_TIMEOUT_MS = 45_000

export type VenoStatus =
  | 'pending'
  | 'paid'
  | 'expired'
  | 'cancelled'
  | 'canceled'
  | 'refunded'
  | 'authorized'
  | 'captured'
  | 'denied'
  | 'chargeback'
  | 'disputed'

export type VenoPayer = {
  name: string
  email: string
  document: string
  phone: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
}

export type VenoProduct = {
  external_ref: string
  name: string
  /** Preço unitário em centavos (mín. 1). */
  price: number
  quantity: number
}

export type CreateVenoPixInput = {
  amount: number
  description?: string
  externalId: string
  callbackUrl?: string
  payer: VenoPayer
  products: VenoProduct[]
}

export type VenoPixResponse = {
  id: string
  txid: string
  status: string
  amount: number
  /** Payload copia-e-cola (pode vir em vários campos). */
  pixCopyPaste: string
  expiresAt: string | null
}

export type VenoPixStatusResponse = {
  id: string
  txid?: string
  status: string
  amount?: number
  paid_at?: string | null
  external_id?: string | null
}

export class VenoError extends Error {
  readonly status: number

  constructor(message: string, status = 502) {
    super(message)
    this.name = 'VenoError'
    this.status = status
  }
}

export function getVenoApiKey(): string {
  const key = process.env.VENO_API_KEY?.trim()
  if (!key) throw new VenoError('VENO_API_KEY não configurada', 500)
  return key
}

export function getVenoApiUrl(): string {
  return (process.env.VENO_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, '')
}

function extractErrorMessage(json: unknown, status: number): string {
  if (typeof json === 'object' && json !== null) {
    const obj = json as Record<string, unknown>
    if (typeof obj.error === 'string') return obj.error
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.detail === 'string') return obj.detail
  }
  return `Veno API error (${status})`
}

async function venoFetch<T>(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<T> {
  const url = `${getVenoApiUrl()}${path.startsWith('/') ? path : `/${path}`}`
  const method = options.method ?? (options.body ? 'POST' : 'GET')

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${getVenoApiKey()}`,
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch {
    throw new VenoError('Serviço de pagamento indisponível no momento', 503)
  }

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
    throw new VenoError(extractErrorMessage(json, res.status), res.status)
  }

  return json as T
}

function pickPixCopyPaste(raw: Record<string, unknown>): string | null {
  const candidates = [raw.pix_copy_paste, raw.qr_code_image, raw.qr_code, raw.emv, raw.payload]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 20) return c.trim()
  }
  return null
}

/** Cria cobrança PIX. */
export async function createVenoPix(input: CreateVenoPixInput): Promise<VenoPixResponse> {
  const productsSum = input.products.reduce((s, p) => s + p.price * p.quantity, 0)
  if (productsSum !== input.amount) {
    throw new VenoError(
      `Soma dos products (${productsSum}) difere do amount (${input.amount})`,
      500
    )
  }

  const raw = await venoFetch<Record<string, unknown>>('/api/v1/pix', {
    method: 'POST',
    body: {
      amount: input.amount,
      ...(input.description ? { description: input.description } : {}),
      external_id: input.externalId,
      ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
      payer: {
        name: input.payer.name,
        email: input.payer.email,
        document: input.payer.document,
        phone: input.payer.phone,
        ...(input.payer.address ? { address: input.payer.address } : {}),
        ...(input.payer.city ? { city: input.payer.city } : {}),
        ...(input.payer.state ? { state: input.payer.state } : {}),
        ...(input.payer.zip_code ? { zip_code: input.payer.zip_code } : {}),
      },
      products: input.products,
    },
  })

  const id = typeof raw.id === 'string' ? raw.id : null
  const txid = typeof raw.txid === 'string' ? raw.txid : id
  const pixCopyPaste = pickPixCopyPaste(raw)

  if (!id || !txid || !pixCopyPaste) {
    throw new VenoError('Resposta inválida da Veno ao gerar o Pix', 502)
  }

  return {
    id,
    txid,
    status: typeof raw.status === 'string' ? raw.status : 'pending',
    amount: Number(raw.amount ?? input.amount),
    pixCopyPaste,
    expiresAt: typeof raw.expires_at === 'string' ? raw.expires_at : null,
  }
}

export async function getVenoPixStatus(depositId: string): Promise<VenoPixStatusResponse> {
  const raw = await venoFetch<Record<string, unknown>>(
    `/api/v1/pix/${encodeURIComponent(depositId)}/status`,
    { method: 'GET' }
  )

  const id = typeof raw.id === 'string' ? raw.id : depositId
  const status = typeof raw.status === 'string' ? raw.status : 'pending'

  return {
    id,
    txid: typeof raw.txid === 'string' ? raw.txid : undefined,
    status,
    amount: raw.amount != null ? Number(raw.amount) : undefined,
    paid_at: typeof raw.paid_at === 'string' ? raw.paid_at : null,
    external_id: typeof raw.external_id === 'string' ? raw.external_id : null,
  }
}

export function isVenoPaidStatus(status: string | null | undefined): boolean {
  if (!status) return false
  const s = status.toLowerCase()
  return s === 'paid' || s === 'captured'
}

export function isVenoFailedStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return ['expired', 'cancelled', 'canceled', 'denied', 'refunded', 'chargeback'].includes(
    status.toLowerCase()
  )
}
