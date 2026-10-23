'use client'

import { isFunnelStep, type FunnelStep } from '@/lib/analytics/funnel-steps'

const SESSION_KEY = 'bc-funnel-sid'
const SENT_KEY = 'bc-funnel-sent'

function readSent(): FunnelStep[] {
  try {
    const raw = sessionStorage.getItem(SENT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter((step): step is FunnelStep => typeof step === 'string' && isFunnelStep(step))
  } catch {
    return []
  }
}

function sessionId(): string | null {
  try {
    const current = sessionStorage.getItem(SESSION_KEY)
    if (current && /^[0-9a-f-]{36}$/i.test(current)) return current
    const next = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, next)
    return next
  } catch {
    return null
  }
}

/** Uma vez por etapa por sessão. Não envia nome, e-mail nem conteúdo do carrinho. */
export function trackFunnel(step: FunnelStep) {
  if (typeof window === 'undefined') return

  const sent = readSent()
  if (sent.includes(step)) return

  const sid = sessionId()
  if (!sid) return

  try {
    sessionStorage.setItem(SENT_KEY, JSON.stringify([...sent, step]))
  } catch {
    return
  }

  const body = JSON.stringify({
    sessionId: sid,
    step,
    path: window.location.pathname.slice(0, 200),
  })
  const url = '/api/analytics/funnel'

  if (typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' })
    if (navigator.sendBeacon(url, blob)) return
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}
