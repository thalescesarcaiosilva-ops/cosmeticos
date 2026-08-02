'use client'

import { useEffect } from 'react'

const SESSION_KEY = 'bc-product-views'

function alreadyTracked(productId: string): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : []
    return ids.includes(productId)
  } catch {
    return false
  }
}

function markTracked(productId: string) {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : []
    if (!ids.includes(productId)) {
      ids.push(productId)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(ids.slice(-100)))
    }
  } catch {
    // ignore
  }
}

type TrackProductViewProps = {
  productId: string
}

/** Conta 1 view por produto por sessão — depois do paint, sem bloquear SEO. */
export function TrackProductView({ productId }: TrackProductViewProps) {
  useEffect(() => {
    if (!productId || alreadyTracked(productId)) return
    markTracked(productId)

    const body = JSON.stringify({ productId })
    const url = '/api/analytics/product-view'

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon(url, blob)
      return
    }

    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  }, [productId])

  return null
}
