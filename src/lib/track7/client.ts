const DEFAULT_API_URL = 'https://track7.app/api/v1'
const REQUEST_TIMEOUT_MS = 12_000
const BROKEN_HOSTS = ['api.track7.com.br', 'api.track7.app']

export type Track7OrderPayload = {
  transaction_id: string
  currency: 'BRL' | 'USD' | 'EUR' | 'GBP' | 'MXN'
  total: number
  customer: {
    name: string
    email: string
    phone: string
    document: string
  }
  address: {
    street: string
    number: string
    complement?: string | null
    neighborhood: string
    city: string
    state: string
    zipcode: string
  }
  products: Array<{
    name: string
    quantity: number
    price: number
  }>
}

export type Track7TrackingEvent = {
  date: string
  location: string
  status: string
  description: string
}

export type Track7TrackingResult = {
  transaction_id: string | null
  tracking_code: string | null
  status: string | null
  current_status: string | null
  events: Track7TrackingEvent[]
}

export class Track7Error extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status = 502, code = 'UPSTREAM') {
    super(message)
    this.name = 'Track7Error'
    this.status = status
    this.code = code
  }
}

export function isTrack7Configured(): boolean {
  return Boolean(process.env.TRACK7_API_KEY?.trim())
}

function getApiKey(): string {
  const key = process.env.TRACK7_API_KEY?.trim()
  if (!key) {
    throw new Track7Error(
      'Rastreio indisponível no momento. Tente mais tarde.',
      503,
      'CONFIG'
    )
  }
  return key
}

export function getTrack7ApiUrl(): string {
  const raw = process.env.TRACK7_API_URL?.trim() || DEFAULT_API_URL
  try {
    const url = new URL(raw)
    if (BROKEN_HOSTS.includes(url.hostname.toLowerCase())) {
      return DEFAULT_API_URL
    }
    return raw.replace(/\/$/, '')
  } catch {
    return DEFAULT_API_URL
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function normalizeEvents(raw: unknown): Track7TrackingEvent[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const row = asRecord(item)
      if (!row) return null
      const status =
        pickString(row.status, row.Status, row.event_status, row.eventStatus) ??
        ''
      const description =
        pickString(
          row.description,
          row.Description,
          row.message,
          row.Message,
          row.event,
          status
        ) ?? status
      return {
        date:
          pickString(
            row.date,
            row.Date,
            row.datetime,
            row.date_time,
            row.occurred_at,
            row.occurredAt,
            row.created_at,
            row.createdAt
          ) ?? '',
        location:
          pickString(
            row.location,
            row.Location,
            row.city,
            row.City,
            row.place
          ) ?? '',
        status,
        description,
      }
    })
    .filter((event): event is Track7TrackingEvent => Boolean(event))
}

export function normalizeTrack7Tracking(raw: unknown): Track7TrackingResult {
  const root = asRecord(raw)
  const data = asRecord(root?.data) ?? root ?? {}
  const status = pickString(data.status, data.Status)
  const currentStatus =
    pickString(
      data.current_status,
      data.currentStatus,
      data.CurrentStatus,
      status
    ) ?? null

  return {
    transaction_id: pickString(
      data.transaction_id,
      data.transactionId,
      data.TransactionId
    ),
    tracking_code: pickString(
      data.tracking_code,
      data.trackingCode,
      data.TrackingCode,
      data.code,
      data.Code
    ),
    status,
    current_status: currentStatus,
    events: normalizeEvents(
      data.events ?? data.Events ?? data.history ?? data.History
    ),
  }
}

function messageForStatus(status: number): { message: string; code: string } {
  if (status === 401) {
    return {
      message: 'Falha na autenticação do rastreio. Confira TRACK7_API_KEY.',
      code: 'UNAUTHORIZED',
    }
  }
  if (status === 402) {
    return {
      message: 'Créditos de rastreio esgotados. Contate o suporte da loja.',
      code: 'PAYMENT_REQUIRED',
    }
  }
  if (status === 404) {
    return {
      message:
        'Pedido não encontrado. Confira o código ou aguarde a postagem.',
      code: 'NOT_FOUND',
    }
  }
  if (status === 422) {
    return {
      message: 'Dados do pedido inválidos para o rastreio.',
      code: 'VALIDATION',
    }
  }
  if (status === 429) {
    return {
      message:
        'Muitas consultas em pouco tempo. Tente novamente em instantes.',
      code: 'RATE_LIMIT',
    }
  }
  return {
    message:
      'O serviço de rastreio demorou para responder. Tente novamente em instantes.',
    code: 'UPSTREAM',
  }
}

async function track7Fetch(
  path: string,
  init?: RequestInit
): Promise<unknown> {
  const apiKey = getApiKey()
  const base = getTrack7ApiUrl()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'X-API-Key': apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })

    const text = await response.text()
    let json: unknown = null
    if (text) {
      try {
        json = JSON.parse(text) as unknown
      } catch {
        json = null
      }
    }

    if (!response.ok) {
      const mapped = messageForStatus(response.status)
      const bodyHint =
        typeof json === 'object' && json
          ? JSON.stringify(json).slice(0, 400)
          : (text || '').slice(0, 200)
      console.error('[track7] HTTP', response.status, path, bodyHint)
      throw new Track7Error(mapped.message, response.status, mapped.code)
    }

    return json
  } catch (error) {
    if (error instanceof Track7Error) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Track7Error(
        'O serviço de rastreio demorou para responder. Tente novamente em instantes.',
        504,
        'UPSTREAM'
      )
    }
    throw new Track7Error(
      'Não foi possível conectar ao serviço de rastreio.',
      502,
      'UPSTREAM'
    )
  } finally {
    clearTimeout(timer)
  }
}

export async function createTrack7Order(
  payload: Track7OrderPayload
): Promise<Track7TrackingResult> {
  const json = await track7Fetch('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return normalizeTrack7Tracking(json)
}

export async function getTrackingByCode(
  codigo: string
): Promise<Track7TrackingResult> {
  const code = codigo.trim()
  if (!code) {
    throw new Track7Error('Informe um código de rastreio válido', 400, 'VALIDATION')
  }
  const json = await track7Fetch(`/tracking/${encodeURIComponent(code)}`)
  return normalizeTrack7Tracking(json)
}

export async function getTrackingByOrderId(
  transactionId: string
): Promise<Track7TrackingResult> {
  const id = transactionId.trim()
  if (!id) {
    throw new Track7Error('Informe o ID do pedido', 400, 'VALIDATION')
  }
  const json = await track7Fetch(
    `/orders/${encodeURIComponent(id)}/tracking`
  )
  return normalizeTrack7Tracking(json)
}
