'use client'

import { formatCurrency } from '@/lib/products/format'
import { buildQuantityPackOptions, type QuantityPackQuote } from '@/lib/products/quantity-packs'

type ProductQuantityPackSelectorProps = {
  unitPrice: number
  maxQuantity: number
  selectedQuantity: number
  onSelect: (quantity: number) => void
  disabled?: boolean
}

const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
}

function PackCard({
  pack,
  selected,
  onSelect,
  disabled,
}: {
  pack: QuantityPackQuote
  selected: boolean
  onSelect: () => void
  disabled?: boolean
}) {
  const showDiscount = pack.discountPercent > 0 && pack.savings > 0

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={[
        'relative flex min-w-0 flex-col rounded-2xl border px-2.5 pb-3 pt-5 text-left transition-colors sm:px-3.5',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-brand bg-[#fff4f8]'
          : 'border-[#e8e0e4] bg-white hover:border-brand/40',
      ].join(' ')}
    >
      {showDiscount ? (
        <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#1a1014] px-2.5 py-1 text-[10px] font-bold leading-none tracking-[0.04em] text-[#f5d76e] sm:text-[11px]">
          {pack.discountPercent}% OFF
        </span>
      ) : null}

      <span
        className={[
          'absolute right-2 top-2 size-3.5 rounded-full border-2 sm:right-2.5 sm:top-2.5 sm:size-4',
          selected ? 'border-brand bg-brand' : 'border-[#cfc4c9] bg-white',
        ].join(' ')}
        aria-hidden
      />

      <span className="text-[12.5px] font-semibold leading-tight text-text-primary sm:text-[14px]">
        Compre {pack.quantity}
      </span>
      <span className="mt-0.5 text-[14px] font-bold leading-tight tabular-nums text-text-primary sm:text-[17px]">
        {formatCurrency(pack.total)}
      </span>
      <span className="mt-0.5 text-[10.5px] leading-tight text-text-muted tabular-nums sm:text-[11px]">
        {formatCurrency(pack.unitPrice)} cada
      </span>

      {showDiscount ? (
        <span className="mt-1.5 text-[10.5px] font-bold leading-tight tabular-nums text-brand sm:text-[11px]">
          Economize {formatCurrency(pack.savings)}
        </span>
      ) : null}
    </button>
  )
}

export function ProductQuantityPackSelector({
  unitPrice,
  maxQuantity,
  selectedQuantity,
  onSelect,
  disabled = false,
}: ProductQuantityPackSelectorProps) {
  const packs = buildQuantityPackOptions(unitPrice, maxQuantity)
  if (packs.length === 0) return null

  const safeSelected =
    packs.find((pack) => pack.quantity === selectedQuantity)?.quantity ?? packs[0]!.quantity

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="text-sm font-bold text-text-primary">Escolha a quantidade</legend>
      <div
        className={`mt-2 grid gap-2 pt-2.5 sm:gap-2.5 ${GRID_COLS[packs.length] ?? 'grid-cols-3'}`}
        role="radiogroup"
        aria-label="Quantidade"
      >
        {packs.map((pack) => (
          <PackCard
            key={pack.quantity}
            pack={pack}
            selected={pack.quantity === safeSelected}
            disabled={disabled}
            onSelect={() => onSelect(pack.quantity)}
          />
        ))}
      </div>
    </fieldset>
  )
}
