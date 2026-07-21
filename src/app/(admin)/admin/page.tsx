import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { DashboardProductSales } from '@/components/admin/DashboardProductSales'
import { getDashboardAnalytics } from '@/lib/admin/dashboard-analytics'
import { formatCurrency } from '@/lib/products/format'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando pagamento',
  confirmed: 'Confirmado',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

const PAYMENT_LABEL: Record<string, string> = {
  pending: 'Pagamento pendente',
  paid: 'Pago',
  refused: 'Recusado',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
}

const METHOD_LABEL: Record<string, string> = {
  pix: 'Pix',
  credit_card: 'Cartão',
}

function pct(part: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

export default async function AdminDashboardPage() {
  const data = await getDashboardAnalytics()

  const paymentTotal = data.pixOrders + data.cardOrders
  const overviewStats = [
    {
      label: 'Pedidos totais',
      value: data.totalOrders,
      href: '/admin/pedidos',
      hint: 'Todos os pedidos da loja',
    },
    {
      label: 'Aguardando pagamento',
      value: data.pendingOrders,
      href: '/admin/pedidos',
      hint: 'Status pendente',
      highlight: data.pendingOrders > 0,
    },
    {
      label: 'Pagamentos confirmados',
      value: data.paidOrders,
      href: '/admin/pedidos',
      hint: 'payment_status = pago',
    },
    {
      label: 'Produtos ativos',
      value: data.productsActive,
      href: '/admin/produtos',
      hint: `${data.categoriesCount} categorias`,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-text-secondary">
          Análise operacional da loja — vendas, meios de pagamento, ranking de produtos e
          estoque.
        </p>
        {!data.paymentColumnsAvailable && (
          <p className="mt-2 text-xs text-badge-discount">
            Colunas de pagamento não encontradas. A receita usa pedidos confirmados/enviados/
            entregues sem filtrar pagamento.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewStats.map(({ label, value, href, hint, highlight }) => (
          <Link key={label} href={href} className="block">
            <Card title={label}>
              <p
                className={`text-3xl font-bold ${highlight ? 'text-badge-discount' : 'text-[#3d1654]'}`}
              >
                {value}
              </p>
              <p className="mt-2 text-xs text-text-muted">{hint}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Receita confirmada">
          <p className="text-3xl font-bold text-success">
            {formatCurrency(data.confirmedRevenue)}
          </p>
          <p className="mt-2 text-xs text-text-muted">
            {data.confirmedOrders} pedidos vendidos · ticket médio{' '}
            {formatCurrency(data.averageTicket)}
          </p>
        </Card>

        <Card title="Pedidos Pix">
          <p className="text-3xl font-bold text-[#3d1654]">{data.pixOrders}</p>
          <p className="mt-2 text-sm font-medium tabular-nums">
            {formatCurrency(data.pixRevenue)}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {pct(data.pixOrders, paymentTotal || data.totalOrders)} dos pedidos com meio
            definido
          </p>
        </Card>

        <Card title="Pedidos cartão">
          <p className="text-3xl font-bold text-[#3d1654]">{data.cardOrders}</p>
          <p className="mt-2 text-sm font-medium tabular-nums">
            {formatCurrency(data.cardRevenue)}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {pct(data.cardOrders, paymentTotal || data.totalOrders)} dos pedidos com meio
            definido
          </p>
        </Card>

        <Card title="Unidades vendidas">
          <p className="text-3xl font-bold text-[#3d1654]">{data.totalUnitsSold}</p>
          <p className="mt-2 text-xs text-text-muted">
            Em {data.productSales.length} produtos distintos ·{' '}
            {data.cancelledOrders} pedidos cancelados
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Pix vs cartão">
          {!paymentTotal ? (
            <p className="text-sm text-text-secondary">
              Ainda não há pedidos com meio de pagamento registrado.
            </p>
          ) : (
            <div className="space-y-4">
              <PaymentBar
                label="Pix"
                count={data.pixOrders}
                total={paymentTotal}
                revenue={data.pixRevenue}
                tone="pix"
              />
              <PaymentBar
                label="Cartão"
                count={data.cardOrders}
                total={paymentTotal}
                revenue={data.cardRevenue}
                tone="card"
              />
              {data.otherPaymentOrders > 0 && (
                <p className="text-xs text-text-muted">
                  +{data.otherPaymentOrders} pedido(s) com outro meio.
                </p>
              )}
            </div>
          )}
        </Card>

        <Card title="Extras da loja">
          <dl className="space-y-3 text-sm">
            <ExtraRow label="Ticket médio" value={formatCurrency(data.averageTicket)} />
            <ExtraRow
              label="Receita de frete"
              value={formatCurrency(data.shippingRevenue)}
            />
            <ExtraRow
              label="Descontos aplicados"
              value={formatCurrency(data.discountTotal)}
            />
            <ExtraRow
              label="Pedidos vendidos"
              value={String(data.confirmedOrders)}
            />
            <ExtraRow
              label="Produtos com venda"
              value={String(data.productSales.length)}
            />
            <ExtraRow label="Categorias" value={String(data.categoriesCount)} />
          </dl>
        </Card>

        <Card title="Pedidos por status">
          {!data.statusBreakdown.length ? (
            <p className="text-sm text-text-secondary">Nenhum pedido ainda.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.statusBreakdown.map(({ status, count }) => (
                <li key={status} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-text-secondary">
                    {STATUS_LABEL[status] ?? status}
                  </span>
                  <span className="font-semibold tabular-nums text-[#3d1654]">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <DashboardProductSales
        topProducts={data.topProducts}
        productSales={data.productSales}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Pedidos recentes">
          {!data.recentOrders.length ? (
            <p className="text-sm text-text-secondary">Nenhum pedido ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentOrders.map((order) => {
                const profile = order.profiles as { name?: string } | null
                const customer =
                  order.customer_name?.trim() || profile?.name || 'Cliente'
                return (
                  <li key={order.id} className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <p className="font-mono text-sm font-medium">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {customer} · {new Date(order.created_at).toLocaleString('pt-BR')}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {STATUS_LABEL[order.status] ?? order.status}
                        {order.payment_status && (
                          <>
                            {' · '}
                            {PAYMENT_LABEL[order.payment_status] ?? order.payment_status}
                          </>
                        )}
                        {order.payment_method
                          ? ` · ${METHOD_LABEL[order.payment_method] ?? order.payment_method}`
                          : ''}
                        {order.shipping_method_name
                          ? ` · ${order.shipping_method_name}`
                          : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(Number(order.total))}
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
            <p className="text-sm text-text-secondary">Nenhum produto com estoque crítico.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.lowStock.map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-4 py-3">
                  <Link
                    href="/admin/produtos"
                    className="text-sm font-medium text-text-primary hover:text-brand"
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
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href="/admin/pedidos" className="text-brand hover:underline">
              Pedidos
            </Link>
            <Link href="/admin/mensagens" className="text-brand hover:underline">
              Mensagens
            </Link>
            <Link href="/admin/loja" className="text-brand hover:underline">
              Dados da loja
            </Link>
            <Link href="/admin/produtos" className="text-brand hover:underline">
              Produtos
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}

function PaymentBar({
  label,
  count,
  total,
  revenue,
  tone,
}: {
  label: string
  count: number
  total: number
  revenue: number
  tone: 'pix' | 'card'
}) {
  const width = total > 0 ? Math.max(4, Math.round((count / total) * 100)) : 0
  const barClass = tone === 'pix' ? 'bg-success' : 'bg-[#3d1654]'

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-text-primary">{label}</span>
        <span className="tabular-nums text-text-secondary">
          {count} · {pct(count, total)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1.5 text-xs tabular-nums text-text-muted">
        Receita confirmada: {formatCurrency(revenue)}
      </p>
    </div>
  )
}

function ExtraRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-semibold tabular-nums text-text-primary">{value}</dd>
    </div>
  )
}
