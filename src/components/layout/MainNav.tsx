import Link from 'next/link'
import { IconChevronDown } from '@/components/icons/DotIcons'
import type { MenuCategory } from '@/types/layout'

type MainNavProps = {
  categories: MenuCategory[]
  className?: string
  overlay?: boolean
}

export function MainNav({ categories, className = '', overlay = false }: MainNavProps) {
  if (categories.length === 0) return null

  return (
    <nav
      className={`transition-colors duration-[400ms] ${
        overlay ? 'border-t border-white/10 bg-transparent' : 'border-t border-border bg-surface'
      } ${className}`}
      aria-label="Categorias principais"
    >
      <div className="mx-auto max-w-[1200px] px-4 md:px-6">
        <ul className="flex items-center gap-1 overflow-x-auto py-1">
          {categories.map((category) => (
            <li key={category.id} className="shrink-0">
              <Link
                href={category.href}
                className={`flex items-center gap-1 whitespace-nowrap rounded-sm px-3 py-3 text-[13px] font-bold transition-colors duration-[400ms] md:text-sm ${
                  overlay
                    ? 'text-white hover:bg-white/10'
                    : 'text-text-primary hover:bg-surface-muted'
                }`}
              >
                {category.label}
                {category.hasDropdown && (
                  <IconChevronDown className="size-3.5 stroke-[2.5]" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
