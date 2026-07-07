'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavLink = { href: string; label: string; exact?: boolean }

type NavSection = {
  title: string
  links: NavLink[]
}

const SECTIONS: NavSection[] = [
  {
    title: 'Visão geral',
    links: [{ href: '/admin', label: 'Dashboard', exact: true }],
  },
  {
    title: 'Vendas',
    links: [
      { href: '/admin/pedidos', label: 'Pedidos' },
      { href: '/admin/mensagens', label: 'Mensagens' },
    ],
  },
  {
    title: 'Catálogo',
    links: [
      { href: '/admin/produtos', label: 'Produtos' },
      { href: '/admin/avaliacoes', label: 'Avaliações' },
      { href: '/admin/categorias', label: 'Categorias' },
      { href: '/admin/marcas', label: 'Marcas' },
      { href: '/admin/midias', label: 'Mídia' },
      { href: '/admin/banners', label: 'Banners' },
    ],
  },
  {
    title: 'Loja',
    links: [
      { href: '/admin/loja', label: 'Dados da loja' },
      { href: '/admin/frete', label: 'Frete' },
      { href: '/admin/configuracoes', label: 'Pagamentos e SEO' },
    ],
  },
  {
    title: 'Aparência',
    links: [
      { href: '/admin/menu', label: 'Menu' },
      { href: '/admin/topbar', label: 'Top bar' },
      { href: '/admin/paginas', label: 'Páginas' },
      { href: '/admin/rodape', label: 'Rodapé' },
    ],
  },
]

type AdminSidebarProps = {
  storeName: string
  logoImageUrl: string | null
}

export function AdminSidebar({ storeName, logoImageUrl }: AdminSidebarProps) {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-[#3d1654] text-white">
      <div className="border-b border-white/10 px-5 py-6">
        <Link href="/admin" className="inline-flex flex-col gap-2">
          {logoImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoImageUrl}
              alt={storeName}
              className="h-9 w-auto max-w-[160px] object-contain brightness-0 invert"
            />
          ) : (
            <span className="text-lg font-bold tracking-tight">{storeName}</span>
          )}
          <span className="text-xs text-white/60">Painel da loja</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-3" aria-label="Menu admin">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.links.map(({ href, label, exact }) => (
                <Link
                  key={href}
                  href={href}
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(href, exact)
                      ? 'bg-white/15 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link href="/" className="block rounded-md px-3 py-2 text-sm text-white/60 hover:text-white">
          ← Voltar à loja
        </Link>
      </div>
    </aside>
  )
}
