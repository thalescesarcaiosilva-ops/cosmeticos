import Link from 'next/link'

type ProductGalleryMetaProps = {
  categories: { name: string; slug: string }[]
  brandName: string | null
}

export function ProductGalleryMeta({ categories, brandName }: ProductGalleryMetaProps) {
  if (categories.length === 0 && !brandName) return null

  return (
    <div className="mt-5 grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
      {categories.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-text-muted">
            Categorias
          </p>
          <p className="text-sm leading-relaxed text-text-primary">
            {categories.map((category, index) => (
              <span key={category.slug}>
                {index > 0 && (
                  <span className="mx-1 text-text-muted" aria-hidden>
                    ›
                  </span>
                )}
                <Link
                  href={`/colecoes/${category.slug}`}
                  className="font-bold text-text-primary underline-offset-2 transition-colors hover:text-brand hover:underline"
                >
                  {category.name}
                </Link>
              </span>
            ))}
          </p>
        </div>
      )}

      {brandName && (
        <div>
          <p className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-text-muted">
            Marca
          </p>
          <p className="text-sm font-bold text-text-primary">{brandName}</p>
        </div>
      )}
    </div>
  )
}
