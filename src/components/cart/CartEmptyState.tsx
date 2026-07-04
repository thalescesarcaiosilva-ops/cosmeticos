import Link from 'next/link'
import { IconCart } from '@/components/icons/DotIcons'
import { Button } from '@/components/ui/Button'

export function CartEmptyState() {
  return (
    <div
      className="flex flex-col items-center rounded-lg border border-border bg-surface-muted px-6 py-16 text-center"
      role="status"
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-surface text-brand">
        <IconCart className="size-8" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-text-primary">Seu carrinho está vazio</h2>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">
        Explore nossos produtos e adicione itens para continuar sua compra.
      </p>
      <Link href="/" className="mt-6">
        <Button type="button">Continuar comprando</Button>
      </Link>
    </div>
  )
}
