'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import { formatCurrency } from '@/lib/products/format'
import type { InstallmentTableRow } from '@/lib/payment/installment-table'

type CardUnavailablePanelProps = {
  total: number
}

/**
 * Formulário visual de cartão no checkout (parcelas e campos).
 * Não processa cobrança — o provedor atual processa apenas Pix.
 */
export function CardUnavailablePanel({ total }: CardUnavailablePanelProps) {
  const [installments, setInstallments] = useState<InstallmentTableRow[]>([])
  const [selectedInstallments, setSelectedInstallments] = useState(1)
  const [number, setNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')

  useEffect(() => {
    if (total <= 0) {
      setInstallments([])
      return
    }

    let active = true

    async function loadInstallments() {
      const { data } = await fetchApi<{ installmentOptions: InstallmentTableRow[] }>(
        '/api/checkout/config',
        { method: 'POST', body: JSON.stringify({ total }) }
      )
      if (!active) return

      const options = data?.installmentOptions ?? []
      setInstallments(options)
      if (options.length > 0) {
        setSelectedInstallments(options[options.length - 1]!.count)
      }
    }

    loadInstallments()

    return () => {
      active = false
    }
  }, [total])

  return (
    <div className="space-y-4">
      <Input
        label="Número"
        value={number}
        onChange={(e) => setNumber(formatCardNumber(e.target.value))}
        placeholder="0000 0000 0000 0000"
        autoComplete="cc-number"
        inputMode="numeric"
      />
      <Input
        label="Nome do titular"
        value={holderName}
        onChange={(e) => setHolderName(e.target.value)}
        placeholder="Nome impresso no cartão"
        autoComplete="cc-name"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Data de validade"
          value={expiry}
          onChange={(e) => setExpiry(formatExpiry(e.target.value))}
          placeholder="MM/AA"
          autoComplete="cc-exp"
          inputMode="numeric"
        />
        <Input
          label="CVV"
          value={cvv}
          onChange={(e) => setCvv(onlyDigits(e.target.value).slice(0, 4))}
          placeholder="000"
          autoComplete="cc-csc"
          inputMode="numeric"
        />
      </div>

      {installments.length > 0 && (
        <div className="space-y-2">
          <label
            htmlFor="checkout-installments"
            className="block text-sm font-medium text-text-primary"
          >
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
    </div>
  )
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
