import Link from 'next/link'
import { ArrowLeft, Home, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function NotFoundContent() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-surface-muted px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand">Erro 404</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-logo md:text-5xl">
          Página não encontrada
        </h1>
        <p className="mt-4 text-base leading-relaxed text-text-secondary">
          O endereço que você acessou não existe, foi movido ou está temporariamente indisponível.
          Verifique o link ou volte para continuar navegando na loja.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/">
            <Button type="button" className="gap-2">
              <Home className="size-4" aria-hidden />
              Ir para a loja
            </Button>
          </Link>
          <Link href="/busca">
            <Button type="button" variant="secondary" className="gap-2">
              <Search className="size-4" aria-hidden />
              Buscar produtos
            </Button>
          </Link>
        </div>

        <Link
          href="/fale-conosco"
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft className="size-4 rotate-180" aria-hidden />
          Precisa de ajuda? Fale conosco
        </Link>
      </div>
    </div>
  )
}
