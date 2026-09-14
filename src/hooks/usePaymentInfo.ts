'use client'

import { useEffect, useState } from 'react'
import type { CheckoutPaymentSettings, PaymentSettings } from '@/types/payment'
import {
  DEFAULT_CHECKOUT_PAYMENT_SETTINGS,
  DEFAULT_PAYMENT_SETTINGS,
} from '@/types/payment'

export type PaymentInfo = {
  paymentSettings: PaymentSettings
  checkoutSettings: CheckoutPaymentSettings
}

/** Cache em memória — compartilhado entre todas as instâncias do hook na sessão. */
let cached: PaymentInfo | null = null
let fetchPromise: Promise<PaymentInfo> | null = null

async function fetchPaymentInfo(): Promise<PaymentInfo> {
  if (cached) return cached
  if (fetchPromise) return fetchPromise

  fetchPromise = fetch('/api/payment-info')
    .then((res) => res.json())
    .then((json) => {
      const data = json?.data as PaymentInfo | undefined
      const result: PaymentInfo = {
        paymentSettings: data?.paymentSettings ?? DEFAULT_PAYMENT_SETTINGS,
        checkoutSettings: data?.checkoutSettings ?? DEFAULT_CHECKOUT_PAYMENT_SETTINGS,
      }
      cached = result
      fetchPromise = null
      return result
    })
    .catch(() => {
      fetchPromise = null
      return {
        paymentSettings: DEFAULT_PAYMENT_SETTINGS,
        checkoutSettings: DEFAULT_CHECKOUT_PAYMENT_SETTINGS,
      }
    })

  return fetchPromise
}

/**
 * Hook que carrega configurações de pagamento (Pix, parcelamento) uma vez por sessão.
 * Cache em memória: não refaz a requisição se já foi carregado.
 */
export function usePaymentInfo() {
  const [info, setInfo] = useState<PaymentInfo | null>(cached)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (cached) {
      setInfo(cached)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetchPaymentInfo().then((result) => {
      if (!cancelled) {
        setInfo(result)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return { info, loading }
}
