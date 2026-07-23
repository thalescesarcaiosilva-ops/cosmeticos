'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconChevronDown,
  IconChevronLeft,
  IconCustomer,
  IconHelp,
  IconPackage,
} from '@/components/icons/DotIcons'
import type { ContactPageLink, MenuCategory } from '@/types/layout'

type MobileNavDrawerProps = {
  open: boolean
  onClose: () => void
  menuCategories: MenuCategory[]
  contactPage: ContactPageLink
}

export function MobileNavDrawer({
  open,
  onClose,
  menuCategories,
  contactPage,
}: MobileNavDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setExpandedIds(new Set())
    }
  }, [open])

  if (!mounted || !open) return null

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[200] bg-black/40 md:hidden"
        onClick={onClose}
        aria-label="Fechar menu"
      />
      <aside
        className="fixed inset-y-0 left-0 z-[210] flex h-[100dvh] max-h-[100dvh] w-[min(100%,340px)] flex-col overflow-hidden bg-surface shadow-2xl md:hidden"
        aria-label="Menu principal"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
          <button
            type="button"
            className="flex size-10 shrink-0 items-center justify-center text-brand"
            onClick={onClose}
            aria-label="Voltar"
          >
            <IconChevronLeft className="size-7" />
          </button>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            <Link
              href="/paginas/rastreio"
              className="flex min-w-0 items-center gap-1.5 rounded-full border border-brand/20 bg-brand/5 px-3 py-2 text-xs font-bold text-brand transition-opacity duration-[400ms] hover:opacity-95 sm:px-4 sm:text-sm"
              onClick={onClose}
            >
              <IconPackage className="size-4 shrink-0 sm:size-5" />
              <span className="truncate">Rastreie seu Pedido</span>
            </Link>
            <Link
              href={contactPage.href}
              className="flex min-w-0 items-center gap-1.5 rounded-full border border-brand/20 bg-brand/5 px-3 py-2 text-xs font-bold text-brand transition-opacity duration-[400ms] hover:opacity-95 sm:px-4 sm:text-sm"
              onClick={onClose}
            >
              <IconHelp className="size-4 shrink-0 sm:size-5" />
              <span className="truncate">{contactPage.label}</span>
            </Link>
            <Link
              href="/conta"
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3 py-2 text-xs font-bold text-white transition-opacity duration-[400ms] hover:opacity-95 sm:px-4 sm:text-sm"
              onClick={onClose}
            >
              <IconCustomer className="size-4 shrink-0 sm:size-5" />
              <span className="whitespace-nowrap">Minha conta</span>
            </Link>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ul>
            {menuCategories.map((category) => {
              const children = category.children ?? []
              const hasChildren = children.length > 0
              const expanded = expandedIds.has(category.id)

              return (
                <li key={category.id} className="border-b border-border/80">
                  <div className="flex items-stretch">
                    <Link
                      href={category.href}
                      className="min-w-0 flex-1 px-4 py-4 text-[14px] font-bold text-text-primary transition-colors hover:bg-surface-muted"
                      onClick={onClose}
                    >
                      {category.label}
                    </Link>
                    {hasChildren && (
                      <button
                        type="button"
                        className="flex w-12 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
                        aria-label={`${expanded ? 'Fechar' : 'Abrir'} submenu ${category.label}`}
                        aria-expanded={expanded}
                        onClick={() => toggleExpanded(category.id)}
                      >
                        <IconChevronDown
                          className={`size-4 transition-transform duration-200 ${
                            expanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    )}
                  </div>
                  {hasChildren && expanded && (
                    <ul className="border-t border-border/60 bg-surface-muted/40">
                      {children.map((child) => (
                        <li key={child.id}>
                          <Link
                            href={child.href}
                            className="block px-6 py-3 text-[13px] font-medium text-text-primary transition-colors hover:bg-surface-muted"
                            onClick={onClose}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>,
    document.body
  )
}
