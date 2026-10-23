import { MERCHANT_HANDLING_DAYS } from '@/lib/shipping/merchant-shipping'

const WEEKDAY_SATURDAY = 6
const WEEKDAY_SUNDAY = 0

/** Data de calendário em America/Sao_Paulo, sem horário, para não virar o dia no UTC. */
export function saoPauloToday(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  return new Date(Date.UTC(year, month - 1, day))
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

function dateKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Domingo de Páscoa (calendário gregoriano). */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return utcDate(year, month, day)
}

function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

/** Feriados nacionais em que os Correios não entregam. */
function nationalHolidayKeys(year: number): Set<string> {
  const keys = new Set<string>([
    `${year}-01-01`,
    `${year}-04-21`,
    `${year}-05-01`,
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-12-25`,
  ])

  const easter = easterSunday(year)
  keys.add(dateKey(addCalendarDays(easter, -2)))
  keys.add(dateKey(addCalendarDays(easter, -47)))
  keys.add(dateKey(addCalendarDays(easter, -48)))
  return keys
}

export function isBrazilianBusinessDay(date: Date): boolean {
  const weekday = date.getUTCDay()
  if (weekday === WEEKDAY_SATURDAY || weekday === WEEKDAY_SUNDAY) return false
  return !nationalHolidayKeys(date.getUTCFullYear()).has(dateKey(date))
}

/** O dia do pedido não entra na conta: o primeiro dia útil é o seguinte. */
export function addBusinessDays(start: Date, businessDays: number): Date {
  const cursor = new Date(start)
  let remaining = Math.max(0, Math.floor(businessDays))
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    if (isBrazilianBusinessDay(cursor)) remaining -= 1
  }
  return cursor
}

function formatDayMonth(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date)
}

/**
 * Janela de chegada alinhada à política: separação (1–2 dias úteis) + trânsito
 * informado na modalidade. O intervalo usa o mínimo e o máximo publicados, sem
 * encurtar o prazo.
 */
export function formatArrivalWindow(
  transitMin: number | null,
  transitMax: number | null,
  now = new Date()
): string | null {
  if (transitMin == null && transitMax == null) return null

  const transitStart = transitMin ?? transitMax
  const transitEnd = transitMax ?? transitMin
  if (transitStart == null || transitEnd == null || transitStart < 1 || transitEnd < 1) return null

  const earliestDays = transitStart + MERCHANT_HANDLING_DAYS.min
  const latestDays = Math.max(transitEnd, transitStart) + MERCHANT_HANDLING_DAYS.max
  const today = saoPauloToday(now)
  const earliest = addBusinessDays(today, earliestDays)
  const latest = addBusinessDays(today, latestDays)

  if (dateKey(earliest) === dateKey(latest)) {
    return `Chega em ${formatDayMonth(earliest)}`
  }

  return `Chega entre ${formatDayMonth(earliest)} e ${formatDayMonth(latest)}`
}

export const ARRIVAL_WINDOW_NOTE =
  'Estimativa em dias úteis a partir de hoje, sem sábado, domingo e feriado nacional. Inclui 1 a 2 dias úteis de separação antes do prazo de trânsito.'
