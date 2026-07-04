'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/products/format'
import type { CollectionFilterMeta } from '@/types/collection'
import type { CollectionSort } from '@/schemas/category-schema'

type CollectionFiltersProps = {
  meta: CollectionFilterMeta
  className?: string
}

type SortOption = {
  value: CollectionSort
  label: string
  icon: string
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'relevance', label: 'Relevância', icon: '★' },
  { value: 'price_desc', label: 'Maior preço', icon: '↑$' },
  { value: 'price_asc', label: 'Menor preço', icon: '↓$' },
  { value: 'discount', label: 'Desconto', icon: '%' },
  { value: 'newest', label: 'Lançamento', icon: '◇' },
  { value: 'name_asc', label: 'A - Z', icon: 'A↑' },
  { value: 'name_desc', label: 'Z - A', icon: 'Z↓' },
]

function FilterSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-3 text-left text-xs font-bold uppercase tracking-wide text-logo"
        aria-expanded={open}
      >
        {title}
        <span className="text-sm text-text-secondary" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  )
}

function CheckboxList({
  items,
  selected,
  onToggle,
}: {
  items: { id: string; name: string; count: number }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Nenhuma opção disponível.</p>
  }

  return (
    <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
      {items.map((item) => {
        const checked = selected.includes(item.id)
        return (
          <li key={item.id}>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(item.id)}
                className="mt-0.5 size-4 shrink-0 rounded border-border text-brand focus:ring-brand/30"
              />
              <span>
                {item.name}{' '}
                <span className="text-text-muted">({item.count})</span>
              </span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

export function CollectionFilters({ meta, className = '' }: CollectionFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentSort = (searchParams.get('sort') as CollectionSort) || 'relevance'
  const selectedBrands = useMemo(
    () => searchParams.get('brands')?.split(',').filter(Boolean) ?? [],
    [searchParams]
  )
  const selectedCategories = useMemo(
    () => searchParams.get('categories')?.split(',').filter(Boolean) ?? [],
    [searchParams]
  )

  const [minPrice, setMinPrice] = useState(
    searchParams.get('min_price') ?? String(meta.priceMin)
  )
  const [maxPrice, setMaxPrice] = useState(
    searchParams.get('max_price') ?? String(meta.priceMax)
  )

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') params.delete(key)
        else params.set(key, value)
      }
      params.delete('page')
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  function setSort(sort: CollectionSort) {
    pushParams({ sort: sort === 'relevance' ? null : sort })
  }

  function toggleBrand(id: string) {
    const next = selectedBrands.includes(id)
      ? selectedBrands.filter((b) => b !== id)
      : [...selectedBrands, id]
    pushParams({ brands: next.length ? next.join(',') : null })
  }

  function toggleCategory(id: string) {
    const next = selectedCategories.includes(id)
      ? selectedCategories.filter((c) => c !== id)
      : [...selectedCategories, id]
    pushParams({ categories: next.length ? next.join(',') : null })
  }

  function applyPriceRange() {
    const min = Math.max(0, Number(minPrice) || 0)
    const max = Math.max(min, Number(maxPrice) || meta.priceMax)
    pushParams({
      min_price: min > meta.priceMin ? String(min) : null,
      max_price: max < meta.priceMax ? String(max) : null,
    })
  }

  function clearFilters() {
    setMinPrice(String(meta.priceMin))
    setMaxPrice(String(meta.priceMax))
    router.push(pathname, { scroll: false })
  }

  const hasActiveFilters =
    selectedBrands.length > 0 ||
    selectedCategories.length > 0 ||
    searchParams.has('min_price') ||
    searchParams.has('max_price') ||
    (searchParams.get('sort') && searchParams.get('sort') !== 'relevance')

  return (
    <aside className={`rounded-xl border border-border bg-surface p-4 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-logo">Filtrar</h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-medium text-brand hover:underline"
          >
            Limpar
          </button>
        )}
      </div>

      <div className="mb-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-logo">Ordenar por</p>
        <div className="grid grid-cols-3 gap-2">
          {SORT_OPTIONS.map((opt) => {
            const active = currentSort === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSort(opt.value)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-center text-[10px] font-medium leading-tight transition-colors ${
                  active
                    ? 'border-logo/30 bg-logo/10 text-logo'
                    : 'border-border bg-surface text-text-secondary hover:border-logo/20'
                }`}
                aria-pressed={active}
              >
                <span className="text-sm" aria-hidden>
                  {opt.icon}
                </span>
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <FilterSection title="Marca" defaultOpen>
        <CheckboxList items={meta.brands} selected={selectedBrands} onToggle={toggleBrand} />
      </FilterSection>

      {meta.categories.length > 0 && (
        <FilterSection title="Categoria">
          <CheckboxList
            items={meta.categories}
            selected={selectedCategories}
            onToggle={toggleCategory}
          />
        </FilterSection>
      )}

      <FilterSection title="Faixas de preço">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Mínimo"
              type="number"
              min={0}
              step="0.01"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
            <Input
              label="Máximo"
              type="number"
              min={0}
              step="0.01"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
          <p className="text-xs text-text-muted">
            De {formatCurrency(meta.priceMin)} até {formatCurrency(meta.priceMax)}
          </p>
          <Button type="button" className="w-full" onClick={applyPriceRange}>
            Buscar
          </Button>
        </div>
      </FilterSection>
    </aside>
  )
}

export function CollectionFiltersMobile({ meta }: { meta: CollectionFilterMeta }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="secondary" className="lg:hidden" onClick={() => setOpen(true)}>
        Filtrar e ordenar
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Filtrar produtos" size="md">
        <CollectionFilters meta={meta} className="border-0 p-0 shadow-none" />
      </Modal>
    </>
  )
}
