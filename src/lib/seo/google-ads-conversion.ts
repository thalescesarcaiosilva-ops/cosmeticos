/** Conversão Google Ads — Compra (conta AW-18248543414). */

export const GOOGLE_ADS_ID = 'AW-18248543414'
export const GOOGLE_ADS_PURCHASE_SEND_TO = 'AW-18248543414/n_0dCIfOhsEcELbZyv1D'

type GtagFn = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: GtagFn
  }
}

function ensureGtag(): GtagFn {
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    // Stub oficial: empilha `arguments` até o gtag.js carregar
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments)
    } as GtagFn
  }
  return window.gtag
}

/**
 * Dispara conversão de compra uma vez por pedido (dedupe via sessionStorage + transaction_id).
 * Só chamar quando o pagamento estiver confirmado.
 */
export function trackGoogleAdsPurchase(params: {
  orderId: string
  value: number
  currency?: string
}): boolean {
  if (typeof window === 'undefined') return false
  if (!params.orderId || !(params.value >= 0)) return false

  const storageKey = `gads_purchase_${params.orderId}`
  try {
    if (sessionStorage.getItem(storageKey) === '1') return false
    sessionStorage.setItem(storageKey, '1')
  } catch {
    // private mode / blocked storage — ainda dispara; Google deduplica por transaction_id
  }

  const value = Math.round(Number(params.value) * 100) / 100
  const gtag = ensureGtag()

  gtag('event', 'conversion', {
    send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
    value,
    currency: params.currency ?? 'BRL',
    transaction_id: params.orderId,
  })

  return true
}
