'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, MapPin, Package, ReceiptText, Truck } from 'lucide-react'
import { PaymentProofUploadForm } from '@/components/checkout/PaymentProofUploadForm'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TrackingTimeline } from '@/components/tracking/TrackingTimeline'
import { fetchApi } from '@/lib/api/fetch-api'
import { formatCurrency } from '@/lib/products/format'
import type { TrackingEventType } from '@/lib/tracking/types'

type OrderItem = {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
  products: { name: string; slug: string } | null
}

type OrderAddress = {
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  zip_code: string
}

type TrackingEvent = {
  id: string
  sequence: number
  event_type: TrackingEventType
  city: string
  state: string
  message: string
  scheduled_at: string
  occurred_at: string | null
  is_manual: boolean
}

type Order = {
  id: string
  status: string
  payment_status?: string | null
  payment_method?: string | null
  total: number
  subtotal?: number | null
  shipping_price?: number | null
  discount_amount?: number | null
  shipping_method_name?: string | null
  shipping_address?: OrderAddress | null
  notes?: string | null
  tracking_code?: string | null
  carrier?: string | null
  payment_proof_pending?: boolean | null
  created_at: string
  addresses?: OrderAddress | null
  order_items: OrderItem[]
  tracking_events?: TrackingEvent[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando pagamento',
  confirmed: 'Confirmado',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  credit_card: 'Cartão de crédito',
}

const ORDER_STEPS = [
  { key: 'pending', label: 'Recebido' },
  { key: 'confirmed', label: 'Confirmado' },
  { key: 'shipped', label: 'Enviado' },
  { key: 'delivered', label: 'Entregue' },
] as const

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shortOrderId(id: string) {
  return id.slice(0, 8).toUpperCase()
}

function stepIndexForStatus(status: string): number {
  if (status === 'cancelled') return -1
  const index = ORDER_STEPS.findIndex((step) => step.key === status)
  return index >= 0 ? index : 0
}

function formatAddress(address: OrderAddress): string {
  return [
    `${address.street}, ${address.number}`,
    address.complement,
    address.neighborhood,
    `${address.city}/${address.state}`,
    address.zip_code,
  ]
    .filter(Boolean)
    .join(' — ')
}

function OrderStatusStepper({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <div className="rounded-xl border border-badge-discount/20 bg-badge-discount/5 px-4 py-3">
        <p className="text-sm font-semibold text-badge-discount">Pedido cancelado</p>
        <p className="mt-1 text-xs text-text-secondary">
          Este pedido foi cancelado e não seguirá para entrega.
        </p>
      </div>
    )
  }

  const activeIndex = stepIndexForStatus(status)

  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Etapas do pedido">
      {ORDER_STEPS.map((step, index) => {
        const done = index <= activeIndex
        const current = index === activeIndex
        return (
          <li key={step.key} className="relative flex flex-col items-center text-center">
            {index < ORDER_STEPS.length - 1 && (
              <span
                aria-hidden
                className={`absolute top-3 left-[calc(50%+12px)] h-0.5 w-[calc(100%-24px)] ${
                  index < activeIndex ? 'bg-brand' : 'bg-border'
                }`}
              />
            )}
            <span
              className={`relative z-[1] flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${
                done
                  ? 'bg-brand text-white'
                  : 'border border-border bg-surface text-text-muted'
              } ${current ? 'ring-4 ring-brand/15' : ''}`}
            >
              {index + 1}
            </span>
            <span
              className={`mt-2 text-[11px] font-medium leading-tight sm:text-xs ${
                done ? 'text-text-primary' : 'text-text-muted'
              }`}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const deliveryAddress = order.addresses ?? order.shipping_address ?? null
  const statusLabel = STATUS_LABELS[order.status] ?? order.status
  const paymentLabel = order.payment_method
    ? (PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method)
    : 'Não informado'
  const trackingEvents = order.tracking_events ?? []
  const canReportPaymentIssue =
    order.status === 'pending' ||
    (order.status === 'cancelled' && order.payment_status !== 'paid')

  return (
    <Card className="overflow-hidden !p-0">
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Pedido #{shortOrderId(order.id)}
            </p>
            <p className="mt-1 text-base font-semibold text-text-primary">
              {formatDate(order.created_at)}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              {order.order_items?.length ?? 0}{' '}
              {(order.order_items?.length ?? 0) === 1 ? 'item' : 'itens'}
              {order.shipping_method_name ? ` · ${order.shipping_method_name}` : ''}
            </p>
            {order.tracking_code && (
              <p className="mt-2 font-mono text-xs tracking-wide text-brand">
                Rastreio: {order.tracking_code}
              </p>
            )}
          </div>

          <div className="text-right">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                order.status === 'cancelled'
                  ? 'bg-badge-discount/10 text-badge-discount'
                  : order.status === 'delivered'
                    ? 'bg-success/10 text-success'
                    : 'bg-brand/10 text-brand'
              }`}
            >
              {statusLabel}
            </span>
            <p className="mt-2 text-xl font-bold tabular-nums text-text-primary">
              {formatCurrency(Number(order.total))}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <OrderStatusStepper status={order.status} />
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {order.tracking_code && (
            <Link
              href={`/paginas/rastreio?codigo=${encodeURIComponent(order.tracking_code)}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-6 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-muted"
            >
              <Truck className="size-4" aria-hidden />
              Rastrear
            </Link>
          )}
          {canReportPaymentIssue && (
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              onClick={() => {
                setOpen(true)
                setShowReport(true)
              }}
            >
              Relatar problema / comprovante
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Ocultar detalhes' : 'Detalhes do pedido'}
            <ChevronDown
              className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-5 border-t border-border bg-surface-muted/30 px-5 py-5 md:px-6">
          {canReportPaymentIssue && showReport && (
            <section className="space-y-3">
              <Alert type="info">
                Use este formulário se você pagou o Pix e o pedido ainda aparece como pendente.
                Envie o comprovante e descreva o que aconteceu.
              </Alert>
              {order.payment_proof_pending && (
                <Alert type="success">
                  Já recebemos um comprovante deste pedido. Nossa equipe está analisando.
                </Alert>
              )}
              <PaymentProofUploadForm
                orderId={order.id}
                source="account"
                useGuestAccess={false}
                onSubmitted={() => setShowReport(false)}
              />
            </section>
          )}

          {canReportPaymentIssue && !showReport && (
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className="text-sm font-medium text-brand underline-offset-2 hover:underline"
            >
              Paguei e o status não atualizou? Enviar comprovante
            </button>
          )}

          {(order.tracking_code || trackingEvents.length > 0) && (
            <section>
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Truck className="size-4 text-brand" aria-hidden />
                Caminho do pedido
              </h3>
              <div className="mt-3 rounded-xl border border-border bg-surface p-4">
                <TrackingTimeline
                  trackingCode={order.tracking_code}
                  events={trackingEvents.map((event) => ({
                    id: event.id,
                    sequence: event.sequence,
                    eventType: event.event_type,
                    city: event.city,
                    state: event.state,
                    message: event.message,
                    scheduledAt: event.scheduled_at,
                    occurredAt: event.occurred_at,
                    isManual: event.is_manual,
                  }))}
                />
              </div>
            </section>
          )}

          <section>
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Package className="size-4 text-brand" aria-hidden />
              Resumo do pedido
            </h3>
            {order.order_items?.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {order.order_items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-4 text-sm text-text-secondary"
                  >
                    <span>
                      <span className="font-medium text-text-primary">
                        {item.products?.name ?? 'Produto'}
                      </span>
                      <span className="text-text-muted"> × {item.quantity}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatCurrency(Number(item.subtotal))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-text-secondary">Itens indisponíveis.</p>
            )}

            <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
              {order.subtotal != null && (
                <div className="flex justify-between gap-4 text-text-secondary">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">{formatCurrency(Number(order.subtotal))}</dd>
                </div>
              )}
              {order.shipping_price != null && (
                <div className="flex justify-between gap-4 text-text-secondary">
                  <dt>Frete{order.shipping_method_name ? ` (${order.shipping_method_name})` : ''}</dt>
                  <dd className="tabular-nums">
                    {Number(order.shipping_price) === 0
                      ? 'Grátis'
                      : formatCurrency(Number(order.shipping_price))}
                  </dd>
                </div>
              )}
              {Number(order.discount_amount ?? 0) > 0 && (
                <div className="flex justify-between gap-4 text-success">
                  <dt>Desconto</dt>
                  <dd className="tabular-nums">
                    - {formatCurrency(Number(order.discount_amount))}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 font-semibold text-text-primary">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCurrency(Number(order.total))}</dd>
              </div>
            </dl>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                <ReceiptText className="size-4 text-brand" aria-hidden />
                Pagamento
              </h3>
              <p className="mt-2 text-sm text-text-secondary">{paymentLabel}</p>
              {order.payment_status && (
                <p className="mt-1 text-xs text-text-muted">
                  Status: {order.payment_status === 'paid' ? 'Pago' : order.payment_status}
                </p>
              )}
              <p className="mt-2 text-xs text-text-muted">
                Realizado em {formatDateTime(order.created_at)}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                <MapPin className="size-4 text-brand" aria-hidden />
                Endereço de entrega
              </h3>
              {deliveryAddress ? (
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {formatAddress(deliveryAddress)}
                </p>
              ) : (
                <p className="mt-2 text-sm text-text-secondary">Endereço não informado.</p>
              )}
            </div>
          </section>

          {order.notes?.trim() && (
            <section>
              <h3 className="text-sm font-semibold text-text-primary">Observações</h3>
              <p className="mt-1 text-sm text-text-secondary">{order.notes}</p>
            </section>
          )}
        </div>
      )}
    </Card>
  )
}

export function OrdersList() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchApi<Order[]>('/api/account/orders').then(({ data, error: apiError }) => {
      setLoading(false)
      if (apiError) {
        setError(apiError)
        return
      }
      setOrders(data ?? [])
    })
  }, [])

  if (loading) {
    return <p className="text-text-secondary">Carregando pedidos…</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Meus pedidos</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Acompanhe status, rastreio e detalhes de cada compra.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {orders.length === 0 ? (
        <Card>
          <p className="text-text-secondary">Você ainda não fez nenhum pedido.</p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
