'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { QuantityControl } from '@/components/cart/QuantityControl'
import { IconTrash } from '@/components/icons/DotIcons'
import { formatCurrency } from '@/lib/products/format'
import { useCart } from '@/providers/CartProvider'
import type { ValidatedCartLine } from '@/types/cart'

type CartLineItemProps = {
  line: ValidatedCartLine
  updating?: boolean
}

export function CartLineItem({ line, updating = false }: CartLineItemProps) {
  const { setQuantity, removeItem } = useCart()
  const [removing, setRemoving] = useState(false)

  function handleRemove() {
    setRemoving(true)
    removeItem(line.productId)
  }

  return (
    <li
      className={`flex gap-4 py-5 transition-opacity duration-200 last:border-0 ${updating || removing ? 'opacity-55' : ''}`}
    >
      <Link
        href={`/produto/${line.slug}`}
        className="relative size-[88px] shrink-0 overflow-hidden rounded-lg bg-surface-strong/70 sm:size-24"
      >
        {line.imageUrl ? (
          <Image
            src={line.imageUrl}
            alt={line.imageAlt}
            fill
            sizes="96px"
            className="object-contain p-2"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-text-muted">
            Sem imagem
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Link
            href={`/produto/${line.slug}`}
            className="line-clamp-2 text-sm font-medium leading-snug text-text-primary transition-colors hover:text-brand sm:text-[15px]"
          >
            {line.name}
          </Link>

          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            {line.originalPrice != null && line.originalPrice > line.price && (
              <p className="text-xs text-text-muted line-through tabular-nums">
                {formatCurrency(line.originalPrice)}
              </p>
            )}
            <p className="text-base font-bold text-text-primary tabular-nums">
              {formatCurrency(line.price)}
            </p>
          </div>

          {!line.available && (
            <p className="mt-2 text-xs font-medium text-badge-discount">Indisponível</p>
          )}
          {line.available && (line.bundleDiscountAmount ?? 0) > 0 && (
            <p className="mt-2 inline-flex rounded-full bg-surface-strong px-2 py-0.5 text-[11px] font-medium text-claret">
              Desconto Compre Junto
            </p>
          )}
          {line.quantityAdjusted && line.available && (
            <p className="mt-2 text-xs text-text-secondary">
              Quantidade ajustada ao estoque ({line.stock} disponíveis)
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end sm:gap-2.5">
          {line.available ? (
            <QuantityControl
              value={line.quantity}
              max={Math.min(99, line.stock)}
              onChange={(qty) => setQuantity(line.productId, qty)}
              disabled={updating}
              label={line.name}
            />
          ) : (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs font-medium text-badge-discount hover:underline"
            >
              Remover indisponível
            </button>
          )}

          <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1.5">
            <div className="text-right">
              {(line.bundleDiscountAmount ?? 0) > 0 && (
                <p className="text-xs text-text-muted line-through tabular-nums">
                  {formatCurrency(line.lineTotal)}
                </p>
              )}
              <p className="text-sm font-bold text-text-primary tabular-nums sm:text-base">
                {formatCurrency(line.displayLineTotal ?? line.lineTotal)}
              </p>
            </div>
            {line.available && (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-badge-discount"
                aria-label={`Remover ${line.name} do carrinho`}
              >
                <IconTrash className="size-3.5" />
                <span>Remover</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
