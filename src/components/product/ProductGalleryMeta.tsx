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
    <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-4 text-sm">
      {categories.length > 0 && (
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Categorias
          </dt>
          <dd className="mt-1 text-text-primary">
            {categories.map((category, index) => (
              <span key={category.slug}>
                {index > 0 && (
                  <span className="mx-1.5 text-text-muted" aria-hidden>
                    /
                  </span>
                )}
                <Link
                  href={`/colecoes/${category.slug}`}
                  className="font-medium underline-offset-2 transition-colors hover:text-brand hover:underline"
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
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Marca
          </dt>
          <dd className="mt-1 font-medium text-text-primary">
            {brandHref ? (
              <Link
                href={brandHref}
                className="underline-offset-2 transition-colors hover:text-brand hover:underline"
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
