import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'
import { StoreLogoMark } from '@/components/layout/StoreLogo'
import { FREE_SHIPPING_LABEL } from '@/lib/shipping/merchant-shipping'
import type { StoreLogo } from '@/types/layout'

type CheckoutTopBarProps = {
  storeName: string
  logo: StoreLogo
}

export function CheckoutTopBar({ storeName, logo }: CheckoutTopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#f3d0dc] bg-white">
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

        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-brand">
          <Lock className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Compra segura</span>
        </p>
      </div>
      <div className="bg-[#1a1014] px-4 py-2 text-center text-[12px] font-semibold tracking-wide text-white">
        <span className="text-brand">PRÉ BLACK FRIDAY</span>
        <span className="text-white/50"> · </span>
        <span>{FREE_SHIPPING_LABEL}</span>
      </div>
    </header>
  )
}
