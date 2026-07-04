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
    <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
      <h1 className="text-xl font-bold text-text-primary">{title}</h1>
      <Button type="button" variant="secondary" onClick={handleLogout}>
        Sair
      </Button>
    </header>
  )
}
