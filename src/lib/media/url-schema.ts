import { z } from 'zod'

const STORAGE_PUBLIC_PREFIX = '/storage/v1/object/public/'

/** Aceita URL absoluta (http/https) ou caminho público do storage na loja. */
export function isValidMediaUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false

  if (trimmed.startsWith(STORAGE_PUBLIC_PREFIX)) return true

  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function normalizeMediaUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value == null || value === '') return null
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : null
}

export const mediaUrlSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform(normalizeMediaUrl)
  .refine(
    (value) => value === undefined || value === null || isValidMediaUrl(value),
    'URL inválida'
  )
