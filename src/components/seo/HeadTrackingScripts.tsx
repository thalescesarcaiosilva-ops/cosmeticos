'use client'

import { useEffect } from 'react'
import {
  listGoogleConfigIds,
  normalizeClarityId,
  type StoreTrackingConfig,
} from '@/lib/seo/analytics'

const MARKER = 'data-bc-analytics'

type HeadTrackingScriptsProps = {
  tracking: StoreTrackingConfig
}

function removeMarkedNodes() {
  document.querySelectorAll(`[${MARKER}]`).forEach((node) => node.remove())
}

function appendMarkedScript(attrs: {
  src?: string
  async?: boolean
  inline?: string
  id?: string
}) {
  const el = document.createElement('script')
  el.setAttribute(MARKER, '1')
  if (attrs.id) el.id = attrs.id
  if (attrs.src) {
    el.src = attrs.src
    if (attrs.async) el.async = true
  }
  if (attrs.inline) {
    el.text = attrs.inline
  }
  document.head.appendChild(el)
  return el
}

/**
 * Injeta gtag.js + config(s) + Clarity no head da vitrine (não no admin).
 * IDs vêm de site_settings.tracking.
 */
export function HeadTrackingScripts({ tracking }: HeadTrackingScriptsProps) {
  const googleIds = listGoogleConfigIds(tracking)
  const clarityId = normalizeClarityId(tracking.microsoftClarityId)
  const key = [...googleIds, clarityId ?? ''].join('|')

  useEffect(() => {
    removeMarkedNodes()

    if (googleIds.length > 0) {
      const primary = googleIds[0]!
      window.dataLayer = window.dataLayer || []
      if (typeof window.gtag !== 'function') {
        window.gtag = function gtag() {
          // eslint-disable-next-line prefer-rest-params
          window.dataLayer!.push(arguments)
        }
      }

      appendMarkedScript({
        src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primary)}`,
        async: true,
        id: 'bc-gtag-js',
      })

      appendMarkedScript({
        id: 'bc-gtag-init',
        inline: [
          'window.dataLayer=window.dataLayer||[];',
          'function gtag(){dataLayer.push(arguments);}',
          "gtag('js', new Date());",
          ...googleIds.map((id) => `gtag('config', ${JSON.stringify(id)});`),
        ].join('\n'),
      })
    }

    if (clarityId) {
      appendMarkedScript({
        id: 'bc-clarity',
        inline: `(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
t.setAttribute(${JSON.stringify(MARKER)},"1");
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", ${JSON.stringify(clarityId)});`,
      })
    }

    return () => {
      removeMarkedNodes()
    }
    // key cobre mudanças de IDs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return null
}
