import Link from 'next/link'

type ProductBreadcrumbProps = {
  category: { name: string; slug: string } | null
  brandName: string | null
  brandSlug: string | null
  productName: string
}

export function ProductBreadcrumb({
  category,
  brandName,
  brandSlug,
  productName,
}: ProductBreadcrumbProps) {
  const brandHref = brandSlug
    ? `/${brandSlug}`
    : brandName
      ? `/busca?q=${encodeURIComponent(brandName)}`
      : null

  return (
    <nav className="mb-5 text-[12px] font-bold text-text-secondary md:text-[13px]" aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <li>
          <Link href="/" className="transition-colors duration-[400ms] hover:text-brand">
            Página Inicial
          </Link>
        </li>
        {brandName && (
          <>
            <li aria-hidden className="text-text-muted">
              ›
            </li>
            <li>
              {brandHref ? (
                <Link
                  href={brandHref}
                  className="transition-colors duration-[400ms] hover:text-brand"
                >
                  {brandName}
                </Link>
              ) : (
                <span className="text-text-primary">{brandName}</span>
              )}
            </li>
          </>
        )}
        {category && (
          <>
            <li aria-hidden className="text-text-muted">
              ›
            </li>
            <li>
              <Link
                href={`/colecoes/${category.slug}`}
                className="transition-colors duration-[400ms] hover:text-brand"
              >
                {category.name}
              </Link>
            </li>
          </>
        )}
        <li aria-hidden className="text-text-muted">
          ›
        </li>
        <li className="text-text-primary" aria-current="page">
          {productName}
        </li>
      </ol>
    </nav>
  )
}
