'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { fetchApi } from '@/lib/api/fetch-api'

type AdminHeaderProps = {
  title: string
}

export function AdminHeader({ title }: AdminHeaderProps) {
  const router = useRouter()

  async function handleLogout() {
    await fetchApi('/api/auth/logout', { method: 'POST' })
    router.push('/conta/login')
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Painel
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-950">{title}</h1>
      </div>
      <Button type="button" variant="secondary" className="!rounded-md" onClick={handleLogout}>
        Sair
      </Button>
    </header>
  )
}
