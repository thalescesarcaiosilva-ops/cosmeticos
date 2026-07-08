'use client'

import { Copy, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/products/format'

type CheckoutPixPanelProps = {
  total: number
  discountAmount: number
  qrCode: string | null
  qrImage: string | null
  expiresAt: string | null
  polling: boolean
  onRefresh?: () => void
}

export function CheckoutPixPanel({
  total,
  discountAmount,
  qrCode,
  qrImage,
  expiresAt,
  polling,
  onRefresh,
}: CheckoutPixPanelProps) {
  const [copied, setCopied] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)

  useEffect(() => {
    if (qrImage || !qrCode) {
      setGeneratedImage(null)
      return
    }

    let active = true
    import('qrcode').then((QRCode) =>
      QRCode.toDataURL(qrCode, { margin: 1, width: 256, errorCorrectionLevel: 'M' }).then(
        (url) => {
          if (active) setGeneratedImage(url)
        }
      )
    )

    return () => {
      active = false
    }
  }, [qrCode, qrImage])

  const displayImage = qrImage ?? generatedImage

  async function handleCopy() {
    if (!qrCode) return
    try {
      await navigator.clipboard.writeText(qrCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null

  return (
    <div className="space-y-4 rounded-md border border-brand/30 bg-brand/5 p-4">
      <div>
        <p className="text-sm font-semibold text-text-primary">Pague com Pix</p>
        <p className="mt-1 text-sm text-text-secondary">
          Escaneie o QR Code ou copie o código abaixo. A confirmação é automática.
        </p>
      </div>

      <dl className="space-y-1 text-sm">
        {discountAmount > 0 && (
          <div className="flex justify-between gap-4 text-success">
            <dt>Desconto Pix</dt>
            <dd className="font-medium tabular-nums">− {formatCurrency(discountAmount)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-text-secondary">Total a pagar</dt>
          <dd className="font-bold tabular-nums text-brand">{formatCurrency(total)}</dd>
        </div>
      </dl>

      {displayImage && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImage}
            alt="QR Code Pix"
            className="h-auto w-full max-w-[280px] rounded-md border border-border bg-white p-2"
          />
        </div>
      )}

      {qrCode && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Pix copia e cola
          </p>
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 break-all whitespace-pre-wrap rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-primary">
              {qrCode}
            </code>
            <Button type="button" variant="secondary" onClick={handleCopy} aria-label="Copiar código Pix">
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            </Button>
          </div>
        </div>
      )}

      {expiresLabel && (
        <p className="text-xs text-text-muted">Expira em {expiresLabel}</p>
      )}

      <Alert type="info">
        {polling
          ? 'Aguardando confirmação do pagamento… esta página atualiza automaticamente.'
          : 'Após pagar, aguarde alguns instantes para a confirmação.'}
      </Alert>

      {onRefresh && (
        <Button type="button" variant="secondary" className="w-full" onClick={onRefresh}>
          Já paguei — verificar agora
        </Button>
      )}
    </div>
  )
}
