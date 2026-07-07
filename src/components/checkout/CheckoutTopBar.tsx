import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { StoreLogoMark } from '@/components/layout/StoreLogo'
import type { StoreLogo } from '@/types/layout'

type CheckoutTopBarProps = {
  storeName: string
  logo: StoreLogo
}

export function CheckoutTopBar({ storeName, logo }: CheckoutTopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-4 px-4 md:h-16 md:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-brand"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Voltar à loja</span>
          <span className="sm:hidden">Loja</span>
        </Link>

        <div className="absolute left-1/2 -translate-x-1/2">
          <StoreLogoMark logo={logo} storeName={storeName} />
        </div>

        <div className="w-[88px] shrink-0 sm:w-[108px]" aria-hidden />
      </div>
    </header>
  )
}
