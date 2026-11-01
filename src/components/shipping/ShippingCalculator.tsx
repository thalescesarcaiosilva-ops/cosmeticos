'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calculator, Check, Info, Truck } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/products/format'
import { ARRIVAL_WINDOW_NOTE } from '@/lib/shipping/arrival-window'
import { CEP_STORAGE_KEY, FREE_SHIPPING_LABEL } from '@/lib/shipping/merchant-shipping'
import type { ShippingQuoteLine, ShippingQuoteResult } from '@/types/shipping'

type ShippingCalculatorProps = {
  subtotal: number
  compact?: boolean
  variant?: 'default' | 'product'
  onSelect?: (option: ShippingQuoteLine | null) => void
}

const CEP_LOOKUP_URL = 'https://buscacepinter.correios.com.br/app/endereco/index.php'

function formatCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function readStoredCep(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(CEP_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeStoredCep(cep: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CEP_STORAGE_KEY, cep)
  } catch {
    // ignore
  }
}

export function ShippingCalculator({
  subtotal,
  compact = false,
  variant = 'default',
  onSelect,
}: ShippingCalculatorProps) {
  const [cep, setCep] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quote, setQuote] = useState<ShippingQuoteResult | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    setCep(readStoredCep())
  }, [])

  const calculate = useCallback(async () => {
    setError(null)
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) {
      setError('Informe um CEP válido com 8 dígitos')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cep: digits, subtotal }),
      })
      const json = await res.json()

      if (json.error || !json.data) {
        setError(json.message ?? 'Não foi possível calcular o frete')
        setQuote(null)
        onSelect?.(null)
        return
      }

      const result = json.data as ShippingQuoteResult
      setQuote(result)
      writeStoredCep(formatCep(digits))

      if (result.options.length === 0) {
        setError('Nenhuma forma de frete disponível para este CEP')
        onSelect?.(null)
        return
      }

      const first = result.options[0]
      setSelectedId(first.methodId)
      onSelect?.(first)
    } catch {
      setError('Não foi possível calcular o frete')
      onSelect?.(null)
    } finally {
      setLoading(false)
    }
  }, [cep, subtotal, onSelect])

  function handleSelect(option: ShippingQuoteLine) {
    setSelectedId(option.methodId)
    onSelect?.(option)
  }

  const isProduct = variant === 'product'

  if (isProduct) {
    return (
      <div className="overflow-hidden rounded-3xl border border-[#f3d0dc] bg-white">
        <div className="flex flex-col gap-3 bg-[#e7f6ec] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Truck className="size-7 shrink-0 text-[#178a45]" strokeWidth={1.75} aria-hidden />
            <p className="text-[15px] font-bold leading-tight text-[#178a45] sm:text-[17px]">
              {FREE_SHIPPING_LABEL}
            </p>
          </div>
          <span className="hidden h-8 w-px shrink-0 bg-[#178a45]/25 sm:block" aria-hidden />
          <p className="flex items-center gap-2 text-[13px] font-semibold leading-snug text-[#178a45]">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#178a45] text-white">
              <Check className="size-3.5" strokeWidth={3} aria-hidden />
            </span>
            Já vale para todo o Brasil
          </p>
        </div>

        <div className="space-y-3 px-4 py-4 sm:px-5">
          <label htmlFor="product-cep" className="block text-[13px] text-text-secondary">
            Seu CEP
          </label>
          <div className="flex gap-2">
            <input
              id="product-cep"
              type="text"
              value={cep}
              onChange={(e) => setCep(formatCep(e.target.value))}
              placeholder="00000-000"
              inputMode="numeric"
              aria-label="CEP para cálculo de frete"
              className="min-w-0 flex-1 rounded-full border border-[#eadfe4] bg-white px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
            <button
              type="button"
              onClick={calculate}
              disabled={loading}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#1a1014] px-4 text-[12px] font-bold tracking-[0.08em] text-white transition-opacity hover:opacity-90 disabled:opacity-70 sm:px-5"
            >
              <Calculator className="size-4" aria-hidden />
              {loading ? '...' : 'CALCULAR'}
            </button>
          </div>
          <p className="flex items-start gap-1.5 text-[12.5px] text-text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <a
                href={CEP_LOOKUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-brand"
              >
                Não sei meu CEP
              </a>
              <span> · O prazo de cada modalidade continua o mesmo.</span>
            </span>
          </p>
          {error && <Alert type="error">{error}</Alert>}
          {quote && quote.options.length > 0 && (
            <ul className="space-y-2" role="list">
              {quote.options.map((option) => {
                const selected = selectedId === option.methodId
                return (
                  <li key={option.methodId}>
                    <button
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                        selected
                          ? 'border-brand bg-brand/5'
                          : 'border-[#f3d0dc] bg-surface hover:border-brand/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{option.name}</p>
                          {option.description && (
                            <p className="mt-0.5 text-xs text-text-secondary">{option.description}</p>
                          )}
                          <p className="mt-1 text-xs text-text-muted">
                            {option.arrivalLabel
                              ? `${option.deliveryLabel} em trânsito`
                              : option.deliveryLabel}
                          </p>
                          {option.arrivalLabel ? (
                            <p className="mt-0.5 text-xs font-medium text-text-primary">
                              {option.arrivalLabel}
                            </p>
                          ) : null}
                        </div>
                        <p className="shrink-0 text-sm font-bold text-brand tabular-nums">
                          {option.isFree ? 'Grátis' : formatCurrency(option.price)}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {quote && quote.options.some((option) => option.arrivalLabel) ? (
            <p className="text-[11px] leading-relaxed text-text-muted">{ARRIVAL_WINDOW_NOTE}</p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div>
        <p className="text-[15px] font-bold text-[#3b1530]">Calcular frete</p>
        <p className="mt-1 text-xs text-text-muted">
          {FREE_SHIPPING_LABEL}. O prazo de cada modalidade continua o mesmo.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          label="CEP"
          value={cep}
          onChange={(e) => setCep(formatCep(e.target.value))}
          placeholder="00000-000"
          inputMode="numeric"
          className="flex-1"
          aria-label="CEP para cálculo de frete"
        />
        <div className="flex items-end">
          <Button type="button" variant="secondary" loading={loading} onClick={calculate}>
            Calcular
          </Button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {quote && quote.options.length > 0 && (
        <ul className="space-y-2" role="list">
          {quote.options.map((option) => {
            const selected = selectedId === option.methodId
            return (
              <li key={option.methodId}>
                <button
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                    selected
                      ? 'border-brand bg-brand/5'
                      : 'border-border bg-surface hover:border-brand/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{option.name}</p>
                      {option.description && (
                        <p className="mt-0.5 text-xs text-text-secondary">{option.description}</p>
                      )}
                      <p className="mt-1 text-xs text-text-muted">
                        {option.arrivalLabel ? `${option.deliveryLabel} em trânsito` : option.deliveryLabel}
                      </p>
                      {option.arrivalLabel ? (
                        <p className="mt-0.5 text-xs font-medium text-text-primary">
                          {option.arrivalLabel}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-sm font-bold text-brand tabular-nums">
                      {option.isFree ? 'Grátis' : formatCurrency(option.price)}
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {quote && quote.options.some((option) => option.arrivalLabel) ? (
        <p className="text-[11px] leading-relaxed text-text-muted">{ARRIVAL_WINDOW_NOTE}</p>
      ) : null}
    </div>
  )
}

export type { ShippingQuoteLine }
