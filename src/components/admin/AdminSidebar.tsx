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
    title: 'Início',
    links: [{ href: '/admin', label: 'Dashboard', exact: true }],
  },
  {
    title: 'Atendimento',
    links: [
      { href: '/admin/pedidos', label: 'Pedidos' },
      { href: '/admin/mensagens', label: 'Fale conosco' },
    ],
  },
  {
    title: 'Catálogo',
    links: [
      { href: '/admin/produtos', label: 'Produtos' },
      { href: '/admin/compre-junto', label: 'Compre junto' },
      { href: '/admin/avaliacoes', label: 'Avaliações' },
      { href: '/admin/categorias', label: 'Categorias' },
      { href: '/admin/marcas', label: 'Marcas' },
    ],
  },
  {
    title: 'Conteúdo visual',
    links: [
      { href: '/admin/midias', label: 'Mídia' },
      { href: '/admin/banners', label: 'Banners' },
    ],
  },
  {
    title: 'Configurações',
    links: [
      { href: '/admin/loja', label: 'Dados da loja' },
      { href: '/admin/frete', label: 'Frete' },
      { href: '/admin/configuracoes', label: 'Pagamentos e SEO' },
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
    <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-950 text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <Link href="/admin" className="inline-flex flex-col gap-1.5">
          {logoImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoImageUrl}
              alt={storeName}
              className="h-8 w-auto max-w-[150px] object-contain brightness-0 invert"
            />
          ) : (
            <span className="text-base font-semibold tracking-tight">{storeName}</span>
          )}
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Admin</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-3" aria-label="Menu admin">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.links.map(({ href, label, exact }) => (
                <Link
                  key={href}
                  href={href}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive(href, exact)
                      ? 'bg-white font-semibold text-neutral-950'
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
        <Link
          href="/"
          className="block rounded-md px-3 py-2 text-sm text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          ← Voltar à loja
        </Link>
      </div>
    </aside>
  )
}
