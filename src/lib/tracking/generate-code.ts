import { randomInt } from 'crypto'

/** Gera código no formato BC + 9 dígitos + BR (ex.: BC482917365BR). */
export function generateTrackingCode(): string {
  const digits = Array.from({ length: 9 }, () => String(randomInt(0, 10))).join('')
  return `BC${digits}BR`
}

export function normalizeTrackingCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}
