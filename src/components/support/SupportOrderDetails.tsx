'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import type { SupportQueueItem } from '@/lib/support/types'

type SupportOrderDetailsProps = {
  order: SupportQueueItem | null
  onClose: () => void
}

export function SupportOrderDetails({ order, onClose }: SupportOrderDetailsProps) {
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [copied, setCopied] = useState<'order' | 'pix' | null>(null)

  useEffect(() => {
    if (!order?.pixCopyPaste) {
      setQrImage(null)
      return
    }

    let active = true
    import('qrcode').then((QRCode) =>
      QRCode.toDataURL(order.pixCopyPaste as string, {
        margin: 1,
        width: 280,
        errorCorrectionLevel: 'M',
      }).then((url) => {
        if (active) setQrImage(url)
      })
    )

    return () => {
      active = false
    }
  }, [order?.pixCopyPaste])

  async function copy(kind: 'order' | 'pix', value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 2000)
    } catch {
      setCopied(null)
    }
  }

  return (
    <Modal open={order != null} onClose={onClose} title={order ? `Pedido ${order.number}` : 'Pedido'} size="lg">
      {order && (
        <div className="space-y-5">
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-neutral-900">Copia e cola do pedido</h3>
              <button
                type="button"
                onClick={() => void copy('order', order.copyText)}
                className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-800"
              >
                {copied === 'order' ? 'Copiado' : 'Copiar texto'}
              </button>
            </div>
            <textarea
              readOnly
              value={order.copyText}
              rows={10}
              className="w-full resize-y rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-800"
            />
          </section>

          <section>
            <h3 className="text-sm font-semibold text-neutral-900">QR Code do pagamento</h3>
            {order.pixCopyPaste ? (
              <div className="mt-3 flex flex-col items-center gap-3">
                {qrImage ? (
                  <img
                    src={qrImage}
                    alt={`QR Code do pedido ${order.number}`}
                    className="h-56 w-56 rounded-md border border-neutral-200 bg-white p-2"
                  />
                ) : (
                  <p className="text-sm text-neutral-500">Gerando o QR Code…</p>
                )}
                {order.status === 'cancelled' && (
                  <p className="text-sm text-amber-900">
                    Este pedido foi cancelado. O QR Code pode não aceitar mais o pagamento.
                  </p>
                )}
                <textarea
                  readOnly
                  value={order.pixCopyPaste}
                  rows={4}
                  className="w-full resize-y rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-800"
                />
                <button
                  type="button"
                  onClick={() => order.pixCopyPaste && void copy('pix', order.pixCopyPaste)}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-800"
                >
                  {copied === 'pix' ? 'Pix copiado' : 'Copiar código Pix'}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">Este pedido não tem QR Code de pagamento.</p>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
