import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/server'

export default async function AccountDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/conta/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, created_at')
    .eq('id', user.id)
    .single()

  const { count: orderCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const displayName = profile?.name ?? user.email?.split('@')[0] ?? 'Cliente'
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Olá, {displayName}</h1>
        <p className="mt-1 text-sm text-text-secondary">Bem-vindo à sua conta</p>
      </div>

      {isAdmin && (
        <Card title="Painel administrativo">
          <p className="text-sm text-text-secondary">
            Você tem acesso ao painel de gestão da loja.
          </p>
          <Link href="/admin" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
            Ir para o admin →
          </Link>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Pedidos">
          <p className="text-3xl font-bold text-brand">{orderCount ?? 0}</p>
          <p className="mt-1 text-sm text-text-secondary">pedidos realizados</p>
          <Link href="/conta/pedidos" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
            Ver pedidos →
          </Link>
        </Card>
        <Card title="Dados pessoais">
          <p className="text-sm text-text-secondary">{user.email}</p>
          <Link href="/conta/dados" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
            Editar dados →
          </Link>
        </Card>
      </div>
    </div>
  )
}
