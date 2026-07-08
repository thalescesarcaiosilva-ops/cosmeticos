'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import { formatCurrency } from '@/lib/products/format'
import type { InstallmentTableRow } from '@/lib/payment/installment-table'

type PayoutPublicConfig = {
  publicKey: string | null
  apiUrl: string
}

type PayoutCardFormProps = {
  total: number
  disabled?: boolean
  showSubmitButton?: boolean
  onSuccess: (result: { orderId: string; paid: boolean; guestAccessToken?: string | null }) => void
  onError: (message: string) => void
  buildPayload: (cardHash: string, installments: number) => Record<string, unknown>
}

export type PayoutCardFormHandle = {
  submit: () => Promise<void>
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function formatCardNumber(value: string): string {
  const digits = onlyDigits(value).slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function formatExpiry(value: string): string {
  const digits = onlyDigits(value).slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

async function tokenizeCard(
  config: PayoutPublicConfig,
  card: {
    number: string
    holderName: string
    expirationMonth: number
    expirationYear: number
    cvv: string
  }
): Promise<string> {
  if (!config.publicKey) {
    throw new Error('Pagamento com cartão indisponível no momento')
  }

  const url = `${config.apiUrl.replace(/\/+$/, '')}/card-token?publicKey=${encodeURIComponent(config.publicKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      number: onlyDigits(card.number),
      holderName: card.holderName.trim(),
      expirationMonth: card.expirationMonth,
      expirationYear: card.expirationYear,
      cvv: card.cvv,
    }),
  })

  const text = await res.text()
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = text
    }
  }

  if (!res.ok) {
    const message = extractTokenizeError(json)
    throw new Error(message)
  }

  const hash = extractCardHash(json)
  if (!hash) {
    throw new Error('Token do cartão inválido')
  }

  return hash
}

function extractCardHash(json: unknown): string | null {
  if (typeof json === 'string' && json.trim().length > 0) {
    return json.trim()
  }
  if (json && typeof json === 'object') {
    const record = json as Record<string, unknown>
    const candidate = record.hash ?? record.token ?? record.card_hash
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }
  return null
}

function extractTokenizeError(json: unknown): string {
  if (json && typeof json === 'object') {
    const message = (json as Record<string, unknown>).message
    if (typeof message === 'string' && message.trim()) return message
    if (Array.isArray(message) && message.length > 0) {
      return message.map((m) => String(m)).join('. ')
    }
  }
  return 'Não foi possível validar o cartão'
}

export const PayoutCardForm = forwardRef<PayoutCardFormHandle, PayoutCardFormProps>(
  function PayoutCardForm(
    { total, disabled, showSubmitButton = true, onSuccess, onError, buildPayload },
    ref
  ) {
    const [config, setConfig] = useState<PayoutPublicConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [installments, setInstallments] = useState<InstallmentTableRow[]>([])
  const [selectedInstallments, setSelectedInstallments] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const [number, setNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')

  useEffect(() => {
    async function loadConfig() {
      const { data, error } = await fetchApi<{
        publicKey: string | null
        apiUrl: string
      }>('/api/payout/config')

      if (error || !data) {
        setConfigError(error ?? 'Configuração de pagamento indisponível')
        return
      }

      setConfig({ publicKey: data.publicKey, apiUrl: data.apiUrl })
    }

    loadConfig()
  }, [])

  useEffect(() => {
    if (total <= 0) return

    async function loadInstallments() {
      const { data } = await fetchApi<{ installmentOptions: InstallmentTableRow[] }>(
        '/api/payout/config',
        {
          method: 'POST',
          body: JSON.stringify({ total }),
        }
      )
      const options = data?.installmentOptions ?? []
      setInstallments(options)
      if (options.length > 0) {
        setSelectedInstallments(options[options.length - 1]!.count)
      }
    }

    loadInstallments()
  }, [total])

    async function handleSubmit() {
    onError('')
    setSubmitting(true)

    try {
      if (!config) {
        throw new Error(configError ?? 'Configuração de pagamento indisponível')
      }

      const expiryDigits = onlyDigits(expiry)
      if (expiryDigits.length !== 4) {
        throw new Error('Validade do cartão inválida')
      }

      const expirationMonth = Number(expiryDigits.slice(0, 2))
      const expirationYear = 2000 + Number(expiryDigits.slice(2))
      if (expirationMonth < 1 || expirationMonth > 12) {
        throw new Error('Mês de validade inválido')
      }

      const cardHash = await tokenizeCard(config, {
        number,
        holderName,
        expirationMonth,
        expirationYear,
        cvv,
      })

      const { data, error, message } = await fetchApi<{
        orderId: string
        paid: boolean
        guestAccessToken?: string | null
      }>(
        '/api/checkout/card',
        {
          method: 'POST',
          body: JSON.stringify(buildPayload(cardHash, selectedInstallments)),
        }
      )

      if (error || !data?.orderId) {
        throw new Error(error ?? message ?? 'Pagamento recusado')
      }

      onSuccess({ orderId: data.orderId, paid: data.paid, guestAccessToken: data.guestAccessToken })
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Não foi possível processar o cartão')
    } finally {
      setSubmitting(false)
    }
  }

    useImperativeHandle(ref, () => ({
      submit: handleSubmit,
    }))

    if (configError) {
      return <Alert type="error">{configError}</Alert>
    }

    return (
      <div className="space-y-4">
        <Input
          label="Número"
          value={number}
          onChange={(e) => setNumber(formatCardNumber(e.target.value))}
          placeholder="0000 0000 0000 0000"
          autoComplete="cc-number"
          inputMode="numeric"
          required
        />
        <Input
          label="Nome do titular"
          value={holderName}
          onChange={(e) => setHolderName(e.target.value)}
          placeholder="Nome impresso no cartão"
          autoComplete="cc-name"
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Data de validade"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            placeholder="MM/AA"
            autoComplete="cc-exp"
            inputMode="numeric"
            required
          />
          <Input
            label="CVV"
            value={cvv}
            onChange={(e) => setCvv(onlyDigits(e.target.value).slice(0, 4))}
            placeholder="000"
            autoComplete="cc-csc"
            inputMode="numeric"
            required
          />
        </div>

        {installments.length > 0 && (
          <div className="space-y-2">
            <label htmlFor="checkout-installments" className="block text-sm font-medium text-text-primary">
              Parcelas
            </label>
            <select
              id="checkout-installments"
              value={selectedInstallments}
              onChange={(e) => setSelectedInstallments(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              {installments.map((row) => (
                <option key={row.count} value={row.count}>
                  {row.label} - total {formatCurrency(row.total)}
                </option>
              ))}
            </select>
          </div>
        )}

        {showSubmitButton && (
          <Button
            type="button"
            className="w-full rounded-md uppercase tracking-wide"
            loading={submitting}
            disabled={disabled || submitting || !config?.publicKey}
            onClick={handleSubmit}
          >
            Pagar {formatCurrency(total)}
          </Button>
        )}
      </div>
    )
  }
)
