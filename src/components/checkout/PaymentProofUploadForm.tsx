'use client'

import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { guestOrderHeaders, guestOrderQuery } from '@/lib/checkout/guest-access'
import type { PaymentProofSource } from '@/schemas/payment-proof-schema'

type PaymentProofUploadFormProps = {
  orderId: string
  source: PaymentProofSource
  /** Guest token header/query — omit for logged-in account flow */
  useGuestAccess?: boolean
  onSubmitted?: () => void
}

export function PaymentProofUploadForm({
  orderId,
  source,
  useGuestAccess = false,
  onSubmitted,
}: PaymentProofUploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!file) {
      setError('Selecione a imagem ou PDF do comprovante')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('source', source)
    if (message.trim()) formData.append('message', message.trim())

    setSending(true)
    try {
      const url = useGuestAccess
        ? `/api/checkout/orders/${orderId}/payment-proof${guestOrderQuery(orderId)}`
        : `/api/checkout/orders/${orderId}/payment-proof`

      const headers: HeadersInit = useGuestAccess ? guestOrderHeaders(orderId) : {}

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      })
      const json = (await res.json()) as {
        error?: boolean
        message?: string
        data?: unknown
      }

      if (!res.ok || json.error) {
        setError(json.message ?? 'Não foi possível enviar o comprovante')
        return
      }

      setSuccess(
        json.message ??
          'Comprovante enviado. Nossa equipe irá analisar e confirmar o pagamento.'
      )
      setFile(null)
      setMessage('')
      onSubmitted?.()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-border bg-surface p-4"
    >
      <div>
        <p className="text-sm font-semibold text-text-primary">Enviar comprovante de pagamento</p>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          Se você já pagou e a confirmação não apareceu, envie o comprovante (print do Pix). Nossa
          equipe analisa e confirma o pedido manualmente.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <div>
        <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor={`proof-${orderId}`}>
          Arquivo (JPG, PNG, WEBP ou PDF · máx. 5 MB)
        </label>
        <input
          id={`proof-${orderId}`}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-strong file:px-3 file:py-2 file:text-sm file:font-semibold file:text-text-primary"
        />
      </div>

      <Textarea
        label="Mensagem (opcional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Ex.: Paguei às 14h pelo banco X, valor R$ …"
      />

      <Button type="submit" loading={sending} className="w-full !rounded-md" disabled={Boolean(success)}>
        {success ? 'Comprovante enviado' : 'Enviar comprovante'}
      </Button>
    </form>
  )
}
