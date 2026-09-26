'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { fetchApi } from '@/lib/api/fetch-api'
import type { SupportQueueItem } from '@/lib/support/types'
import type { SupportQueuePeriod } from '@/lib/support/eligibility'

type SupportQueueProps = {
  storeName: string
  role: 'admin' | 'support'
  adminWarning: boolean
}

type QueuePayload = {
  storeName: string
  orders: SupportQueueItem[]
}

const PERIODS: Array<{ id: SupportQueuePeriod; label: string }> = [
  { id: '24h', label: 'Últimas 24 horas' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'all', label: 'Todos' },
]

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAge(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? 'há 1 hora' : `há ${hours} horas`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'há 1 dia' : `há ${days} dias`
}

export function SupportQueue({ storeName, role, adminWarning }: SupportQueueProps) {
  const router = useRouter()
  const [period, setPeriod] = useState<SupportQueuePeriod>('24h')
  const [search, setSearch] = useState('')
  const [orders, setOrders] = useState<SupportQueueItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ period })
    if (search.trim()) params.set('q', search.trim())
    const { data, error: apiError } = await fetchApi<QueuePayload>(`/api/suporte/pedidos?${params}`)
    if (apiError || !data) {
      setError(apiError ?? 'Não foi possível carregar a fila')
      setLoading(false)
      return
    }
    setError(null)
    setOrders(data.orders)
    setNow(Date.now())
    setLoading(false)
  }, [period, search])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load()
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [load])

  async function copy(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(id)
      window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 2000)
    } catch {
      setError('Não foi possível copiar')
    }
  }

  async function logout() {
    await fetchApi('/api/auth/logout', { method: 'POST' })
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-white px-4 py-4 md:px-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            {storeName}
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-950">Fila de suporte</h1>
          <p className="text-sm text-neutral-500">
            {role === 'admin' ? 'Acesso do administrador' : 'Somente leitura'}
          </p>
        </div>
        <Button type="button" variant="secondary" className="!rounded-md" onClick={logout}>
          Sair
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
        {adminWarning && (
          <Alert type="warning">
            O painel do administrador não está disponível para este acesso. Esta é a fila de suporte.
          </Alert>
        )}

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <label className="block min-w-0 flex-1 text-sm font-medium text-neutral-700">
              Buscar
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome, telefone, e-mail ou pedido"
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2.5 text-sm font-normal text-neutral-900 outline-none focus:border-neutral-400"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPeriod(item.id)}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    period === item.id
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 bg-white text-neutral-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <Button type="button" variant="secondary" className="!rounded-md" onClick={() => void load()}>
                Atualizar
              </Button>
            </div>
          </div>
        </section>

        {error && <Alert type="error">{error}</Alert>}
        {loading && orders.length === 0 && <p className="text-sm text-neutral-500">Carregando a fila…</p>}
        {!loading && orders.length === 0 && (
          <p className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
            Nenhum pedido nesta fila.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <article
              key={order.id}
              className="rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-mono text-base font-semibold text-neutral-950">Pedido {order.number}</p>
                  <p className="text-sm text-neutral-600">
                    {formatDateTime(order.createdAt)} · {formatAge(order.createdAt, now)}
                  </p>
                  <p className="mt-2 text-sm font-medium text-neutral-900">{order.statusLabel}</p>
                  <p className="text-sm text-neutral-600">Pagamento: {order.paymentMethod}</p>
                  {order.proofPending && (
                    <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      O cliente enviou comprovante e o pagamento ainda não foi confirmado.
                    </p>
                  )}
                </div>
                <div className="text-sm text-neutral-800">
                  <p className="font-medium">{order.customerName}</p>
                  <p>{order.customerEmail}</p>
                  <p>{order.phoneLabel}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {order.telUrl ? (
                  <a
                    href={order.telUrl}
                    className="inline-flex items-center rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Ligar
                  </a>
                ) : (
                  <span className="inline-flex items-center rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-500">
                    Sem telefone
                  </span>
                )}
                {order.whatsappUrl && (
                  <a
                    href={order.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-900"
                  >
                    WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  disabled={!order.phone}
                  onClick={() => order.phone && void copy(`${order.id}-phone`, order.phone)}
                  className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-800 disabled:opacity-50"
                >
                  {copied === `${order.id}-phone` ? 'Telefone copiado' : 'Copiar telefone'}
                </button>
                <button
                  type="button"
                  onClick={() => void copy(`${order.id}-data`, order.copyText)}
                  className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-800"
                >
                  {copied === `${order.id}-data` ? 'Dados copiados' : 'Copiar dados do pedido'}
                </button>
              </div>

              <div className="mt-4 grid gap-4 border-t border-neutral-100 pt-4 md:grid-cols-[1.2fr_1fr]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                    Entrega
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-neutral-800">{order.address}</p>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                    Produtos
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-neutral-800">
                    {order.items.length === 0 && <li>Nenhum produto listado</li>}
                    {order.items.map((item, index) => (
                      <li key={`${order.id}-${index}`}>
                        {item.quantity}× {item.name} — {item.lineTotalLabel}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:text-right">
                  <p className="text-lg font-semibold text-neutral-950">{order.totalLabel}</p>
                  <p className="text-xs text-neutral-500">Produtos {order.subtotalLabel}</p>
                  {order.discountLabel && (
                    <p className="text-xs text-neutral-500">Desconto {order.discountLabel}</p>
                  )}
                  <p className="text-xs text-neutral-500">Frete {order.shippingLabel}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
