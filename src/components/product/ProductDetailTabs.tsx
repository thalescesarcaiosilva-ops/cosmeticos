type ProductDetailTabsProps = {
  description: string | null
}

export function ProductDetailTabs({ description }: ProductDetailTabsProps) {
  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="mb-4 text-lg font-bold text-text-primary">Descrição completa</h2>
      {description ? (
        <div
          className="product-description max-w-none text-sm leading-relaxed text-text-secondary [&_a]:text-brand [&_h4]:mb-2 [&_h4]:font-semibold [&_p]:mb-3"
          dangerouslySetInnerHTML={{ __html: description }}
        />
      ) : (
        <p className="text-sm text-text-muted">Descrição não disponível para este produto.</p>
      )}
    </section>
  )
}
