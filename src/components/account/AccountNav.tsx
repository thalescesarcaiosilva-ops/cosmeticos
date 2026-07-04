'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { fetchApi } from '@/lib/api/fetch-api'

type AccountNavProps = {
  isAdmin?: boolean
}

const links = [
  { href: '/conta', label: 'Minha conta', exact: true },
  { href: '/conta/pedidos', label: 'Pedidos' },
  { href: '/favoritos', label: 'Favoritos' },
  { href: '/conta/dados', label: 'Meus dados' },
  { href: '/conta/enderecos', label: 'Endereços' },
]

export function AccountNav({ isAdmin = false }: AccountNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetchApi('/api/auth/logout', { method: 'POST' })
    router.push('/conta/login')
    router.refresh()
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <nav className="space-y-1" aria-label="Menu da conta">
      {links.map(({ href, label, exact }) => (
        <Link
          key={href}
          href={href}
          className={`block rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
            isActive(href, exact)
              ? 'bg-brand/10 text-brand'
              : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
          }`}
        >
          {label}
        </Link>
      ))}
      {isAdmin && (
        <Link
          href="/admin"
          className="block rounded-md px-4 py-2.5 text-sm font-medium text-logo transition-colors hover:bg-logo/10"
        >
          Painel admin
        </Link>
      )}
      <button
        type="button"
        onClick={handleLogout}
        className="block w-full rounded-md px-4 py-2.5 text-left text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-badge-discount"
      >
        Sair
      </button>
    </nav>
  )
}
