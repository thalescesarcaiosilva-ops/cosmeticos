import { ProductCard } from '@/components/product/ProductCard'
import type { InstallmentDisplay } from '@/types/payment'
import type { ProductCardData } from '@/types/product'

type ProductGridProps = {
  products: ProductCardData[]
  installments?: Map<string, InstallmentDisplay | null>
  emptyMessage?: string
}

export function ProductGrid({
  products,
  installments,
  emptyMessage = 'Nenhum produto encontrado.',
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-surface-muted px-6 py-12 text-center text-sm text-text-secondary">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          installment={installments?.get(product.id) ?? null}
        />
      ))}
    </div>
  )
}
