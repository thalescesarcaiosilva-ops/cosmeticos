'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { IconChevronDown } from '@/components/icons/DotIcons'
import type { MenuCategory } from '@/types/layout'

type MainNavProps = {
  categories: MenuCategory[]
  className?: string
  overlay?: boolean
}

type NavDropdownItemProps = {
  category: MenuCategory
  overlay: boolean
}

function NavDropdownItem({ category, overlay }: NavDropdownItemProps) {
  const children = category.children ?? []
  const hasChildren = children.length > 0
  const showChevron = hasChildren || category.hasDropdown
  const [hoverOpen, setHoverOpen] = useState(false)
  const [clickOpen, setClickOpen] = useState(false)
  const itemRef = useRef<HTMLLIElement>(null)

  const isOpen = hasChildren && (hoverOpen || clickOpen)

  useEffect(() => {
    if (!clickOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!itemRef.current?.contains(event.target as Node)) {
        setClickOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [clickOpen])

  const linkClass = `whitespace-nowrap rounded-sm px-3 py-3 text-[13px] font-bold transition-colors duration-[400ms] md:text-sm ${
    overlay
      ? 'text-white hover:bg-white/10'
      : 'text-text-primary hover:bg-surface-muted'
  }`

  const chevronClass = `flex size-8 shrink-0 items-center justify-center rounded-sm transition-colors duration-[400ms] ${
    overlay ? 'text-white hover:bg-white/10' : 'text-text-primary hover:bg-surface-muted'
  }`

  function closeMenu() {
    setHoverOpen(false)
    setClickOpen(false)
  }

  return (
    <li
      ref={itemRef}
      className="relative shrink-0"
      onMouseEnter={() => {
        if (hasChildren) setHoverOpen(true)
      }}
      onMouseLeave={() => {
        if (!clickOpen) setHoverOpen(false)
      }}
    >
      <div className="flex items-center">
        <Link href={category.href} className={linkClass}>
          {category.label}
        </Link>
        {showChevron && (
          <button
            type="button"
            className={chevronClass}
            aria-label={`${isOpen ? 'Fechar' : 'Abrir'} submenu ${category.label}`}
            aria-expanded={isOpen}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (!hasChildren) return
              setClickOpen((value) => !value)
              setHoverOpen(false)
            }}
          >
            <IconChevronDown
              className={`size-3.5 stroke-[2.5] transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        )}
      </div>

      {hasChildren && (
        <div
          className={`absolute left-0 top-full z-[100] pt-1 transition-[opacity,transform,visibility] duration-200 ease-out ${
            isOpen
              ? 'visible translate-y-0 opacity-100'
              : 'pointer-events-none invisible -translate-y-1 opacity-0'
          }`}
        >
          <div className="min-w-[220px] border border-border bg-surface py-2 shadow-lg">
            {children.map((child) => (
              <Link
                key={child.id}
                href={child.href}
                className="block px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted"
                onClick={closeMenu}
              >
                {child.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </li>
  )
}

export function MainNav({ categories, className = '', overlay = false }: MainNavProps) {
  if (categories.length === 0) return null

  return (
    <nav
      className={`overflow-visible transition-colors duration-[400ms] ${
        overlay ? 'border-t border-white/10 bg-transparent' : 'border-t border-border bg-surface'
      } ${className}`}
      aria-label="Categorias principais"
    >
      <div className="mx-auto max-w-[1200px] overflow-visible px-4 md:px-6">
        <ul className="flex items-center gap-1 overflow-visible py-1">
          {categories.map((category) => (
            <NavDropdownItem key={category.id} category={category} overlay={overlay} />
          ))}
        </ul>
      </div>
    </nav>
  )
}
