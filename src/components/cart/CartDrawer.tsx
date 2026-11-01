'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ShoppingBag, ArrowRight, Truck } from 'lucide-react'
import { CartLineItem } from '@/components/cart/CartLineItem'
import { useCartSync } from '@/hooks/useCartSync'
import { trackFunnel } from '@/lib/analytics/track-funnel'
import { usePaymentInfo } from '@/hooks/usePaymentInfo'
import { useCart } from '@/providers/CartProvider'
import { formatCurrency } from '@/lib/products/format'
import { CEP_STORAGE_KEY } from '@/lib/shipping/merchant-shipping'
import type { CartSyncResult } from '@/types/cart'
import type { CheckoutPaymentSettings } from '@/types/payment'

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
function readStoredCep(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(CEP_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function DrawerSummary({
  data,
  checkoutSettings,
  loading,
}: {
  data: CartSyncResult
  checkoutSettings: CheckoutPaymentSettings | null
  loading: boolean
}) {
  const payable = data.merchandiseTotal
  const [deliveryPlace, setDeliveryPlace] = useState<string | null>(null)
  const hasBundle = data.bundleDiscountAmount > 0

  const pixEnabled = checkoutSettings?.pixEnabled !== false
  const pixDiscount = Number(checkoutSettings?.pixDiscount ?? 0) || 0
  const showPix = pixEnabled && pixDiscount > 0
  const pixDiscountAmount = showPix
    ? Math.round(payable * (pixDiscount / 100) * 100) / 100
    : 0
  const pixTotal = Math.max(payable - pixDiscountAmount, 0)
  const productLabel = data.itemCount === 1 ? '1 produto' : `${data.itemCount} produtos`
  const valuePlaceholder = loading ? '…' : null

  useEffect(() => {
    const digits = readStoredCep().replace(/\D/g, '')
    if (digits.length !== 8) return
    let active = true
    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((res) => res.json())
      .then((json: { localidade?: string; uf?: string; erro?: boolean }) => {
        if (!active || json.erro || !json.localidade || !json.uf) return
        setDeliveryPlace(`${json.localidade}/${json.uf}`)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="space-y-3">
      <div>
        <p className="text-center text-[13px] font-bold text-[#178a45]">
          Você ganhou frete grátis!
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#d9f3e4]">
          <div className="h-full w-full rounded-full bg-[#178a45]" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f4f6f8] px-3.5 py-3 text-[13px]">
        <p className="flex min-w-0 items-center gap-2 font-medium text-text-primary">
          <Truck className="size-4 shrink-0 text-[#3b1530]" aria-hidden />
          <span className="truncate">
            {deliveryPlace ? `Entrega para ${deliveryPlace}` : 'Entrega para todo o Brasil'}
          </span>
        </p>
        <p className="shrink-0 font-semibold text-text-primary">Grátis</p>
      </div>

      <dl className="space-y-2 text-[13px]">
        {hasBundle ? (
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Produtos</dt>
            <dd className="tabular-nums text-text-primary">
              {valuePlaceholder ?? formatCurrency(data.subtotal)}
            </dd>
          </div>
        ) : null}

        {hasBundle ? (
          <div className="flex justify-between gap-3 text-[#178a45]">
            <dt>Desconto Compre Junto</dt>
            <dd className="font-semibold tabular-nums">
              − {valuePlaceholder ?? formatCurrency(data.bundleDiscountAmount)}
            </dd>
          </div>
        ) : null}

        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">Subtotal ({productLabel})</dt>
          <dd className="font-medium tabular-nums text-text-primary">
            {valuePlaceholder ?? formatCurrency(data.merchandiseTotal)}
          </dd>
        </div>

        {showPix ? (
          <div className="flex justify-between gap-3 text-[#178a45]">
            <dt className="font-medium">Desconto no PIX</dt>
            <dd className="font-semibold tabular-nums">
              − {valuePlaceholder ?? formatCurrency(pixDiscountAmount)}
            </dd>
          </div>
        ) : null}

        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">Entrega padrão</dt>
          <dd className="font-medium text-text-primary">Grátis</dd>
        </div>

        <div className="flex items-end justify-between gap-3 pt-1">
          <dt className="text-base font-bold text-text-primary">
            {showPix ? 'Total no PIX' : 'Total'}
          </dt>
          <dd className="text-lg font-bold tabular-nums text-text-primary">
            {valuePlaceholder ?? formatCurrency(showPix ? pixTotal : payable)}
          </dd>
        </div>
      </dl>
    </div>
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
            checkoutSettings={paymentInfo?.checkoutSettings ?? null}
            loading={loading}
          />

          <Link
            href="/checkout"
            onClick={onClose}
            aria-disabled={loading}
            className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[15px] font-bold tracking-[0.04em] text-white shadow-[0_10px_24px_rgba(211,52,100,0.35)] transition-transform hover:-translate-y-0.5 ${loading ? 'pointer-events-none opacity-70' : ''}`}
          >
            Finalizar compra
            <ArrowRight className="size-4" aria-hidden />
          </Link>

          <div className="mt-3 flex items-center justify-between gap-3">
            <Link
              href="/carrinho"
              onClick={onClose}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-[#e4d7de] bg-white text-sm font-semibold text-text-primary"
            >
              Ver sacola
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-center text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              Continuar comprando
            </button>
          </div>
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
    if (!isCartDrawerOpen) return
    setEverOpened(true)
    if (itemCount > 0) trackFunnel('cart')
  }, [isCartDrawerOpen, itemCount])

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
        <div className="flex shrink-0 items-center justify-between bg-[#1a1014] px-4 py-4 text-white">
          <div>
            <p className="text-[11px] font-bold tracking-[0.14em] text-brand">PRÉ BLACK FRIDAY</p>
            <h2 className="mt-1 flex items-center gap-2 text-base font-bold">
              <ShoppingBag className="size-5" />
              Meu carrinho
              {itemCount > 0 && (
                <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeCartDrawer}
            aria-label="Fechar carrinho"
            className="flex size-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
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
