'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const SESSION_KEY = 'bc-404-logged'

/** Log agregado de 404 — 1x por path na sessão; não altera status HTTP. */
export function TrackNotFound() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return

    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      const paths: string[] = raw ? (JSON.parse(raw) as string[]) : []
      if (paths.includes(pathname)) return
      paths.push(pathname)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(paths.slice(-50)))
    } catch {
      // continua mesmo sem sessionStorage
    }

    const body = JSON.stringify({
      path: pathname,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
    })
    const url = '/api/analytics/not-found'

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      return
    }

    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
