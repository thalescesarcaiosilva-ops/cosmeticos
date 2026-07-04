'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { fetchApi } from '@/lib/api/fetch-api'
import { formatCurrency } from '@/lib/products/format'
import { orderStatusSchema, orderStatusUpdateSchema } from '@/schemas/order-schema'

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

type Order = {
  id: string
  user_id: string
  status: string
  payment_status?: string | null
  payment_method?: string | null
  total: number
  subtotal?: number | null
  shipping_price?: number | null
  shipping_method_name?: string | null
  notes?: string | null
  created_at: string
  profiles?: { name?: string } | null
  addresses?: OrderAddress | null
  order_items?: OrderItem[]
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
    `${address.street}, ${address.number}`,
    address.complement,
    address.neighborhood,
    `${address.city}/${address.state}`,
    address.zip_code,
  ]
    .filter(Boolean)
    .join(' — ')
}

export function OrdersManager() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  const totals = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'pending').length
    const revenue = orders
      .filter((o) => ['confirmed', 'shipped', 'delivered'].includes(o.status))
      .reduce((sum, o) => sum + Number(o.total), 0)
    return { pending, revenue, count: orders.length }
  }, [orders])

  async function updateStatus(id: string, status: string) {
    const parsed = orderStatusUpdateSchema.safeParse({ id, status })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Status inválido')
      return
    }

    setLoadingId(id)
    const { error: apiError } = await fetchApi('/api/admin/orders', {
      method: 'PATCH',
      body: JSON.stringify(parsed.data),
    })
    setLoadingId(null)

    if (apiError) {
      setError(apiError)
      return
    }

    load()
  }

  return (
    <div className="space-y-6">
      {error && <Alert type="error">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Nesta lista">
          <p className="text-2xl font-bold text-[#3d1654]">{totals.count}</p>
        </Card>
        <Card title="Pendentes">
          <p className="text-2xl font-bold text-badge-discount">{totals.pending}</p>
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
        <Button type="button" variant="secondary" onClick={load}>
          Atualizar
        </Button>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const expanded = expandedId === order.id
          return (
            <Card key={order.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono font-semibold">#{order.id.slice(0, 8).toUpperCase()}</p>
                    {order.payment_status && (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-secondary">
                        {PAYMENT_LABELS[order.payment_status] ?? order.payment_status}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {order.profiles?.name ?? 'Cliente'} ·{' '}
                    {new Date(order.created_at).toLocaleString('pt-BR')}
                  </p>
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
                    onClick={() => setExpandedId(expanded ? null : order.id)}
                  >
                    {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                  </Button>
                </div>
              </div>

              {expanded && (
                <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
                  {order.addresses && (
                    <div>
                      <p className="font-semibold text-text-primary">Endereço de entrega</p>
                      <p className="mt-1 text-text-secondary">{formatAddress(order.addresses)}</p>
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
        {orders.length === 0 && (
          <Card>
            <p className="text-text-secondary">Nenhum pedido encontrado.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
