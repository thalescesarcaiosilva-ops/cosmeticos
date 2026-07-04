import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { createAdminClient } from '@/lib/supabase/admin'
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

type RecentOrder = {
  id: string
  status: string
  payment_status?: string | null
  total: number
  created_at: string
  shipping_method_name?: string | null
  profiles?: { name?: string } | null
}

export default async function AdminDashboardPage() {
  const admin = createAdminClient()

  const [products, categories, orders, pendingOrders, lowStock] = await Promise.all([
    admin.from('products').select('id', { count: 'exact', head: true }),
    admin.from('categories').select('id', { count: 'exact', head: true }),
    admin.from('orders').select('id', { count: 'exact', head: true }),
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    admin
      .from('products')
      .select('id, name, stock, slug')
      .eq('active', true)
      .lte('stock', 3)
      .order('stock', { ascending: true })
      .limit(5),
  ])

  let paidOrdersCount = 0
  let revenue = 0
  let recentOrders: RecentOrder[] = []
  let paymentColumnsAvailable = true

  const extendedRecent = await admin
    .from('orders')
    .select(
      'id, status, payment_status, total, created_at, profiles(name), shipping_method_name'
    )
    .order('created_at', { ascending: false })
    .limit(8)

  if (extendedRecent.error) {
    paymentColumnsAvailable = false
    const legacyRecent = await admin
      .from('orders')
      .select('id, status, total, created_at, shipping_method_name')
      .order('created_at', { ascending: false })
      .limit(8)
    recentOrders = (legacyRecent.data ?? []) as RecentOrder[]

    const legacyRevenue = await admin
      .from('orders')
      .select('total')
      .in('status', ['confirmed', 'shipped', 'delivered'])

    revenue =
      legacyRevenue.data?.reduce((sum, row) => sum + Number(row.total ?? 0), 0) ?? 0
  } else {
    recentOrders = (extendedRecent.data ?? []) as RecentOrder[]

    const [paidOrders, revenueResult] = await Promise.all([
      admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', 'paid'),
      admin
        .from('orders')
        .select('total')
        .in('status', ['confirmed', 'shipped', 'delivered'])
        .eq('payment_status', 'paid'),
    ])

    paidOrdersCount = paidOrders.count ?? 0
    revenue =
      revenueResult.data?.reduce((sum, row) => sum + Number(row.total ?? 0), 0) ?? 0
  }

  const stats = [
    { label: 'Produtos ativos', value: products.count ?? 0, href: '/admin/produtos' },
    { label: 'Pedidos totais', value: orders.count ?? 0, href: '/admin/pedidos' },
    {
      label: 'Aguardando pagamento',
      value: pendingOrders.count ?? 0,
      href: '/admin/pedidos',
      highlight: (pendingOrders.count ?? 0) > 0,
    },
    {
      label: 'Pagamentos confirmados',
      value: paidOrdersCount,
      href: '/admin/pedidos',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-text-secondary">
          Visão operacional da loja — pedidos, estoque e configurações.
        </p>
        {!paymentColumnsAvailable && (
          <p className="mt-2 text-xs text-badge-discount">
            Aplique a migration de checkout para ver status de pagamento e receita confirmada.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, href, highlight }) => (
          <Link key={label} href={href} className="block">
            <Card title={label}>
              <p
                className={`text-3xl font-bold ${highlight ? 'text-badge-discount' : 'text-[#3d1654]'}`}
              >
                {value}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Receita confirmada">
          <p className="text-3xl font-bold text-success">{formatCurrency(revenue)}</p>
          <p className="mt-2 text-sm text-text-secondary">
            {paymentColumnsAvailable
              ? 'Soma de pedidos confirmados, enviados ou entregues com pagamento pago.'
              : 'Soma de pedidos confirmados, enviados ou entregues (pagamento ainda não rastreado).'}
          </p>
        </Card>

        <Card title="Ações rápidas">
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/admin/pedidos" className="text-brand hover:underline">
                Ver todos os pedidos
              </Link>
            </li>
            <li>
              <Link href="/admin/mensagens" className="text-brand hover:underline">
                Mensagens de contato
              </Link>
            </li>
            <li>
              <Link href="/admin/loja" className="text-brand hover:underline">
                Dados da loja e devoluções
              </Link>
            </li>
            <li>
              <Link href="/admin/frete" className="text-brand hover:underline">
                Configurar frete
              </Link>
            </li>
            <li>
              <Link href="/admin/produtos" className="text-brand hover:underline">
                Gerenciar produtos
              </Link>
            </li>
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Pedidos recentes">
          {!recentOrders.length ? (
            <p className="text-sm text-text-secondary">Nenhum pedido ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentOrders.map((order) => {
                const profile = order.profiles as { name?: string } | null
                return (
                  <li key={order.id} className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <p className="font-mono text-sm font-medium">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {profile?.name ?? 'Cliente'} ·{' '}
                        {new Date(order.created_at).toLocaleString('pt-BR')}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {STATUS_LABEL[order.status] ?? order.status}
                        {order.payment_status && (
                          <>
                            {' · '}
                            {PAYMENT_LABEL[order.payment_status] ?? order.payment_status}
                          </>
                        )}
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
          {!lowStock.data?.length ? (
            <p className="text-sm text-text-secondary">Nenhum produto com estoque crítico.</p>
          ) : (
            <ul className="divide-y divide-border">
              {lowStock.data.map((product) => (
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
          <p className="mt-3 text-xs text-text-muted">
            Categorias cadastradas: {categories.count ?? 0}
          </p>
        </Card>
      </div>
    </div>
  )
}
