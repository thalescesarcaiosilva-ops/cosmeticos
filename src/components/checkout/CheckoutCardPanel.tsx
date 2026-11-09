'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/products/format'
import type { InstallmentTableRow } from '@/lib/payment/installment-table'

export type CheckoutCardFormValues = {
  holderName: string
  number: string
  expiry: string
  cvv: string
  installments: number
}

type CheckoutCardPanelProps = {
  baseTotal: number
  installmentOptions: InstallmentTableRow[]
  values: CheckoutCardFormValues
  errors?: Partial<Record<keyof CheckoutCardFormValues, string>>
  disabled?: boolean
  onChange: (next: CheckoutCardFormValues) => void
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 19)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function CheckoutCardPanel({
  baseTotal,
  installmentOptions,
  values,
  errors,
  disabled,
  onChange,
}: CheckoutCardPanelProps) {
  const selected = useMemo(
    () => installmentOptions.find((row) => row.count === values.installments) ?? null,
    [installmentOptions, values.installments]
  )

  return (
    <div className="space-y-3">
      <Input
        label="Nome impresso no cartão"
        name="card-holder"
        autoComplete="cc-name"
        value={values.holderName}
        disabled={disabled}
        error={errors?.holderName}
        onChange={(event) => onChange({ ...values, holderName: event.target.value })}
      />
      <Input
        label="Número do cartão"
        name="card-number"
        inputMode="numeric"
        autoComplete="cc-number"
        value={values.number}
        disabled={disabled}
        error={errors?.number}
        placeholder="0000 0000 0000 0000"
        onChange={(event) =>
          onChange({ ...values, number: formatCardNumber(event.target.value) })
        }
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Validade"
          name="card-expiry"
          inputMode="numeric"
          autoComplete="cc-exp"
          value={values.expiry}
          disabled={disabled}
          error={errors?.expiry}
          placeholder="MM/AA"
          onChange={(event) => onChange({ ...values, expiry: formatExpiry(event.target.value) })}
        />
        <Input
          label="CVV"
          name="card-cvv"
          inputMode="numeric"
          autoComplete="cc-csc"
          value={values.cvv}
          disabled={disabled}
          error={errors?.cvv}
          placeholder="000"
          onChange={(event) =>
            onChange({
              ...values,
              cvv: event.target.value.replace(/\D/g, '').slice(0, 4),
            })
          }
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="card-installments" className="block text-sm font-medium text-text-primary">
          Parcelas
        </label>
        <select
          id="card-installments"
          name="card-installments"
          disabled={disabled || installmentOptions.length === 0}
          value={values.installments}
          onChange={(event) =>
            onChange({ ...values, installments: Number(event.target.value) || 1 })
          }
          className={`w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60 ${
            errors?.installments ? 'border-badge-discount' : ''
          }`}
        >
          {installmentOptions.length === 0 ? (
            <option value={1}>1x de {formatCurrency(baseTotal)}</option>
          ) : (
            installmentOptions.map((row) => (
              <option key={row.count} value={row.count}>
                {row.label}
                {!row.interestFree ? ` · total ${formatCurrency(row.total)}` : ''}
              </option>
            ))
          )}
        </select>
        {errors?.installments ? (
          <p className="text-xs text-badge-discount">{errors.installments}</p>
        ) : null}
      </div>

      {selected ? (
        <p className="text-xs text-text-secondary">
          Total no cartão:{' '}
          <span className="font-semibold text-text-primary">{formatCurrency(selected.total)}</span>
          {selected.interestFree ? ' · sem juros' : ' · com juros'}
        </p>
      ) : null}
    </div>
  )
}
