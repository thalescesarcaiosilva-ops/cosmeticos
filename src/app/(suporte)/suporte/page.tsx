import { SupportLoginForm } from '@/components/support/SupportLoginForm'
import { SupportQueue } from '@/components/support/SupportQueue'
import { getUserRole } from '@/lib/auth/require-admin'
import { getSessionUser } from '@/lib/auth/verify-session'
import { SITE_SETTINGS_ID } from '@/lib/layout/queries'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type SupportPageProps = {
  searchParams: Promise<{ aviso?: string }>
}

async function loadStoreName(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('site_settings')
    .select('store_name')
    .eq('id', SITE_SETTINGS_ID)
    .maybeSingle()
  return data?.store_name?.trim() || 'Loja'
}

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const { aviso } = await searchParams
  const adminWarning = aviso === 'admin'
  const storeName = await loadStoreName()
  const user = await getSessionUser()

  if (!user) {
    return <SupportLoginForm storeName={storeName} adminWarning={adminWarning} />
  }

  const role = await getUserRole(user.id)
  if (role !== 'support' && role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 text-neutral-900">
        <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6">
          <h1 className="text-xl font-semibold">Acesso negado</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Esta fila é só para o suporte da loja.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm font-medium text-neutral-900 underline">
            Voltar à loja
          </Link>
        </div>
      </div>
    )
  }

  return <SupportQueue storeName={storeName} role={role} adminWarning={adminWarning} />
}
