'use client'

import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import { formatCurrency } from '@/lib/products/format'
import type { InstallmentTableRow } from '@/lib/payment/installment-table'

type CardUnavailablePanelProps = {
  total: number
}

/**
 * Reproduz o formulário de cartão do checkout com as condições de parcelamento,
 * mas em modo somente leitura: o provedor atual processa apenas Pix.
 */
export function CardUnavailablePanel({ total }: CardUnavailablePanelProps) {
  const [installments, setInstallments] = useState<InstallmentTableRow[]>([])
  const [selectedInstallments, setSelectedInstallments] = useState(1)

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
      <Alert type="warning">
        Pagamento com cartão indisponível no momento. Por favor, finalize a compra com Pix.
      </Alert>

      <fieldset disabled className="space-y-4" aria-describedby="card-unavailable-hint">
        <Input
          label="Número"
          value=""
          readOnly
          placeholder="0000 0000 0000 0000"
          autoComplete="off"
          inputMode="numeric"
        />
        <Input
          label="Nome do titular"
          value=""
          readOnly
          placeholder="Nome impresso no cartão"
          autoComplete="off"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Data de validade"
            value=""
            readOnly
            placeholder="MM/AA"
            autoComplete="off"
            inputMode="numeric"
          />
          <Input label="CVV" value="" readOnly placeholder="000" autoComplete="off" inputMode="numeric" />
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
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
            >
              {installments.map((row) => (
                <option key={row.count} value={row.count}>
                  {row.label} - total {formatCurrency(row.total)}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <p id="card-unavailable-hint" className="text-xs text-text-muted">
        Os dados do cartão não estão sendo coletados nem processados. Selecione Pix para concluir o
        pedido.
      </p>
    </div>
  )
}
