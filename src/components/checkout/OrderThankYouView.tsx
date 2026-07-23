'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CheckCircle2, CreditCard, Package, ReceiptText } from 'lucide-react'
import { CheckoutPixPanel } from '@/components/checkout/CheckoutPixPanel'
import { OrderClaimAccountForm } from '@/components/checkout/OrderClaimAccountForm'
import { PaymentProofUploadForm } from '@/components/checkout/PaymentProofUploadForm'
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
  user_id?: string | null
  status: string
  payment_status: string
  payment_method: string | null
  customer_email: string | null
  customer_name?: string | null
  total: number
  subtotal: number | null
  shipping_price: number | null
  discount_amount: number | null
  shipping_method_name: string | null
  pix_qr_code: string | null
  pix_expiration: string | null
  created_at: string
  order_items: OrderItem[]
  can_create_account?: boolean
  is_linked_to_session?: boolean
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

function shortOrderId(value: string) {
  return value.length > 8 ? `${value.slice(0, 8)}...` : value
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
    let hasOrder = false
    let paid = false
    let interval: ReturnType<typeof setInterval> | null = null

    function isPaid(data: OrderDetail) {
      return data.status === 'confirmed' || data.payment_status === 'paid'
    }

    function stopPolling() {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    async function load() {
      const { data, error: apiError } = await fetchApi<OrderDetail>(
        `/api/checkout/orders/${orderId}${guestOrderQuery(orderId)}`,
        { headers: guestOrderHeaders(orderId) }
      )
      if (!active) return
      setLoading(false)
      if (apiError || !data) {
        if (!hasOrder) setError(apiError ?? 'Pedido não encontrado')
        return
      }
      hasOrder = true
      setOrder(data)
      if (isPaid(data)) {
        paid = true
        stopPolling()
        if (!data.can_create_account) {
          clearGuestOrderToken(orderId)
        }
      }
    }

    load()
    interval = setInterval(() => {
      if (!paid) load()
    }, 4000)

    return () => {
      active = false
      stopPolling()
    }
  }, [orderId])

  async function refreshPaymentStatus(): Promise<boolean> {
    setPolling(true)
    const { data: statusData } = await fetchApi<{ status: string }>(
      `/api/checkout/orders/${orderId}/payment-status${guestOrderQuery(orderId)}`,
      { headers: guestOrderHeaders(orderId) }
    )
    const { data } = await fetchApi<OrderDetail>(
      `/api/checkout/orders/${orderId}${guestOrderQuery(orderId)}`,
      { headers: guestOrderHeaders(orderId) }
    )
    if (data) setOrder(data)
    setPolling(false)
    return statusData?.status === 'paid' || Boolean(data && (data.status === 'confirmed' || data.payment_status === 'paid'))
  }

  if (loading && !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-text-secondary">Carregando pedido...</p>
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
  const showClaimForm = Boolean(order.can_create_account)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)] md:p-8">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-10 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">
              {isPaid ? 'Compra finalizada' : isPending ? 'Pedido recebido' : 'Pedido registrado'}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-text-primary md:text-3xl">
              {isPaid
                ? 'Obrigado pela sua compra'
                : isPending
                  ? 'Estamos aguardando a confirmacao do pagamento'
                  : 'Acompanhe o status do seu pedido'}
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Numero do pedido{' '}
              <span className="font-mono font-semibold text-text-primary">{shortOrderId(order.id)}</span>
            </p>
            {order.customer_email && (
              <p className="mt-1 text-sm text-text-secondary">
                Este pedido foi vinculado ao e-mail{' '}
                <span className="font-semibold text-text-primary">{order.customer_email}</span>.
              </p>
            )}
          </div>
        </div>

        {isPixPending && (
          <div className="mt-6">
            <CheckoutPixPanel
              orderId={order.id}
              total={order.total}
              discountAmount={Number(order.discount_amount ?? 0)}
              qrCode={order.pix_qr_code}
              qrImage={null}
              expiresAt={order.pix_expiration}
              polling={polling}
              proofSource="thank_you"
              useGuestAccess
              onRefresh={refreshPaymentStatus}
            />
          </div>
        )}

        {isPending && !isPixPending && (
          <div className="mt-6 space-y-3">
            <Alert type="info">
              Se você já pagou e o status não atualizou, envie o comprovante abaixo. Também é
              possível fazer isso depois em Minha conta → Pedidos.
            </Alert>
            <PaymentProofUploadForm
              orderId={order.id}
              source="thank_you"
              useGuestAccess
            />
          </div>
        )}

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</p>
            <p className="mt-2 text-sm font-semibold text-text-primary">
              {STATUS_LABEL[order.status] ?? order.status}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Pagamento</p>
            <p className="mt-2 text-sm font-semibold text-text-primary">
              {order.payment_method
                ? PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method
                : 'Nao informado'}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border p-4">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="inline-flex items-center gap-2 text-text-secondary">
                <ReceiptText className="size-4" aria-hidden />
                Total
              </dt>
              <dd className="font-bold tabular-nums text-brand">{formatCurrency(order.total)}</dd>
            </div>
            {Number(order.discount_amount ?? 0) > 0 && (
              <div className="flex items-center justify-between gap-4 text-success">
                <dt>Desconto Pix</dt>
                <dd className="tabular-nums">- {formatCurrency(Number(order.discount_amount))}</dd>
              </div>
            )}
            {order.shipping_method_name && (
              <div className="flex items-center justify-between gap-4">
                <dt className="inline-flex items-center gap-2 text-text-secondary">
                  <Package className="size-4" aria-hidden />
                  Frete
                </dt>
                <dd className="text-text-primary">{order.shipping_method_name}</dd>
              </div>
            )}
            {order.payment_method && (
              <div className="flex items-center justify-between gap-4">
                <dt className="inline-flex items-center gap-2 text-text-secondary">
                  <CreditCard className="size-4" aria-hidden />
                  Metodo
                </dt>
                <dd className="text-text-primary">
                  {PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {order.order_items?.length > 0 && (
          <div className="mt-6 border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-text-primary">Itens do pedido</h2>
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

        {showClaimForm && (
          <OrderClaimAccountForm orderId={order.id} customerEmail={order.customer_email} />
        )}

        {order.is_linked_to_session && (
          <div className="mt-6">
            <Alert type="success">
              Este pedido já está na sua conta. Você pode acompanhar em Meus pedidos.
            </Alert>
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
