'use client'

import { usePathname } from 'next/navigation'
import { AdminShell } from '@/components/admin/AdminShell'

const TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/produtos': 'Produtos',
  '/admin/midias': 'Biblioteca de mídia',
  '/admin/banners': 'Banners',
  '/admin/marcas': 'Marcas',
  '/admin/categorias': 'Categorias',
  '/admin/pedidos': 'Pedidos',
  '/admin/mensagens': 'Fale conosco',
  '/admin/compre-junto': 'Compre junto',
  '/admin/avaliacoes': 'Avaliações',
  '/admin/loja': 'Dados da loja',
  '/admin/configuracoes': 'Pagamentos e SEO',
  '/admin/menu': 'Menu',
  '/admin/paginas': 'Páginas',
  '/admin/topbar': 'Top bar',
  '/admin/rodape': 'Rodapé',
  '/admin/frete': 'Frete',
}

type AdminLayoutShellProps = {
  storeName: string
  logoImageUrl: string | null
  children: React.ReactNode
}

export function AdminLayoutShell({ storeName, logoImageUrl, children }: AdminLayoutShellProps) {
  const pathname = usePathname()
  const title = TITLES[pathname] ?? 'Admin'

  return (
    <AdminShell title={title} storeName={storeName} logoImageUrl={logoImageUrl}>
      {children}
    </AdminShell>
  )
}
