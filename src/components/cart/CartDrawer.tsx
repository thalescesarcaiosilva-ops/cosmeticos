'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ShoppingBag, ArrowRight, Truck, CreditCard, Zap } from 'lucide-react'
import { CartLineItem } from '@/components/cart/CartLineItem'
import { Button } from '@/components/ui/Button'
import { useCartSync } from '@/hooks/useCartSync'
import { usePaymentInfo } from '@/hooks/usePaymentInfo'
import { useCart } from '@/providers/CartProvider'
import { calcInstallmentDisplay } from '@/lib/payment/installments'
import { calcPixPrice } from '@/lib/payment/product-payment-summary'
import { formatCurrency } from '@/lib/products/format'
import type { CartSyncResult } from '@/types/cart'
import type { CheckoutPaymentSettings, PaymentSettings } from '@/types/payment'

/* --------------------------------------------------------------------------
   Skeleton
-------------------------------------------------------------------------- */
function DrawerSkeleton() {
  return (
    <div className="divide-y divide-border px-4" aria-busy="true">
      {[1, 2].map((i) => (
        <div key={i} className="flex gap-4 py-5">
          <div className="size-20 shrink-0 animate-pulse rounded-lg bg-surface-muted" />
          <div className="flex flex-1 flex-col gap-3 pt-1">
            <div className="h-4 w-3/4 animate-pulse rounded bg-surface-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-muted" />
            <div className="h-8 w-24 animate-pulse rounded bg-surface-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* --------------------------------------------------------------------------
   Resumo financeiro (subtotal, descontos, pix, parcelas, frete)
-------------------------------------------------------------------------- */
function DrawerSummary({
  data,
  paymentSettings,
  checkoutSettings,
  loading,
}: {
  data: CartSyncResult
  paymentSettings: PaymentSettings | null
  checkoutSettings: CheckoutPaymentSettings | null
  loading: boolean
}) {
  const total = data.merchandiseTotal
  const hasBundle = data.bundleDiscountAmount > 0

  /* Pix */
  const pixEnabled = checkoutSettings?.pixEnabled !== false
  const pixDiscount = Number(checkoutSettings?.pixDiscount ?? 0) || 0
  const showPixBadge = pixEnabled && pixDiscount > 0
  const pixPrice = showPixBadge ? calcPixPrice(total, pixDiscount) : total

  /* Parcelas */
  const installment = paymentSettings
    ? calcInstallmentDisplay(total, paymentSettings)
    : null
  const showInstallments =
    checkoutSettings?.cardEnabled !== false &&
    installment != null &&
    installment.count > 1

  const valuePlaceholder = loading ? '…' : null

  return (
    <dl className="space-y-2 text-sm">
      {/* Subtotal (antes de descontos) */}
      {hasBundle && (
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">Subtotal</dt>
          <dd className="tabular-nums text-text-primary">
            {valuePlaceholder ?? formatCurrency(data.subtotal)}
          </dd>
        </div>
      )}

      {/* Desconto Compre Junto */}
      {hasBundle && (
        <div className="flex justify-between gap-3 text-claret">
          <dt>Desconto Compre Junto</dt>
          <dd className="font-semibold tabular-nums">
            − {valuePlaceholder ?? formatCurrency(data.bundleDiscountAmount)}
          </dd>
        </div>
      )}

      {/* Subtotal dos produtos (após desconto CJ) */}
      <div className="flex justify-between gap-3 border-t border-border pt-2">
        <dt className="font-semibold text-text-primary">
          {hasBundle ? 'Total produtos' : 'Subtotal'}
        </dt>
        <dd className="text-base font-bold text-text-primary tabular-nums">
          {valuePlaceholder ?? formatCurrency(total)}
        </dd>
      </div>

      {/* Frete */}
      <div className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-1.5 text-text-secondary">
          <Truck className="size-3.5 shrink-0" />
          Frete
        </dt>
        <dd className="text-xs text-text-muted">Calculado no checkout</dd>
      </div>

      {/* Pix */}
      {showPixBadge && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-surface-strong/70 px-2.5 py-2">
          <dt className="flex items-center gap-1.5 text-[12px] font-semibold text-text-primary">
            <Zap className="size-3.5 shrink-0 text-brand" />
            Pix ({pixDiscount}% off)
          </dt>
          <dd className="text-[13px] font-bold text-claret tabular-nums">
            {valuePlaceholder ?? formatCurrency(pixPrice)}
          </dd>
        </div>
      )}

      {/* Parcelas */}
      {showInstallments && installment && (
        <div className="flex items-start gap-1.5 rounded-md bg-surface-strong/70 px-2.5 py-2">
          <CreditCard className="mt-0.5 size-3.5 shrink-0 text-text-muted" />
          <p className="text-[11px] leading-snug text-text-secondary">
            Cartão: {installment.count}x de{' '}
            <span className="font-semibold text-text-primary">
              {formatCurrency(installment.value)}
            </span>{' '}
            {installment.interestFree ? 'sem juros' : 'com juros'}
          </p>
        </div>
      )}
    </dl>
  )
}

/* --------------------------------------------------------------------------
   Conteúdo interno (lazy-montado após o primeiro open)
-------------------------------------------------------------------------- */
function CartDrawerInner({ onClose }: { onClose: () => void }) {
  const { data, loading: cartLoading } = useCartSync()
  const { info: paymentInfo, loading: paymentLoading } = usePaymentInfo()
  const { itemCount } = useCart()

  const loading = cartLoading || paymentLoading
  const isEmpty = itemCount === 0 && !cartLoading
  const hasItems = Boolean(data && data.lines.length > 0)

  return (
    <>
      {/* Lista de itens */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {cartLoading && !data ? (
          <DrawerSkeleton />
        ) : hasItems ? (
          <ul role="list" className="divide-y divide-border px-4">
            {data!.lines.map((line) => (
              <CartLineItem key={line.productId} line={line} updating={cartLoading} />
            ))}
          </ul>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
            <ShoppingBag className="size-12 text-text-muted" strokeWidth={1.2} />
            <div>
              <p className="text-base font-semibold text-text-primary">Carrinho vazio</p>
              <p className="mt-1 text-sm text-text-secondary">
                Adicione produtos para continuar
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 text-sm font-semibold text-brand underline-offset-2 hover:underline"
            >
              Continuar comprando
            </button>
          </div>
        ) : null}
      </div>

      {/* Rodapé */}
      {hasItems && data && (
        <div className="shrink-0 border-t border-border bg-surface px-4 pb-6 pt-4">
          {/* Resumo financeiro */}
          <DrawerSummary
            data={data}
            paymentSettings={paymentInfo?.paymentSettings ?? null}
            checkoutSettings={paymentInfo?.checkoutSettings ?? null}
            loading={loading}
          />

          {/* CTA principal */}
          <Link href="/checkout" onClick={onClose} className="mt-4 block">
            <Button
              type="button"
              className="w-full !rounded-md py-3.5 text-base"
              disabled={loading}
            >
              Finalizar compra
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </Link>

          {/* Link secundário */}
          <Link
            href="/carrinho"
            onClick={onClose}
            className="mt-2.5 block text-center text-sm font-semibold text-brand underline-offset-2 hover:underline"
          >
            Ver carrinho completo
          </Link>
        </div>
      )}
    </>
  )
}

/* --------------------------------------------------------------------------
   Drawer principal (portal)
-------------------------------------------------------------------------- */
export function CartDrawer() {
  const { isCartDrawerOpen, closeCartDrawer, itemCount } = useCart()
  const [mounted, setMounted] = useState(false)
  const [everOpened, setEverOpened] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isCartDrawerOpen) setEverOpened(true)
  }, [isCartDrawerOpen])

  useEffect(() => {
    if (isCartDrawerOpen) {
      const t = setTimeout(() => closeButtonRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [isCartDrawerOpen])

  useEffect(() => {
    document.body.style.overflow = isCartDrawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isCartDrawerOpen])

  useEffect(() => {
    if (!isCartDrawerOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeCartDrawer()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isCartDrawerOpen, closeCartDrawer])

  if (!mounted) return null

  return createPortal(
    <>
      {/* Overlay */}
      <div
        role="presentation"
        className={`fixed inset-0 z-[300] bg-black/50 transition-opacity duration-300 ${
          isCartDrawerOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeCartDrawer}
      />

      {/* Painel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Carrinho${itemCount > 0 ? `, ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}` : ''}`}
        className={`fixed inset-y-0 right-0 z-[310] flex h-[100dvh] w-[min(100%,420px)] flex-col bg-surface shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          isCartDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Cabeçalho */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-text-primary">
            <ShoppingBag className="size-5" />
            Meu Carrinho
            {itemCount > 0 && (
              <span className="rounded-full bg-claret px-2 py-0.5 text-xs font-bold text-white">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeCartDrawer}
            aria-label="Fechar carrinho"
            className="flex size-9 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Conteúdo lazy */}
        {everOpened ? (
          <CartDrawerInner onClose={closeCartDrawer} />
        ) : (
          <div className="flex flex-1 flex-col">
            <DrawerSkeleton />
          </div>
        )}
      </aside>
    </>,
    document.body
  )
}
