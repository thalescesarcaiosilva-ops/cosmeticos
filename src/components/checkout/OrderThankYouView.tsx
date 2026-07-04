'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CheckoutPixPanel } from '@/components/checkout/CheckoutPixPanel'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { fetchApi } from '@/lib/api/fetch-api'
import {
  clearGuestOrderToken,
  guestOrderHeaders,
  guestOrderQuery,
  storeGuestOrderToken,
} from '@/lib/checkout/guest-access'
import { formatCurrency } from '@/lib/products/format'

type OrderItem = {
  id: string
  quantity: number
  unit_price: number
  subtotal: number
  products: { name: string; slug: string } | null
}

type OrderDetail = {
  id: string
  status: string
  payment_status: string
  payment_method: string | null
  total: number
  subtotal: number | null
  shipping_price: number | null
  discount_amount: number | null
  shipping_method_name: string | null
  pix_qr_code: string | null
  pix_expiration: string | null
  created_at: string
  order_items: OrderItem[]
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando pagamento',
  confirmed: 'Pagamento confirmado',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: 'Pix',
  credit_card: 'Cartão de crédito',
}

export function OrderThankYouView({
  orderId,
  initialToken,
}: {
  orderId: string
  initialToken?: string | null
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    if (initialToken) {
      storeGuestOrderToken(orderId, initialToken)
    }
  }, [orderId, initialToken])

  useEffect(() => {
    let active = true

    async function load() {
      const { data, error: apiError } = await fetchApi<OrderDetail>(
        `/api/checkout/orders/${orderId}${guestOrderQuery(orderId)}`,
        { headers: guestOrderHeaders(orderId) }
      )
      if (!active) return
      setLoading(false)
      if (apiError || !data) {
        setError(apiError ?? 'Pedido não encontrado')
        return
      }
      setOrder(data)
      if (data.status === 'confirmed' || data.payment_status === 'paid') {
        clearGuestOrderToken(orderId)
      }
    }

    load()
    const interval = setInterval(load, 4000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [orderId])

  async function refreshPaymentStatus() {
    setPolling(true)
    await fetchApi(`/api/checkout/orders/${orderId}/payment-status${guestOrderQuery(orderId)}`, {
      headers: guestOrderHeaders(orderId),
    })
    const { data } = await fetchApi<OrderDetail>(
      `/api/checkout/orders/${orderId}${guestOrderQuery(orderId)}`,
      { headers: guestOrderHeaders(orderId) }
    )
    if (data) setOrder(data)
    setPolling(false)
  }

  if (loading && !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-text-secondary">Carregando pedido…</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert type="error">{error ?? 'Pedido não encontrado'}</Alert>
        <Link href="/conta/pedidos" className="mt-6 inline-block">
          <Button type="button" variant="secondary">
            Ver meus pedidos
          </Button>
        </Link>
      </div>
    )
  }

  const isPaid = order.status === 'confirmed' || order.payment_status === 'paid'
  const isPending = order.status === 'pending' && !isPaid
  const isPixPending = isPending && order.payment_method === 'pix' && order.pix_qr_code

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <div className="rounded-lg border border-border bg-surface p-6 md:p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">
          {isPaid ? 'Obrigado!' : isPending ? 'Quase lá' : 'Pedido registrado'}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-text-primary md:text-3xl">
          {isPaid
            ? 'Seu pagamento foi confirmado'
            : isPending
              ? 'Aguardando confirmação do pagamento'
              : 'Status do pedido'}
        </h1>
        <p className="mt-3 text-sm text-text-secondary">
          Pedido <span className="font-mono text-text-primary">{order.id.slice(0, 8)}…</span>
          {' · '}
          {STATUS_LABEL[order.status] ?? order.status}
        </p>

        {isPending && !isPixPending && (
          <div className="mt-6">
            <Alert type="info">
              Se você acabou de pagar, a confirmação pode levar alguns instantes. Esta página
              atualiza automaticamente.
            </Alert>
          </div>
        )}

        {isPixPending && (
          <div className="mt-6">
            <CheckoutPixPanel
              total={order.total}
              discountAmount={Number(order.discount_amount ?? 0)}
              qrCode={order.pix_qr_code}
              qrImage={null}
              expiresAt={order.pix_expiration}
              polling={polling}
              onRefresh={refreshPaymentStatus}
            />
          </div>
        )}

        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Total</dt>
            <dd className="font-bold text-brand tabular-nums">{formatCurrency(order.total)}</dd>
          </div>
          {Number(order.discount_amount ?? 0) > 0 && (
            <div className="flex justify-between gap-4 text-success">
              <dt>Desconto Pix</dt>
              <dd className="tabular-nums">− {formatCurrency(Number(order.discount_amount))}</dd>
            </div>
          )}
          {order.shipping_method_name && (
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Frete</dt>
              <dd className="text-text-primary">{order.shipping_method_name}</dd>
            </div>
          )}
          {order.payment_method && (
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Pagamento</dt>
              <dd className="text-text-primary">
                {PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method}
              </dd>
            </div>
          )}
        </dl>

        {order.order_items?.length > 0 && (
          <div className="mt-6 border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-text-primary">Itens</h2>
            <ul className="mt-3 space-y-2 text-sm text-text-secondary">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4">
                  <span>
                    {item.products?.name ?? 'Produto'} × {item.quantity}
                  </span>
                  <span className="tabular-nums">{formatCurrency(Number(item.subtotal))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/conta/pedidos">
            <Button type="button">Ver meus pedidos</Button>
          </Link>
          <Link href="/">
            <Button type="button" variant="secondary">
              Continuar comprando
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
