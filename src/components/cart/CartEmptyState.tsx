import Link from 'next/link'
import { IconCart } from '@/components/icons/DotIcons'
import { Button } from '@/components/ui/Button'

export function CartEmptyState() {
  return (
    <div
      className="flex flex-col items-center rounded-xl border border-border bg-cream/60 px-6 py-16 text-center md:py-20"
      role="status"
    >
      <div className="flex size-14 items-center justify-center rounded-full border border-border bg-surface text-text-secondary">
        <IconCart className="size-7" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-text-primary md:text-xl">
        Seu carrinho está vazio
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
        Explore as coleções e adicione os produtos que deseja comprar.
      </p>
      <Link href="/" className="mt-7">
        <Button type="button" className="!rounded-md px-8">
          Continuar comprando
        </Button>
      </Link>
    </div>
  )
}
