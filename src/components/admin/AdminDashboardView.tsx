'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Box,
  CreditCard,
  DollarSign,
  LineChart,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/products/format'
import type { DashboardPayload } from '@/lib/admin/dashboard-analytics'
import {
  aggregateProductSales,
  buildDailyRevenue,
  filterOrders,
  isSoldOrder,
  methodStats,
  resolveRange,
  statusBreakdown,
  type PeriodPreset,
  type ProductSalesRow,
} from '@/lib/admin/dashboard-metrics'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando',
  confirmed: 'Confirmado',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

const PAYMENT_LABEL: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  refused: 'Recusado',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
}

const METHOD_LABEL: Record<string, string> = {
  pix: 'Pix',
  credit_card: 'Cartão',
}

const ACCENT = '#76172c'
const PIX = '#2e7d32'
const STATUS_BAR = '#c4a574'
const PRODUCTS_PAGE_SIZE = 10

function toInputDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

type Props = {
  data: DashboardPayload
}

export function AdminDashboardView({ data }: Props) {
  const today = useMemo(() => new Date(), [])
  const defaultFrom = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - 29)
    return toInputDate(d)
  }, [today])

  const [preset, setPreset] = useState<PeriodPreset>('30d')
  const [customFrom, setCustomFrom] = useState(defaultFrom)
  const [customTo, setCustomTo] = useState(toInputDate(today))
  const [productQuery, setProductQuery] = useState('')
  const [productPage, setProductPage] = useState(1)

  const range = useMemo(
    () => resolveRange(preset, customFrom, customTo, today),
    [preset, customFrom, customTo, today]
  )

  const periodOrders = useMemo(
    () => filterOrders(data.orders, range),
    [data.orders, range]
  )

  const soldOrders = useMemo(
    () =>
      periodOrders.filter((o) => isSoldOrder(o, data.paymentColumnsAvailable)),
    [periodOrders, data.paymentColumnsAvailable]
  )

  const soldIds = useMemo(() => new Set(soldOrders.map((o) => o.id)), [soldOrders])

  const confirmedRevenue = useMemo(
    () => soldOrders.reduce((sum, o) => sum + o.total, 0),
    [soldOrders]
  )

  const pendingOrders = useMemo(
    () => periodOrders.filter((o) => o.status === 'pending').length,
    [periodOrders]
  )

  const averageTicket =
    soldOrders.length > 0 ? confirmedRevenue / soldOrders.length : 0

  const pix = useMemo(
    () => methodStats(periodOrders, 'pix', data.paymentColumnsAvailable),
    [periodOrders, data.paymentColumnsAvailable]
  )

  const card = useMemo(
    () => methodStats(periodOrders, 'credit_card', data.paymentColumnsAvailable),
    [periodOrders, data.paymentColumnsAvailable]
  )

  const daily = useMemo(
    () => buildDailyRevenue(soldOrders, range, today),
    [soldOrders, range, today]
  )

  const statuses = useMemo(() => statusBreakdown(periodOrders), [periodOrders])

  const productSales = useMemo(
    () => aggregateProductSales(data.orderItems, soldIds),
    [data.orderItems, soldIds]
  )

  const filteredProducts = useMemo(() => {
    const q = normalize(productQuery)
    if (!q) return productSales
    const exact = productSales.filter((row) => normalize(row.name) === q)
    if (exact.length) return exact
    return productSales.filter(
      (row) =>
        normalize(row.name).includes(q) || normalize(row.slug).includes(q)
    )
  }, [productSales, productQuery])

  const showingSearch = normalize(productQuery).length > 0
  const productTotalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PAGE_SIZE)
  )
  const safeProductPage = Math.min(productPage, productTotalPages)
  const productRows = filteredProducts.slice(
    (safeProductPage - 1) * PRODUCTS_PAGE_SIZE,
    safeProductPage * PRODUCTS_PAGE_SIZE
  )
  const productRankStart = (safeProductPage - 1) * PRODUCTS_PAGE_SIZE

  useEffect(() => {
    setProductPage(1)
  }, [preset, customFrom, customTo, productQuery])

  const recentOrders = periodOrders.slice(0, 8)

  const periodLabel =
    preset === '7d'
      ? 'Últimos 7 dias'
      : preset === '30d'
        ? 'Últimos 30 dias'
        : preset === 'custom'
          ? 'Período personalizado'
          : 'Todo o período'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-text-secondary">
            Análise da loja com filtros de período — sem alterar o banco.
          </p>
          {!data.paymentColumnsAvailable && (
            <p className="mt-1 text-xs text-badge-discount">
              Colunas de pagamento indisponíveis: receita usa status confirmado/enviado/entregue.
            </p>
          )}
        </div>

        <PeriodControls
          preset={preset}
          onPreset={setPreset}
          customFrom={customFrom}
          customTo={customTo}
          onFrom={setCustomFrom}
          onTo={setCustomTo}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Receita confirmada"
          value={formatCurrency(confirmedRevenue)}
          hint={`${soldOrders.length} pedidos pagos`}
          icon={<DollarSign className="h-5 w-5" />}
          href="/admin/pedidos"
        />
        <KpiCard
          title="Pedidos no período"
          value={String(periodOrders.length)}
          hint={`${pendingOrders} aguardando`}
          icon={<ShoppingCart className="h-5 w-5" />}
          href="/admin/pedidos"
          highlight={pendingOrders > 0}
        />
        <KpiCard
          title="Ticket médio"
          value={formatCurrency(averageTicket)}
          hint="Pedidos confirmados"
          icon={<LineChart className="h-5 w-5" />}
        />
        <KpiCard
          title="Clientes"
          value={String(data.customersCount)}
          hint="Cadastros totais"
          icon={<Users className="h-5 w-5" />}
        />
        <KpiCard
          title="Produtos"
          value={String(data.productsCount)}
          hint="Catálogo"
          icon={<Box className="h-5 w-5" />}
          href="/admin/produtos"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MethodCard
          title="Pix"
          icon={<Wallet className="h-5 w-5 text-success" />}
          tone="pix"
          stats={pix}
        />
        <MethodCard
          title="Cartão de crédito"
          icon={<CreditCard className="h-5 w-5" style={{ color: ACCENT }} />}
          tone="card"
          stats={card}
        />
        <Card title="Pedidos pagos por método">
          <PaymentDonut
            pixCount={pix.paidCount}
            pixRevenue={pix.paidRevenue}
            cardCount={card.paidCount}
            cardRevenue={card.paidRevenue}
          />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card
          title={`Receita confirmada por dia · ${periodLabel}`}
        >
          <RevenueLineChart points={daily} />
        </Card>
        <Card title="Pedidos por status">
          <StatusBars rows={statuses} />
        </Card>
      </div>

      <Card title="Produtos mais comprados">
        <div className="mb-4 max-w-md space-y-1">
          <Input
            label="Buscar produto exato"
            placeholder="Digite o nome do produto…"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-text-muted">
            Ordenado por número de pedidos · {periodLabel} ·{' '}
            {filteredProducts.length} produto
            {filteredProducts.length === 1 ? '' : 's'}
            {showingSearch ? ' na busca' : ' com vendas'}
          </p>
        </div>
        <ProductSalesTable
          rows={productRows}
          emptySearch={showingSearch}
          rankStart={productRankStart}
        />
        {filteredProducts.length > PRODUCTS_PAGE_SIZE && (
          <ProductPagination
            page={safeProductPage}
            totalPages={productTotalPages}
            totalItems={filteredProducts.length}
            pageSize={PRODUCTS_PAGE_SIZE}
            onPage={setProductPage}
          />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Pedidos recentes no período">
          {!recentOrders.length ? (
            <p className="text-sm text-text-secondary">Nenhum pedido neste período.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentOrders.map((order) => {
                const customer =
                  order.customer_name?.trim() || order.profile_name || 'Cliente'
                return (
                  <li
                    key={order.id}
                    className="flex items-start justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="font-mono text-sm font-medium">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {customer} ·{' '}
                        {new Date(order.created_at).toLocaleString('pt-BR')}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {STATUS_LABEL[order.status] ?? order.status}
                        {order.payment_status
                          ? ` · ${PAYMENT_LABEL[order.payment_status] ?? order.payment_status}`
                          : ''}
                        {order.payment_method
                          ? ` · ${METHOD_LABEL[order.payment_method] ?? order.payment_method}`
                          : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(order.total)}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
          <Link
            href="/admin/pedidos"
            className="mt-4 inline-block text-sm text-brand hover:underline"
          >
            Ver todos →
          </Link>
        </Card>

        <Card title="Estoque baixo">
          {!data.lowStock.length ? (
            <p className="text-sm text-text-secondary">
              Nenhum produto com estoque crítico.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.lowStock.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <Link
                    href="/admin/produtos"
                    className="text-sm font-medium hover:text-brand"
                  >
                    {product.name}
                  </Link>
                  <span className="text-sm font-semibold text-badge-discount">
                    {product.stock} un.
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-text-muted">
            {data.categoriesCount} categorias no catálogo
          </p>
        </Card>
      </div>
    </div>
  )
}

function PeriodControls({
  preset,
  onPreset,
  customFrom,
  customTo,
  onFrom,
  onTo,
}: {
  preset: PeriodPreset
  onPreset: (p: PeriodPreset) => void
  customFrom: string
  customTo: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
}) {
  const options: { id: PeriodPreset; label: string }[] = [
    { id: '7d', label: '7 dias' },
    { id: '30d', label: '30 dias' },
    { id: 'custom', label: 'Personalizado' },
    { id: 'all', label: 'Tudo' },
  ]

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = preset === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPreset(opt.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-claret text-white'
                  : 'border border-border bg-surface text-text-secondary hover:bg-surface-strong'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onFrom(e.target.value)}
            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary"
          />
          <span className="text-xs text-text-muted">até</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onTo(e.target.value)}
            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary"
          />
        </div>
      )}
    </div>
  )
}

function KpiCard({
  title,
  value,
  hint,
  icon,
  href,
  highlight,
}: {
  title: string
  value: string
  hint: string
  icon: ReactNode
  href?: string
  highlight?: boolean
}) {
  const body = (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-text-secondary">{title}</p>
        <span
          className="rounded-md p-1.5"
          style={{ color: ACCENT, background: 'rgba(118, 23, 44, 0.08)' }}
        >
          {icon}
        </span>
      </div>
      <p
        className={`text-2xl font-bold tabular-nums tracking-tight ${
          highlight ? 'text-badge-discount' : 'text-text-primary'
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs text-text-muted">{hint}</p>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    )
  }
  return body
}

function MethodCard({
  title,
  icon,
  tone,
  stats,
}: {
  title: string
  icon: ReactNode
  tone: 'pix' | 'card'
  stats: ReturnType<typeof methodStats>
}) {
  const accent = tone === 'pix' ? PIX : ACCENT
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {icon}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Stat label="Pedidos pagos" value={String(stats.paidCount)} color={accent} />
        <Stat label="Receita paga" value={formatCurrency(stats.paidRevenue)} color={accent} />
        <Stat label="Tentativas" value={String(stats.attempts)} />
        <Stat label="Conversão" value={`${Math.round(stats.conversion)}%`} />
      </div>
      <p className="mt-4 border-t border-border pt-3 text-xs text-text-muted">
        Volume pendente incluso: {formatCurrency(stats.pendingVolume + stats.paidRevenue)}
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p
        className="mt-0.5 text-base font-semibold tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
    </div>
  )
}

function PaymentDonut({
  pixCount,
  pixRevenue,
  cardCount,
  cardRevenue,
}: {
  pixCount: number
  pixRevenue: number
  cardCount: number
  cardRevenue: number
}) {
  const total = pixCount + cardCount
  const [hover, setHover] = useState<'pix' | 'card' | null>(null)

  if (!total) {
    return (
      <p className="text-sm text-text-secondary">
        Sem pedidos pagos com Pix ou cartão neste período.
      </p>
    )
  }

  const size = 180
  const stroke = 28
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pixLen = (pixCount / total) * c
  const cardLen = (cardCount / total) * c

  const tip =
    hover === 'pix'
      ? `Pix: ${pixCount} pedidos · ${formatCurrency(pixRevenue)}`
      : hover === 'card'
        ? `Cartão: ${cardCount} pedidos · ${formatCurrency(cardRevenue)}`
        : null

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#f1dfdd"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={PIX}
            strokeWidth={stroke}
            strokeDasharray={`${pixLen} ${c - pixLen}`}
            strokeDashoffset={0}
            className="cursor-pointer transition-opacity"
            opacity={hover === 'card' ? 0.35 : 1}
            onMouseEnter={() => setHover('pix')}
            onMouseLeave={() => setHover(null)}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ACCENT}
            strokeWidth={stroke}
            strokeDasharray={`${cardLen} ${c - cardLen}`}
            strokeDashoffset={-pixLen}
            className="cursor-pointer transition-opacity"
            opacity={hover === 'pix' ? 0.35 : 1}
            onMouseEnter={() => setHover('card')}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-2xl font-bold tabular-nums text-text-primary">{total}</p>
          <p className="text-xs text-text-muted">pagos</p>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <LegendRow color={PIX} label="Pix" value={`${pixCount} · ${formatCurrency(pixRevenue)}`} />
        <LegendRow
          color={ACCENT}
          label="Cartão"
          value={`${cardCount} · ${formatCurrency(cardRevenue)}`}
        />
        {tip && (
          <p className="rounded-md bg-surface-strong px-2.5 py-1.5 text-xs text-text-secondary">
            {tip}
          </p>
        )}
      </div>
    </div>
  )
}

function LegendRow({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="text-text-secondary">{label}</span>
      <span className="ml-auto tabular-nums font-medium text-text-primary">{value}</span>
    </div>
  )
}

function RevenueLineChart({
  points,
}: {
  points: { dateKey: string; label: string; revenue: number }[]
}) {
  const [hover, setHover] = useState<number | null>(null)

  if (!points.length) {
    return (
      <p className="text-sm text-text-secondary">Sem receita confirmada neste período.</p>
    )
  }

  const width = 720
  const height = 260
  const pad = { top: 16, right: 16, bottom: 36, left: 56 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const max = Math.max(...points.map((p) => p.revenue), 1)

  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? pad.left + innerW / 2
        : pad.left + (i / (points.length - 1)) * innerW
    const y = pad.top + innerH - (p.revenue / max) * innerH
    return { x, y, ...p }
  })

  const line = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ')

  const area =
    `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${(pad.top + innerH).toFixed(1)} ` +
    `L ${coords[0].x.toFixed(1)} ${(pad.top + innerH).toFixed(1)} Z`

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    value: max * t,
    y: pad.top + innerH - t * innerH,
  }))

  const labelStep = Math.max(1, Math.ceil(points.length / 8))

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-64 w-full min-w-[28rem]"
        role="img"
        aria-label="Receita confirmada por dia"
      >
        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={tick.y}
              y2={tick.y}
              stroke="#e8cdd5"
              strokeDasharray="4 4"
            />
            <text
              x={pad.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              className="fill-text-muted"
              fontSize="10"
            >
              {tick.value >= 1000
                ? `R$ ${(tick.value / 1000).toFixed(1)}k`
                : `R$ ${Math.round(tick.value)}`}
            </text>
          </g>
        ))}

        <path d={area} fill="rgba(118, 23, 44, 0.08)" />
        <path d={line} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinejoin="round" />

        {coords.map((c, i) => (
          <g key={c.dateKey}>
            {i % labelStep === 0 && (
              <text
                x={c.x}
                y={height - 12}
                textAnchor="middle"
                className="fill-text-muted"
                fontSize="10"
              >
                {c.label}
              </text>
            )}
            <circle
              cx={c.x}
              cy={c.y}
              r={hover === i ? 5 : 3}
              fill={ACCENT}
              className="cursor-pointer"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            <rect
              x={c.x - innerW / points.length / 2}
              y={pad.top}
              width={Math.max(innerW / points.length, 8)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}

        {hover != null && coords[hover] && (
          <g>
            <line
              x1={coords[hover].x}
              x2={coords[hover].x}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke={ACCENT}
              strokeOpacity="0.25"
            />
            <rect
              x={Math.min(coords[hover].x + 8, width - 140)}
              y={Math.max(coords[hover].y - 36, 8)}
              width="128"
              height="32"
              rx="6"
              fill="#4a202a"
            />
            <text
              x={Math.min(coords[hover].x + 8, width - 140) + 8}
              y={Math.max(coords[hover].y - 36, 8) + 20}
              fill="#f1dfdd"
              fontSize="11"
            >
              {coords[hover].label}: {formatCurrency(coords[hover].revenue)}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

function StatusBars({ rows }: { rows: { status: string; count: number }[] }) {
  if (!rows.length) {
    return <p className="text-sm text-text-secondary">Nenhum pedido neste período.</p>
  }

  const max = Math.max(...rows.map((r) => r.count), 1)

  return (
    <ul className="space-y-4">
      {rows.map((row) => {
        const width = Math.max(6, Math.round((row.count / max) * 100))
        return (
          <li key={row.status}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="text-text-secondary">
                {STATUS_LABEL[row.status] ?? row.status}
              </span>
              <span className="font-semibold tabular-nums text-text-primary">
                {row.count}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-sm bg-surface-strong">
              <div
                className="h-full rounded-sm transition-all"
                style={{ width: `${width}%`, background: STATUS_BAR }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function ProductSalesTable({
  rows,
  emptySearch,
  rankStart,
}: {
  rows: ProductSalesRow[]
  emptySearch: boolean
  rankStart: number
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-text-secondary">
        {emptySearch
          ? 'Nenhum produto encontrado com esse nome nas vendas do período.'
          : 'Ainda não há vendas de produtos neste período.'}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
            <th className="pb-2 pr-3 font-medium">#</th>
            <th className="pb-2 pr-3 font-medium">Produto</th>
            <th className="pb-2 pr-3 font-medium tabular-nums">Pedidos</th>
            <th className="pb-2 pr-3 font-medium tabular-nums">Unidades</th>
            <th className="pb-2 font-medium tabular-nums">Receita</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => (
            <tr key={row.productId}>
              <td className="py-2.5 pr-3 text-text-muted tabular-nums">
                {rankStart + index + 1}
              </td>
              <td className="py-2.5 pr-3">
                <Link
                  href="/admin/produtos"
                  className="font-medium text-text-primary hover:text-brand"
                  title={row.name}
                >
                  {row.name}
                </Link>
              </td>
              <td className="py-2.5 pr-3 font-semibold tabular-nums" style={{ color: ACCENT }}>
                {row.orderCount}
              </td>
              <td className="py-2.5 pr-3 tabular-nums text-text-secondary">
                {row.unitsSold}
              </td>
              <td className="py-2.5 font-medium tabular-nums">
                {formatCurrency(row.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProductPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPage,
}: {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPage: (page: number) => void
}) {
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-text-muted">
        Mostrando {from}–{to} de {totalItems} · {pageSize} por página
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anterior
        </button>
        <span className="text-xs font-medium tabular-nums text-text-secondary">
          Página {page} de {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </div>
  )
}
