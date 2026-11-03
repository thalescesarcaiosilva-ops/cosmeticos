'use client'

import { useCallback, useEffect, useState } from 'react'
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
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl bg-[#e7f6ec] px-4 py-3.5">
          <p className="text-[14px] font-bold leading-tight text-[#1d6b3a]">
            {FREE_SHIPPING_LABEL}
          </p>
          <p className="text-[13px] font-semibold leading-tight text-[#1d6b3a]">
            Já vale para todo o Brasil
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="product-cep" className="block text-[12.5px] text-text-muted">
            Seu CEP
          </label>
          <div className="flex gap-2">
            <input
              id="product-cep"
              type="text"
              value={cep}
              onChange={(e) => setCep(formatCep(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void calculate()
                }
              }}
              placeholder="00000-000"
              inputMode="numeric"
              aria-label="CEP para cálculo de frete"
              className="h-12 min-w-0 flex-1 rounded-full border border-[#e3dade] bg-white px-5 text-[15px] text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
            <button
              type="button"
              onClick={calculate}
              disabled={loading}
              className="h-12 shrink-0 rounded-full bg-[#0d0b0c] px-6 text-[12.5px] font-bold tracking-[0.1em] text-white transition-opacity hover:opacity-90 disabled:opacity-70 sm:px-7"
            >
              {loading ? '...' : 'CALCULAR'}
            </button>
          </div>
          <a
            href={CEP_LOOKUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[12px] text-text-muted underline underline-offset-2 hover:text-brand"
          >
            Não sei meu CEP
          </a>
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
