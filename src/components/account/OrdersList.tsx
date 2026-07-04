'use client'

import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { fetchApi } from '@/lib/api/fetch-api'

type OrderItem = {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
}

type Order = {
  id: string
  status: string
  total: number
  created_at: string
  order_items: OrderItem[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
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
      <h1 className="text-2xl font-bold">Meus pedidos</h1>
      {error && <Alert type="error">{error}</Alert>}
      {orders.length === 0 ? (
        <Card>
          <p className="text-text-secondary">Você ainda não fez nenhum pedido.</p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">Pedido #{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-text-secondary">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                    <p className="mt-1 font-bold">{formatCurrency(order.total)}</p>
                  </div>
                </div>
                {order.order_items?.length > 0 && (
                  <ul className="mt-4 space-y-1 border-t border-border pt-4 text-sm text-text-secondary">
                    {order.order_items.map((item) => (
                      <li key={item.id}>
                        {item.quantity}x — {formatCurrency(item.subtotal)}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
