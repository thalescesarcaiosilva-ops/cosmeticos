import Image from 'next/image'
import Link from 'next/link'

type CategoryGridItem = {
  id: string
  name: string
  slug: string
  imageUrl: string | null
}

type CategoryGridProps = {
  items: CategoryGridItem[]
}

export function CategoryGrid({ items }: CategoryGridProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-surface-muted px-6 py-10 text-center text-sm text-text-secondary">
        Nenhuma coleção cadastrada. Adicione categorias no painel admin.
      </p>
    )
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="flex min-w-min gap-5 sm:flex-wrap sm:justify-center sm:gap-6 md:gap-8">
        {items.map((item) => (
          <li key={item.id} className="shrink-0 sm:shrink">
            <Link
              href={`/colecoes/${item.slug}`}
              className="group flex w-[6rem] flex-col items-center gap-2 sm:w-32"
            >
              <div className="relative size-[4.5rem] overflow-hidden rounded-full bg-[#e8f1f8] ring-1 ring-border/40 transition-transform duration-300 group-hover:scale-105 sm:size-25">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 72px, 100px"
                    quality={70}
                    className="object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-text-muted">
                    Sem imagem
                  </div>
                )}
              </div>
              <span className="line-clamp-2 text-center text-xs font-medium leading-tight text-text-primary group-hover:text-logo sm:text-sm">
                {item.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
