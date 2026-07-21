'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { IconSearch } from '@/components/icons/DotIcons'
import { formatCurrency } from '@/lib/products/format'
import type { ProductCardData } from '@/types/product'

type SearchBarProps = {
  className?: string
  id?: string
  variant?: 'desktop' | 'mobile'
  overlay?: boolean
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

export function SearchBar({ className = '', id, variant = 'desktop', overlay = false }: SearchBarProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listboxId = `${inputId}-listbox`
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductCardData[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const debouncedQuery = useDebouncedValue(query.trim(), 280)

  const fetchResults = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`)
      const json = await res.json()
      setResults(json.data ?? [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    fetchResults(debouncedQuery)
  }, [debouncedQuery, open, fetchResults])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function goToSearchPage(term: string) {
    const q = term.trim()
    if (q.length < 2) return
    setOpen(false)
    router.push(`/busca?q=${encodeURIComponent(q)}`)
  }

  function goToProduct(slug: string) {
    setOpen(false)
    setQuery('')
    router.push(`/produto/${slug}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (activeIndex >= 0 && results[activeIndex]) {
      goToProduct(results[activeIndex].slug)
      return
    }
    goToSearchPage(query)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === 'ArrowDown' && query.trim().length >= 2) {
        setOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      goToProduct(results[activeIndex].slug)
    }
  }

  const showDropdown = open && query.trim().length >= 2

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="search-form" role="search">
        <label htmlFor={inputId} className="sr-only">
          Buscar produtos
        </label>
        <div className="relative flex w-full items-center">
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            name="q"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
              setActiveIndex(-1)
            }}
            onFocus={() => {
              if (query.trim().length >= 2) setOpen(true)
            }}
            onKeyDown={handleKeyDown}
            maxLength={100}
            placeholder={
              variant === 'mobile'
                ? 'Buscar produto, marca…'
                : 'Digite Aqui a Marca, Nome ou Tipo de Produto…'
            }
            autoComplete="off"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${inputId}-option-${activeIndex}` : undefined
            }
            className={`search-input w-full border font-semibold transition-colors duration-[400ms] focus:outline-none focus:ring-2 ${
              overlay
                ? 'border-white/20 bg-white/15 text-white placeholder:text-white/70 focus:border-white/40 focus:ring-white/15'
                : 'border-border text-text-primary placeholder:text-text-muted focus:border-brand focus:ring-brand/15'
            } ${
              variant === 'mobile'
                ? 'rounded-full py-1.5 pl-3 pr-10 text-sm'
                : 'rounded-md py-2.5 pl-4 pr-12 text-sm md:py-3'
            }`}
          />
          <button
            type="submit"
            title="Buscar"
            className={`absolute right-0.5 flex items-center justify-center transition-opacity duration-[400ms] hover:opacity-80 md:right-1.5 ${
              variant === 'mobile' ? 'size-8' : 'size-9'
            } ${overlay ? 'text-white' : 'text-brand'}`}
            aria-label="Buscar"
          >
            <IconSearch className={`stroke-[2.25] ${variant === 'mobile' ? 'size-4' : 'size-5'}`} />
          </button>
        </div>
      </form>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className={`absolute left-0 right-0 top-[calc(100%+6px)] z-[60] overflow-hidden rounded-lg border border-border bg-surface shadow-lg transition-all duration-200 ease-out ${
            loading || results.length > 0
              ? 'translate-y-0 opacity-100'
              : 'translate-y-1 opacity-100'
          }`}
        >
          {loading && (
            <p className="px-4 py-3 text-sm text-text-secondary" role="status">
              Buscando…
            </p>
          )}

          {!loading && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-text-secondary" role="status">
              Nenhum produto encontrado para &quot;{query.trim()}&quot;
            </p>
          )}

          {!loading && results.length > 0 && (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((product, index) => {
                const selected = index === activeIndex
                return (
                  <li key={product.id} role="option" aria-selected={selected}>
                    <button
                      id={`${inputId}-option-${index}`}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goToProduct(product.slug)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        selected ? 'bg-brand/8' : 'hover:bg-surface-muted'
                      }`}
                    >
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-contain p-1"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-[10px] text-text-muted">
                            —
                          </span>
                        )}
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-medium text-text-primary">
                          {product.name}
                        </span>
                        <span className="mt-0.5 block text-sm font-bold text-brand">
                          {formatCurrency(product.price)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {!loading && results.length > 0 && (
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={() => goToSearchPage(query)}
                className="w-full rounded-md py-2 text-center text-xs font-semibold text-brand hover:bg-brand/5"
              >
                Ver todos os resultados para &quot;{query.trim()}&quot;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
