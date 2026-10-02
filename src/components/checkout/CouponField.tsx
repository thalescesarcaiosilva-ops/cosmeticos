'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { fetchApi } from '@/lib/api/fetch-api'
import {
  clearStoredCouponCode,
  readStoredCouponCode,
  writeStoredCouponCode,
} from '@/lib/checkout/coupon-storage'
import { formatCurrency } from '@/lib/products/format'

type CouponFieldProps = {
  merchandiseTotal: number
  onChange: (applied: { code: string; discountAmount: number }) => void
}

export function CouponField({ merchandiseTotal, onChange }: CouponFieldProps) {
  const [code, setCode] = useState('')
  const [appliedCode, setAppliedCode] = useState<string | null>(null)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let active = true
    const stored = readStoredCouponCode()

    if (!stored || merchandiseTotal <= 0) {
      if (!stored) {
        setAppliedCode(null)
        setDiscountAmount(0)
        onChangeRef.current({ code: '', discountAmount: 0 })
      }
      return
    }

    setCode(stored)
    setLoading(true)
    setError(null)

    void fetchApi<{ code: string; discountAmount: number }>('/api/checkout/coupon', {
      method: 'POST',
      body: JSON.stringify({ code: stored, merchandiseTotal }),
    }).then(({ data, error: apiError }) => {
      if (!active) return
      setLoading(false)
      if (apiError || !data) {
        clearStoredCouponCode()
        setAppliedCode(null)
        setDiscountAmount(0)
        setError(apiError ?? 'Cupom inválido')
        onChangeRef.current({ code: '', discountAmount: 0 })
        return
      }
      setAppliedCode(data.code)
      setCode(data.code)
      setDiscountAmount(data.discountAmount)
      onChangeRef.current({ code: data.code, discountAmount: data.discountAmount })
    })

    return () => {
      active = false
    }
  }, [merchandiseTotal])

  async function apply() {
    const next = code.trim()
    if (!next) {
      clearStoredCouponCode()
      setAppliedCode(null)
      setDiscountAmount(0)
      setError(null)
      onChange({ code: '', discountAmount: 0 })
      return
    }
    if (merchandiseTotal <= 0) {
      setError('Adicione produtos antes de usar o cupom')
      return
    }

    setLoading(true)
    setError(null)
    const { data, error: apiError } = await fetchApi<{ code: string; discountAmount: number }>(
      '/api/checkout/coupon',
      {
        method: 'POST',
        body: JSON.stringify({ code: next, merchandiseTotal }),
      }
    )
    setLoading(false)
    if (apiError || !data) {
      clearStoredCouponCode()
      setAppliedCode(null)
      setDiscountAmount(0)
      setError(apiError ?? 'Cupom inválido')
      onChange({ code: '', discountAmount: 0 })
      return
    }
    writeStoredCouponCode(data.code)
    setAppliedCode(data.code)
    setCode(data.code)
    setDiscountAmount(data.discountAmount)
    onChange({ code: data.code, discountAmount: data.discountAmount })
  }

  function remove() {
    clearStoredCouponCode()
    setCode('')
    setAppliedCode(null)
    setDiscountAmount(0)
    setError(null)
    onChange({ code: '', discountAmount: 0 })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Cupom"
          maxLength={40}
          autoComplete="off"
          aria-label="Cupom"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm uppercase text-text-primary placeholder:normal-case placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <Button type="button" variant="secondary" loading={loading} onClick={() => void apply()}>
          Aplicar
        </Button>
      </div>
      {appliedCode && discountAmount > 0 && (
        <p className="flex items-center justify-between gap-2 text-sm text-brand">
          <span>
            Cupom {appliedCode}: − {formatCurrency(discountAmount)}
          </span>
          <button type="button" onClick={remove} className="text-xs text-text-muted hover:text-text-secondary">
            Remover
          </button>
        </p>
      )}
      {error && <p className="text-xs text-badge-discount">{error}</p>}
    </div>
  )
}
