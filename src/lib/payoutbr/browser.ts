export const PAYOUTBR_JS_URL = 'https://api.payoutbr.com.br/v1/js'

export type PayoutBrEncryptCard = {
  number: string
  holderName: string
  expMonth: number | string
  expYear: number | string
  cvv: string
}

type PayoutBrBrowserSdk = {
  setPublicKey: (publicKey: string) => void | Promise<void>
  setTestMode?: (enabled: boolean) => void
  encrypt: (card: PayoutBrEncryptCard) => Promise<unknown>
}

declare global {
  interface Window {
    Payout?: PayoutBrBrowserSdk
  }
}

let scriptPromise: Promise<void> | null = null

function loadPayoutBrScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Tokenização disponível apenas no navegador'))
  }
  if (window.Payout?.encrypt) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-payoutbr-sdk="1"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener(
        'error',
        () => reject(new Error('Falha ao carregar SDK da PayoutBR')),
        { once: true }
      )
      if (window.Payout?.encrypt) resolve()
      return
    }

    const script = document.createElement('script')
    script.src = PAYOUTBR_JS_URL
    script.async = true
    script.dataset.payoutbrSdk = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar SDK da PayoutBR'))
    document.head.appendChild(script)
  }).catch((error) => {
    scriptPromise = null
    throw error
  })

  return scriptPromise
}

function extractCardHash(tokenResponse: unknown): string {
  if (typeof tokenResponse === 'string' && tokenResponse.trim()) {
    return tokenResponse.trim()
  }
  if (tokenResponse && typeof tokenResponse === 'object') {
    const record = tokenResponse as Record<string, unknown>
    for (const key of ['hash', 'token', 'cardHash', 'id'] as const) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  throw new Error('Não foi possível tokenizar o cartão. Tente novamente.')
}

export async function tokenizePayoutBrCard(params: {
  publicKey: string
  card: PayoutBrEncryptCard
}): Promise<string> {
  await loadPayoutBrScript()
  const sdk = window.Payout
  if (!sdk?.encrypt || !sdk.setPublicKey) {
    throw new Error('SDK da PayoutBR indisponível')
  }

  await sdk.setPublicKey(params.publicKey)
  if (typeof sdk.setTestMode === 'function') {
    sdk.setTestMode(!params.publicKey.startsWith('pk_live'))
  }

  const tokenResponse = await sdk.encrypt({
    number: params.card.number.replace(/\D/g, ''),
    holderName: params.card.holderName.trim(),
    expMonth: Number(params.card.expMonth),
    expYear: Number(params.card.expYear),
    cvv: String(params.card.cvv).replace(/\D/g, ''),
  })

  return extractCardHash(tokenResponse)
}
