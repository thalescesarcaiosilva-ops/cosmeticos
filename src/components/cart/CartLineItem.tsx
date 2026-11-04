'use client'

import { SiteImage } from '@/components/ui/SiteImage'
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

  const bundleDiscount = line.bundleDiscountAmount ?? 0
  const hasBundleDiscount = line.available && bundleDiscount > 0
  const displayTotal = line.displayLineTotal ?? line.lineTotal
  const savings = Math.max(0, line.lineTotal - displayTotal)

  function handleRemove() {
    setRemoving(true)
    removeItem(line.productId)
  }

  return (
    <li
      className={`border-b border-border py-5 transition-opacity duration-200 last:border-0 ${updating || removing ? 'opacity-55' : ''}`}
    >
      <div className="flex gap-3 sm:gap-4">
        <Link
          href={`/produto/${line.slug}`}
          className="relative size-[72px] shrink-0 overflow-hidden rounded-xl bg-surface-strong sm:size-[88px]"
        >
          {line.imageUrl ? (
            <SiteImage
              src={line.imageUrl}
              alt={line.imageAlt}
              fill
              sizes="88px"
              className="object-contain p-2"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-text-muted">
              Sem imagem
            </span>
          )}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/produto/${line.slug}`}
                className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary transition-colors hover:text-brand sm:text-[15px]"
              >
                {line.name}
              </Link>
              <p className="mt-1 text-[13px] text-text-muted tabular-nums">
                {formatCurrency(line.price)} cada
              </p>
              {!line.available && (
                <p className="mt-2 text-xs font-medium text-badge-discount">Indisponível</p>
              )}
              {hasBundleDiscount && (
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

            <button
              type="button"
              onClick={handleRemove}
              className="shrink-0 p-1 text-text-muted transition-colors hover:text-badge-discount"
              aria-label={`Remover ${line.name} do carrinho`}
            >
              <IconTrash className="size-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
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

            <div className="ml-auto text-right">
              {hasBundleDiscount ? (
                <>
                  <p className="text-sm text-text-muted line-through tabular-nums">
                    {formatCurrency(line.lineTotal)}
                  </p>
                  <p className="mt-0.5 text-lg font-black leading-none text-brand tabular-nums sm:text-xl">
                    {formatCurrency(displayTotal)}
                  </p>
                  {savings > 0 ? (
                    <p className="mt-1 text-[12px] font-medium text-success">
                      Você economiza {formatCurrency(savings)}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-base font-bold text-text-primary tabular-nums">
                  {formatCurrency(displayTotal)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}
