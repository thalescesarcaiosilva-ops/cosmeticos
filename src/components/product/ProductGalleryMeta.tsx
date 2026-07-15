import Link from 'next/link'

type ProductGalleryMetaProps = {
  categories: { name: string; slug: string }[]
  brandName: string | null
  brandSlug?: string | null
}

export function ProductGalleryMeta({
  categories,
  brandName,
  brandSlug,
}: ProductGalleryMetaProps) {
  if (categories.length === 0 && !brandName) return null

  const brandHref = brandSlug
    ? `/${brandSlug}`
    : brandName
      ? `/busca?q=${encodeURIComponent(brandName)}`
      : null

  return (
    <dl className="mt-5 grid gap-x-8 gap-y-4 border-t border-border pt-5 sm:grid-cols-2">
      {categories.length > 0 && (
        <div className="min-w-0">
          <dt className="text-[13px] font-bold text-text-primary">Categorias</dt>
          <dd className="mt-1 text-[13px] leading-relaxed text-text-secondary">
            {categories.map((category, index) => (
              <span key={category.slug}>
                {index > 0 && (
                  <span className="mx-1 text-text-muted" aria-hidden>
                    ›
                  </span>
                )}
                <Link
                  href={`/colecoes/${category.slug}`}
                  className="underline decoration-border underline-offset-2 transition-colors hover:text-brand hover:decoration-brand"
                >
                  {category.name}
                </Link>
              </span>
            ))}
          </dd>
        </div>
      )}

      {brandName && (
        <div className="min-w-0">
          <dt className="text-[13px] font-bold text-text-primary">Marca</dt>
          <dd className="mt-1 text-[13px] leading-relaxed text-text-secondary">
            {brandHref ? (
              <Link
                href={brandHref}
                className="underline decoration-border underline-offset-2 transition-colors hover:text-brand hover:decoration-brand"
              >
                {brandName}
              </Link>
            ) : (
              brandName
            )}
          </dd>
        </div>
      )}
    </dl>
  )
}
