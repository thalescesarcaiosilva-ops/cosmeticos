'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

type ProductMetaLineProps = {
  sku: string | null
  gtin: string | null
  brandName: string | null
}

export function ProductMetaLine({ sku, gtin, brandName }: ProductMetaLineProps) {
  const [copied, setCopied] = useState(false)
  const refCode = sku ?? gtin

  async function copyRef() {
    if (!refCode) return
    try {
      await navigator.clipboard.writeText(refCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
      {refCode && (
        <span className="inline-flex items-center gap-1.5">
          <span>
            REF: <span className="font-medium text-text-primary">{refCode}</span>
          </span>
          <button
            type="button"
            onClick={copyRef}
            className="inline-flex size-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-surface-muted hover:text-brand"
            aria-label="Copiar código do produto"
          >
            {copied ? (
              <Check className="size-3.5 text-success" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
          </button>
        </span>
      )}
      {refCode && brandName && <span className="text-text-muted" aria-hidden>|</span>}
      {brandName && (
        <span>
          MARCA: <span className="font-medium text-brand">{brandName}</span>
        </span>
      )}
    </div>
  )
}
