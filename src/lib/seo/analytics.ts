/** Tracking tipado (GA4 / Google Ads / Clarity) — IDs vêm do banco, não de .env. */

export type StoreTrackingConfig = {
  googleTagId: string | null
  googleAnalyticsId: string | null
  googleAdsId: string | null
  /** @deprecated Prefer googleAdsConversionSendTos */
  googleAdsConversionSendTo: string | null
  /** Uma ou mais ações de conversão (AW-XXXX/label). */
  googleAdsConversionSendTos: string[]
  microsoftClarityId: string | null
}

export const EMPTY_TRACKING_CONFIG: StoreTrackingConfig = {
  googleTagId: null,
  googleAnalyticsId: null,
  googleAdsId: null,
  googleAdsConversionSendTo: null,
  googleAdsConversionSendTos: [],
  microsoftClarityId: null,
}

export const MAX_ADS_CONVERSIONS = 5

const GOOGLE_ID_RE = /^(G|GT|AW)-[A-Z0-9]+$/i
const ADS_SEND_TO_RE = /^AW-\d+\/[\w-]+$/i

type GtagFn = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: GtagFn
    clarity?: (...args: unknown[]) => void
  }
}

export function normalizeGoogleId(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const value = raw.trim()
  if (!value) return null
  const embedded = value.match(/\b((?:G|GT|AW)-[A-Z0-9]+)\b/i)
  if (!embedded?.[1]) return null
  const id = embedded[1]!
  if (/^AW-/i.test(id)) return `AW-${id.slice(3)}`
  if (/^GT-/i.test(id)) return `GT-${id.slice(3).toUpperCase()}`
  if (/^G-/i.test(id)) return `G-${id.slice(2).toUpperCase()}`
  return GOOGLE_ID_RE.test(id) ? id.toUpperCase() : null
}

export function normalizeAdsSendTo(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const value = raw.trim()
  if (!value) return null
  const embedded = value.match(/\b(AW-\d+\/[\w-]+)\b/i)
  const sendTo = embedded?.[1] ?? value
  return ADS_SEND_TO_RE.test(sendTo) ? sendTo : null
}

export function normalizeAdsSendTos(raw: unknown): string[] {
  const collected: string[] = []

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        const n = normalizeAdsSendTo(item)
        if (n) collected.push(n)
      }
    }
  } else if (typeof raw === 'string') {
    // Aceita uma por linha ou separadas por vírgula
    for (const part of raw.split(/[\n,]+/)) {
      const n = normalizeAdsSendTo(part)
      if (n) collected.push(n)
    }
  }

  return [...new Set(collected)].slice(0, MAX_ADS_CONVERSIONS)
}

/** Lista efetiva de conversões (array novo + legado string). */
export function listAdsConversionSendTos(tracking: StoreTrackingConfig): string[] {
  const fromArray = normalizeAdsSendTos(tracking.googleAdsConversionSendTos)
  if (fromArray.length > 0) return fromArray
  const legacy = normalizeAdsSendTo(tracking.googleAdsConversionSendTo)
  return legacy ? [legacy] : []
}

/** Extrai ID do Clarity de valor puro, URL ou snippet HTML colado. */
export function normalizeClarityId(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const value = raw.trim()
  if (!value) return null

  const fromUrl = value.match(/clarity\.ms\/tag\/([a-z0-9]+)/i)
  if (fromUrl?.[1]) return fromUrl[1]

  const fromSnippet = value.match(/["']clarity["']\s*,\s*["']script["']\s*,\s*["']([a-z0-9]+)["']/i)
  if (fromSnippet?.[1]) return fromSnippet[1]

  const fromArg = value.match(/clarity\(["']script["']\s*,\s*["']([a-z0-9]+)["']/i)
  if (fromArg?.[1]) return fromArg[1]

  if (/^[a-z0-9]{8,20}$/i.test(value)) return value

  return null
}

export function normalizeTrackingConfig(raw: unknown): StoreTrackingConfig {
  const row =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  const str = (key: string) =>
    typeof row[key] === 'string' ? (row[key] as string) : null

  const sendTos = listAdsConversionSendTos({
    ...EMPTY_TRACKING_CONFIG,
    googleAdsConversionSendTo: normalizeAdsSendTo(str('googleAdsConversionSendTo')),
    googleAdsConversionSendTos: normalizeAdsSendTos(row.googleAdsConversionSendTos),
  })

  return {
    googleTagId: normalizeGoogleId(str('googleTagId')),
    googleAnalyticsId: normalizeGoogleId(str('googleAnalyticsId')),
    googleAdsId: normalizeGoogleId(str('googleAdsId')),
    googleAdsConversionSendTo: sendTos[0] ?? null,
    googleAdsConversionSendTos: sendTos,
    microsoftClarityId: normalizeClarityId(str('microsoftClarityId')),
  }
}

/** Lista única de IDs Google para gtag('config', …). */
export function listGoogleConfigIds(tracking: StoreTrackingConfig): string[] {
  const ids = [
    tracking.googleTagId,
    tracking.googleAnalyticsId,
    tracking.googleAdsId,
  ].filter((id): id is string => Boolean(id))

  return [...new Set(ids)]
}

function ensureGtagStub(): GtagFn {
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments)
    } as GtagFn
  }
  return window.gtag
}

const firedConversions = new Set<string>()

function conversionStorageKey(orderId: string) {
  return `bc_gads_conv_${orderId}`
}

function wasConversionFired(orderId: string): boolean {
  if (firedConversions.has(orderId)) return true
  try {
    return sessionStorage.getItem(conversionStorageKey(orderId)) === '1'
  } catch {
    return false
  }
}

function markConversionFired(orderId: string) {
  firedConversions.add(orderId)
  try {
    sessionStorage.setItem(conversionStorageKey(orderId), '1')
  } catch {
    // private mode
  }
}

/**
 * Dispara uma ou mais conversões Google Ads 1× por pedido.
 * Retry até ~10s se gtag ainda não carregou.
 */
export function fireGoogleAdsConversion(params: {
  sendTo: string | string[]
  value: number
  transactionId: string
  currency?: string
}): void {
  if (typeof window === 'undefined') return

  const sendTos = normalizeAdsSendTos(
    Array.isArray(params.sendTo) ? params.sendTo : [params.sendTo]
  )
  const orderId = params.transactionId?.trim()
  if (sendTos.length === 0 || !orderId || !(params.value >= 0)) return
  if (wasConversionFired(orderId)) return

  const value = Math.round(Number(params.value) * 100) / 100
  const currency = params.currency ?? 'BRL'
  const maxAttempts = 20
  const intervalMs = 500
  let attempts = 0

  const tryFire = () => {
    if (wasConversionFired(orderId)) return

    const ready = typeof window.gtag === 'function'
    if (!ready && attempts < maxAttempts) {
      attempts += 1
      window.setTimeout(tryFire, intervalMs)
      return
    }

    markConversionFired(orderId)
    const gtag = ensureGtagStub()
    for (const sendTo of sendTos) {
      gtag('event', 'conversion', {
        send_to: sendTo,
        value,
        currency,
        transaction_id: orderId,
      })
    }
  }

  tryFire()
}
