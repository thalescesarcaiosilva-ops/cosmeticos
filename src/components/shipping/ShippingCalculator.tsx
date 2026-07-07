'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/products/format'
import type { ShippingQuoteLine, ShippingQuoteResult } from '@/types/shipping'

const CEP_STORAGE_KEY = 'loja-cep-v1'

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

  return (
    <div className={isProduct ? 'space-y-3 border-t border-border pt-6' : compact ? 'space-y-3' : 'space-y-4'}>
      <div>
        <p className="text-sm font-semibold text-text-primary">
          {isProduct ? 'Calcular frete e prazo' : 'Calcular frete'}
        </p>
        {!compact && !isProduct && (
          <p className="mt-1 text-xs text-text-muted">
            Informe seu CEP para ver prazos e valores de entrega.
          </p>
        )}
      </div>

      <div className={isProduct ? 'relative' : 'flex gap-2'}>
        {isProduct ? (
          <>
            <input
              type="text"
              value={cep}
              onChange={(e) => setCep(formatCep(e.target.value))}
              placeholder="Digite seu CEP"
              inputMode="numeric"
              aria-label="CEP para cálculo de frete"
              className="w-full border border-border bg-surface py-3 pl-4 pr-28 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="button"
              onClick={calculate}
              disabled={loading}
              className="absolute right-1 top-1 bottom-1 border-border px-4 text-sm font-semibold text-text-primary "
            >
              {loading ? '...' : 'Calcular'}
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {isProduct && (
        <a
          href={CEP_LOOKUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-text-secondary underline underline-offset-2 hover:text-brand"
        >
          Não sei meu CEP
        </a>
      )}

      {error && <Alert type="error">{error}</Alert>}

      {isProduct && (
        <p style={{ color: 'black' }} className="rounded-lg bg-surface-muted px-4 py-3 text-xs leading-relaxed">
          Os prazos de entrega começam a contar a partir do faturamento do pedido e podem variar de
          acordo com a quantidade de produtos no carrinho.
        </p>
      )}

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
                      <p className="mt-1 text-xs text-text-muted">{option.deliveryLabel}</p>
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
    </div>
  )
}

export type { ShippingQuoteLine }
