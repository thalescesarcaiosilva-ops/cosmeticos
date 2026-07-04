'use client'

import { IconMinus, IconPlus } from '@/components/icons/DotIcons'

type QuantityControlProps = {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
  label: string
}

export function QuantityControl({
  value,
  min = 1,
  max,
  onChange,
  disabled = false,
  label,
}: QuantityControlProps) {
  return (
    <div
      className="inline-flex items-center rounded-md border border-border"
      role="group"
      aria-label={`Quantidade de ${label}`}
    >
      <button
        type="button"
        className="flex size-9 items-center justify-center text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Diminuir quantidade de ${label}`}
      >
        <IconMinus className="size-4" />
      </button>
      <span
        className="min-w-[2.5rem] border-x border-border px-2 text-center text-sm font-semibold tabular-nums"
        aria-live="polite"
        aria-atomic="true"
      >
        {value}
      </span>
      <button
        type="button"
        className="flex size-9 items-center justify-center text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Aumentar quantidade de ${label}`}
      >
        <IconPlus className="size-4" />
      </button>
    </div>
  )
}
