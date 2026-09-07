const DEFAULT_API_URL = 'https://allow-gi0i.onrender.com'
const REQUEST_TIMEOUT_MS = 30_000

/** Status possíveis retornados pela AllowPay. */
export type AllowPayStatus =
  | 'waiting_payment'
  | 'approved'
  | 'expired'
  | 'declined'
  | 'canceled'
  | 'refunded'
  | 'chargeback'

export type AllowPayCustomer = {
  /** Nome completo do comprador. */
  name: string
  email: string
  /** Somente dígitos, com DDD (ex: 11999999999). */
  cellphone: string
  /** CPF somente dígitos, matematicamente válido. */
  taxId: string
}

export type CreateAllowPayPixInput = {
  /** Valor em centavos (R$ 19,90 = 1990). */
  amount: number
  description?: string
  customer: AllowPayCustomer
  /** URL HTTPS pública que recebe a confirmação do pagamento. */
  webhookUrl?: string
}

export type AllowPayPixResponse = {
  /** Adquirente escolhida pela AllowPay — necessária para consultar o status depois. */
  route: string
  txid: string
  pix_code: string
  pix_qr_code?: string | null
}

export type AllowPayStatusResponse = {
  status: AllowPayStatus
  source?: string
}

export class AllowPayError extends Error {
  readonly status: number

  constructor(message: string, status = 502) {
    super(message)
    this.name = 'AllowPayError'
    this.status = status
  }
}

export function getAllowPayApiKey(): string {
  const key = process.env.ALLOWPAY_API_KEY?.trim()
  if (!key) throw new AllowPayError('ALLOWPAY_API_KEY não configurada', 500)
  return key
}

export function getAllowPayApiUrl(): string {
  return (process.env.ALLOWPAY_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, '')
}

/** Segredo usado para assinar/validar o webhook. Opcional, mas recomendado. */
export function getAllowPayWebhookSecret(): string | null {
  return process.env.ALLOWPAY_WEBHOOK_SECRET?.trim() || null
}

async function allowPayFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${getAllowPayApiUrl()}${path.startsWith('/') ? path : `/${path}`}`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch {
    throw new AllowPayError('Serviço de pagamento indisponível no momento', 503)
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
    const message =
      typeof json === 'object' &&
      json !== null &&
      'error' in json &&
      typeof (json as { error: unknown }).error === 'string'
        ? (json as { error: string }).error
        : `AllowPay API error (${res.status})`
    throw new AllowPayError(message, res.status)
  }

  return json as T
}

/**
 * Cria uma cobrança PIX.
 * O campo `route` nunca é enviado: a adquirente é escolhida pela AllowPay,
 * o que preserva o fallback automático caso a preferida esteja fora do ar.
 */
export async function createAllowPayPix(
  input: CreateAllowPayPixInput
): Promise<AllowPayPixResponse> {
  const webhookSecret = getAllowPayWebhookSecret()

  const response = await allowPayFetch<Partial<AllowPayPixResponse>>(
    '/api/v2/allowpay-seller/create-pix',
    {
      api_key: getAllowPayApiKey(),
      amount: input.amount,
      ...(input.description ? { description: input.description } : {}),
      customer: {
        name: input.customer.name,
        email: input.customer.email,
        cellphone: input.customer.cellphone,
        taxId: input.customer.taxId,
      },
      ...(input.webhookUrl ? { webhook_url: input.webhookUrl } : {}),
      ...(input.webhookUrl && webhookSecret ? { webhook_secret: webhookSecret } : {}),
    }
  )

  if (!response.txid || !response.route || !response.pix_code) {
    throw new AllowPayError('Resposta inválida da AllowPay ao gerar o Pix', 502)
  }

  return {
    route: response.route,
    txid: response.txid,
    pix_code: response.pix_code,
    pix_qr_code: response.pix_qr_code ?? null,
  }
}

/** Consulta o status de uma cobrança. Usado como reconciliação do webhook. */
export async function getAllowPayPaymentStatus(params: {
  txid: string
  route: string
}): Promise<AllowPayStatusResponse> {
  const path = `/api/v2/allowpay-seller/payment-status/${encodeURIComponent(
    params.txid
  )}?route=${encodeURIComponent(params.route)}`

  return allowPayFetch<AllowPayStatusResponse>(path, { api_key: getAllowPayApiKey() })
}

/** Pago e confirmado. */
export function isAllowPayPaidStatus(status: string | null | undefined): boolean {
  return status?.toLowerCase() === 'approved'
}

/** Encerrado sem pagamento — o pedido deve ser cancelado e o estoque devolvido. */
export function isAllowPayFailedStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return ['expired', 'declined', 'canceled', 'cancelled', 'refunded', 'chargeback'].includes(
    status.toLowerCase()
  )
}
