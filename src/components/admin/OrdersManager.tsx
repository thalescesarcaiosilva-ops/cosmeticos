'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { TrackingTimeline } from '@/components/tracking/TrackingTimeline'
import { fetchApi } from '@/lib/api/fetch-api'
import { formatCurrency } from '@/lib/products/format'
import { orderStatusSchema, orderStatusUpdateSchema } from '@/schemas/order-schema'
import type { TrackingEventType } from '@/lib/tracking/types'

type OrderItem = {
  id: string
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
  user_id: string | null
  status: string
  payment_status?: string | null
  payment_method?: string | null
  total: number
  subtotal?: number | null
  shipping_price?: number | null
  shipping_method_name?: string | null
  notes?: string | null
  customer_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  shipping_address?: OrderAddress | null
  tracking_code?: string | null
  carrier?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  tracking_simulation_paused?: boolean | null
  payment_proof_pending?: boolean | null
  created_at: string
  profiles?: { name?: string } | null
  addresses?: OrderAddress | null
  order_items?: OrderItem[]
  tracking_events?: TrackingEvent[]
}

type PaymentProof = {
  id: string
  order_id: string
  message: string | null
  mime_type: string
  file_name: string
  source: string
  status: string
  created_at: string
  signedUrl?: string | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando pagamento',
  confirmed: 'Confirmado',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

const PAYMENT_LABELS: Record<string, string> = {
  pending: 'Pagamento pendente',
  paid: 'Pago',
  refused: 'Recusado',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
}

function formatAddress(address: OrderAddress): string {
  return [
    address.street && address.number ? `${address.street}, ${address.number}` : address.street,
    address.complement,
    address.neighborhood,
    address.city && address.state ? `${address.city}/${address.state}` : address.city || address.state,
    address.zip_code,
  ]
    .filter(Boolean)
    .join(' — ')
}

export function OrdersManager() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [manualCity, setManualCity] = useState('')
  const [manualState, setManualState] = useState('')
  const [proofsByOrder, setProofsByOrder] = useState<Record<string, PaymentProof[]>>({})
  const [proofFilter, setProofFilter] = useState<'all' | 'with_proof'>('all')

  const load = useCallback(async () => {
    const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`
    const { data, error: apiError } = await fetchApi<Order[]>(`/api/admin/orders${query}`)
    if (apiError) setError(apiError)
    else {
      setError(null)
      setOrders(data ?? [])
    }
  }, [statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const visibleOrders = useMemo(() => {
    if (proofFilter === 'with_proof') {
      return orders.filter((o) => o.payment_proof_pending)
    }
    return orders
  }, [orders, proofFilter])

  const totals = useMemo(() => {
    const pending = visibleOrders.filter((o) => o.status === 'pending').length
    const withProof = orders.filter((o) => o.payment_proof_pending).length
    const revenue = visibleOrders
      .filter((o) => ['confirmed', 'shipped', 'delivered'].includes(o.status))
      .reduce((sum, o) => sum + Number(o.total), 0)
    return { pending, revenue, count: visibleOrders.length, withProof }
  }, [visibleOrders, orders])

  async function loadProofs(orderId: string) {
    const { data, error: apiError } = await fetchApi<PaymentProof[]>(
      `/api/admin/orders/payment-proofs?orderId=${orderId}`
    )
    if (apiError) {
      setError(apiError)
      return
    }
    setProofsByOrder((prev) => ({ ...prev, [orderId]: data ?? [] }))
  }

  async function toggleExpanded(orderId: string) {
    const next = expandedId === orderId ? null : orderId
    setExpandedId(next)
    if (next) {
      await loadProofs(next)
    }
  }

  async function reviewProof(proofId: string, action: 'approve' | 'reject') {
    setLoadingId(proofId)
    setMessage(null)
    const { error: apiError, message: okMessage } = await fetchApi(
      '/api/admin/orders/payment-proofs',
      {
        method: 'PATCH',
        body: JSON.stringify({ proofId, action }),
      }
    )
    setLoadingId(null)

    if (apiError) {
      setError(apiError)
      return
    }

    setError(null)
    setMessage(okMessage ?? 'Comprovante atualizado')
    await load()
    if (expandedId) await loadProofs(expandedId)
  }

  async function updateStatus(id: string, status: string) {
    const parsed = orderStatusUpdateSchema.safeParse({ id, status })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Status inválido')
      return
    }

    setLoadingId(id)
    setMessage(null)
    const { error: apiError, message: okMessage } = await fetchApi('/api/admin/orders', {
      method: 'PATCH',
      body: JSON.stringify(parsed.data),
    })
    setLoadingId(null)

    if (apiError) {
      setError(apiError)
      return
    }

    setError(null)
    setMessage(okMessage ?? 'Status atualizado')
    load()
  }

  async function runTrackingAction(
    orderId: string,
    body: Record<string, unknown>,
    successFallback: string
  ) {
    setLoadingId(orderId)
    setMessage(null)
    const { error: apiError, message: okMessage } = await fetchApi(
      '/api/admin/orders/tracking',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    )
    setLoadingId(null)

    if (apiError) {
      setError(apiError)
      return
    }

    setError(null)
    setMessage(okMessage ?? successFallback)
    setManualCity('')
    setManualState('')
    load()
  }

  return (
    <div className="space-y-6">
      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card title="Nesta lista">
          <p className="text-2xl font-bold text-[#3d1654]">{totals.count}</p>
        </Card>
        <Card title="Pendentes">
          <p className="text-2xl font-bold text-badge-discount">{totals.pending}</p>
        </Card>
        <Card title="Com comprovante">
          <p className="text-2xl font-bold text-brand">{totals.withProof}</p>
        </Card>
        <Card title="Total (lista)">
          <p className="text-2xl font-bold text-success">{formatCurrency(totals.revenue)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-text-secondary" htmlFor="order-status-filter">
          Filtrar status:
        </label>
        <select
          id="order-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          <option value="all">Todos</option>
          {orderStatusSchema.options.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={proofFilter}
          onChange={(e) => setProofFilter(e.target.value as 'all' | 'with_proof')}
          className="rounded-md border border-border px-3 py-2 text-sm"
          aria-label="Filtrar comprovantes"
        >
          <option value="all">Todos os pedidos</option>
          <option value="with_proof">Só com comprovante</option>
        </select>
        <Button type="button" variant="secondary" onClick={load}>
          Atualizar
        </Button>
      </div>

      <div className="space-y-3">
        {visibleOrders.map((order) => {
          const expanded = expandedId === order.id
          const customerLabel =
            order.customer_name?.trim() ||
            order.profiles?.name?.trim() ||
            order.customer_email?.trim() ||
            'Cliente'
          const deliveryAddress = order.addresses ?? order.shipping_address ?? null
          const trackingEvents = order.tracking_events ?? []
          const proofs = proofsByOrder[order.id] ?? []
          return (
            <Card key={order.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono font-semibold">#{order.id.slice(0, 8).toUpperCase()}</p>
                    {order.payment_proof_pending && (
                      <span className="rounded-full bg-claret px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-text-on-dark">
                        COMPROVANTE
                      </span>
                    )}
                    {order.payment_status && (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-secondary">
                        {PAYMENT_LABELS[order.payment_status] ?? order.payment_status}
                      </span>
                    )}
                    {!order.user_id && (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-secondary">
                        Convidado
                      </span>
                    )}
                    {order.tracking_simulation_paused && (
                      <span className="rounded-full bg-badge-discount/10 px-2 py-0.5 text-xs text-badge-discount">
                        Simulação pausada
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {customerLabel} · {new Date(order.created_at).toLocaleString('pt-BR')}
                  </p>
                  {order.customer_email && (
                    <p className="mt-0.5 text-xs text-text-muted">{order.customer_email}</p>
                  )}
                  {order.customer_phone && (
                    <p className="mt-0.5 text-xs text-text-muted">{order.customer_phone}</p>
                  )}
                  {order.tracking_code && (
                    <p className="mt-1 font-mono text-xs tracking-wide text-brand">
                      {order.tracking_code}
                    </p>
                  )}
                  <p className="mt-1 text-sm font-semibold text-brand tabular-nums">
                    {formatCurrency(Number(order.total))}
                  </p>
                  {order.shipping_method_name && (
                    <p className="mt-1 text-xs text-text-muted">
                      Frete: {order.shipping_method_name}
                      {order.shipping_price != null &&
                        ` (${formatCurrency(Number(order.shipping_price))})`}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <select
                    value={order.status}
                    disabled={loadingId === order.id}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                    aria-label="Status do pedido"
                  >
                    {orderStatusSchema.options.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => toggleExpanded(order.id)}
                  >
                    {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                  </Button>
                </div>
              </div>

              {expanded && (
                <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
                  {proofs.length > 0 && (
                    <div className="rounded-xl border border-claret/30 bg-cream/60 p-4">
                      <p className="font-semibold text-text-primary">Comprovantes enviados</p>
                      <ul className="mt-3 space-y-4">
                        {proofs.map((proof) => (
                          <li key={proof.id} className="rounded-lg border border-border bg-surface p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-xs text-text-muted">
                                  {new Date(proof.created_at).toLocaleString('pt-BR')} · origem{' '}
                                  {proof.source} · {proof.status}
                                </p>
                                <p className="mt-1 text-sm font-medium text-text-primary">
                                  {proof.file_name}
                                </p>
                                {proof.message && (
                                  <p className="mt-1 text-sm text-text-secondary whitespace-pre-wrap">
                                    {proof.message}
                                  </p>
                                )}
                              </div>
                              {proof.status === 'pending_review' && (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    disabled={loadingId === proof.id}
                                    onClick={() => reviewProof(proof.id, 'approve')}
                                  >
                                    Confirmar pago
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={loadingId === proof.id}
                                    onClick={() => reviewProof(proof.id, 'reject')}
                                  >
                                    Rejeitar
                                  </Button>
                                </div>
                              )}
                            </div>
                            {proof.signedUrl && (
                              <div className="mt-3">
                                {proof.mime_type.startsWith('image/') ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={proof.signedUrl}
                                    alt={`Comprovante ${proof.file_name}`}
                                    className="max-h-80 rounded-md border border-border object-contain"
                                  />
                                ) : (
                                  <a
                                    href={proof.signedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-brand hover:underline"
                                  >
                                    Abrir PDF do comprovante →
                                  </a>
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {deliveryAddress && (
                    <div>
                      <p className="font-semibold text-text-primary">Endereço de entrega</p>
                      <p className="mt-1 text-text-secondary">{formatAddress(deliveryAddress)}</p>
                    </div>
                  )}

                  {order.order_items && order.order_items.length > 0 && (
                    <div>
                      <p className="font-semibold text-text-primary">Itens</p>
                      <ul className="mt-2 space-y-1">
                        {order.order_items.map((item) => (
                          <li key={item.id} className="flex justify-between gap-4 text-text-secondary">
                            <span>
                              {item.products?.name ?? 'Produto'} × {item.quantity}
                            </span>
                            <span className="tabular-nums">
                              {formatCurrency(Number(item.subtotal))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="rounded-xl border border-border bg-surface-muted/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-text-primary">Rastreio</p>
                      {order.tracking_code && (
                        <Link
                          href={`/paginas/rastreio?codigo=${encodeURIComponent(order.tracking_code)}`}
                          className="text-xs font-semibold text-brand hover:underline"
                          target="_blank"
                        >
                          Abrir página pública
                        </Link>
                      )}
                    </div>

                    <div className="mt-3">
                      <TrackingTimeline
                        showUpcoming
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

                    <div className="mt-4 flex flex-wrap gap-2">
                      {!order.tracking_code && order.status === 'confirmed' && (
                        <Button
                          type="button"
                          disabled={loadingId === order.id}
                          onClick={() =>
                            runTrackingAction(
                              order.id,
                              { orderId: order.id, action: 'dispatch' },
                              'Pedido despachado'
                            )
                          }
                        >
                          Despachar agora
                        </Button>
                      )}
                      {order.tracking_code && order.status === 'shipped' && (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={loadingId === order.id}
                            onClick={() =>
                              runTrackingAction(
                                order.id,
                                { orderId: order.id, action: 'advance' },
                                'Rastreio avançado'
                              )
                            }
                          >
                            Avançar próximo passo
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={loadingId === order.id}
                            onClick={() =>
                              runTrackingAction(
                                order.id,
                                {
                                  orderId: order.id,
                                  action: order.tracking_simulation_paused
                                    ? 'resume'
                                    : 'pause',
                                },
                                order.tracking_simulation_paused
                                  ? 'Simulação retomada'
                                  : 'Simulação pausada'
                              )
                            }
                          >
                            {order.tracking_simulation_paused
                              ? 'Retomar automático'
                              : 'Pausar automático'}
                          </Button>
                        </>
                      )}
                    </div>

                    {order.tracking_code && order.status === 'shipped' && (
                      <form
                        className="mt-4 grid gap-2 sm:grid-cols-[1fr_88px_auto]"
                        onSubmit={(event) => {
                          event.preventDefault()
                          void runTrackingAction(
                            order.id,
                            {
                              orderId: order.id,
                              action: 'set_location',
                              city: manualCity,
                              state: manualState,
                            },
                            'Localização registrada'
                          )
                        }}
                      >
                        <Input
                          value={manualCity}
                          onChange={(e) => setManualCity(e.target.value)}
                          placeholder="Cidade"
                          aria-label="Cidade do rastreio"
                          required
                        />
                        <Input
                          value={manualState}
                          onChange={(e) => setManualState(e.target.value.toUpperCase())}
                          placeholder="UF"
                          maxLength={2}
                          aria-label="UF"
                          required
                        />
                        <Button type="submit" disabled={loadingId === order.id}>
                          Registrar local
                        </Button>
                      </form>
                    )}
                  </div>

                  <dl className="grid gap-2 sm:grid-cols-2">
                    {order.subtotal != null && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-text-muted">Subtotal</dt>
                        <dd className="tabular-nums">{formatCurrency(Number(order.subtotal))}</dd>
                      </div>
                    )}
                    {order.payment_method && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-text-muted">Pagamento</dt>
                        <dd>{order.payment_method}</dd>
                      </div>
                    )}
                  </dl>

                  {order.notes && (
                    <div>
                      <p className="font-semibold text-text-primary">Observações</p>
                      <p className="mt-1 text-text-secondary">{order.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
        {visibleOrders.length === 0 && (
          <Card>
            <p className="text-text-secondary">Nenhum pedido encontrado.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
