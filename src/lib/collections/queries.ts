import {
  filterStorefrontCategories,
  isStorefrontCategoryHidden,
  isStorefrontCategoryNavHidden,
} from '@/lib/categories/storefront'
import { createPublicClient } from '@/lib/supabase/public'
import { toAbsoluteSiteMediaUrl, toSiteMediaUrl } from '@/lib/media/public-url'
import { mapProductCard, PRODUCT_SELECT } from '@/lib/products/queries'
import { attachReviewSummaries } from '@/lib/products/reviews'
import type { CollectionFiltersInput } from '@/schemas/category-schema'
import type {
  CollectionDetail,
  CollectionFilterMeta,
  CollectionProductsResult,
} from '@/types/collection'

const COLLECTION_COLUMNS_FULL =
  'id, name, slug, image_url, banner_image_url, page_title, description'

const COLLECTION_COLUMNS_LEGACY =
  'id, name, slug, image_url, banner_image_url, seal_image_url, page_title, description'

const COLLECTION_COLUMNS_BASE = 'id, name, slug, image_url'

const PAGE_SIZE = 24

type RelatedEntity = {
  id: string
  name: string
  slug: string
  active: boolean
}

function readRelatedEntity(value: unknown): RelatedEntity | null {
  const entity = Array.isArray(value) ? value[0] : value
  if (!entity || typeof entity !== 'object') return null

  const id = 'id' in entity && typeof entity.id === 'string' ? entity.id : null
  const name = 'name' in entity && typeof entity.name === 'string' ? entity.name : null
  const slug = 'slug' in entity && typeof entity.slug === 'string' ? entity.slug : null
  const active = 'active' in entity && typeof entity.active === 'boolean' ? entity.active : false

  if (!id || !name || !slug) return null
  return { id, name, slug, active }
}

function mapCollection(row: Record<string, unknown>): CollectionDetail {
  const imageUrl =
    (row.image_url as string | null) ??
    (row.seal_image_url as string | null) ??
    null

  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    pageTitle: (row.page_title as string | null) ?? (row.name as string),
    description: (row.description as string | null) ?? null,
    bannerImageUrl: toSiteMediaUrl((row.banner_image_url as string | null) ?? null),
    imageUrl: toSiteMediaUrl(imageUrl),
  }
}

export async function getCollectionBySlug(slug: string): Promise<CollectionDetail | null> {
  if (isStorefrontCategoryHidden(slug)) return null

  const supabase = createPublicClient()

  const full = await supabase
    .from('categories')
    .select(COLLECTION_COLUMNS_FULL)
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (!full.error && full.data) {
    return mapCollection(full.data as Record<string, unknown>)
  }

  const legacy = await supabase
    .from('categories')
    .select(COLLECTION_COLUMNS_LEGACY)
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (!legacy.error && legacy.data) {
    return mapCollection(legacy.data as Record<string, unknown>)
  }

  const base = await supabase
    .from('categories')
    .select(COLLECTION_COLUMNS_BASE)
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (base.error || !base.data) return null
  return mapCollection(base.data as Record<string, unknown>)
}

/**
 * Filtra a coleção no banco (join), sem mandar centenas de IDs na URL.
 * Listas grandes (Dermocosméticos, Cuidados Capilares) estouram o limite
 * do request e a API responde Bad Request — a vitrine ficava vazia.
 */
function collectionSelect(select: string, extraCategoryIds: string[]): string {
  const extra =
    extraCategoryIds.length > 0
      ? ', filter_link:product_categories!inner(category_id)'
      : ''
  return `${select}, collection_link:product_categories!inner(category_id)${extra}`
}

export async function getCollectionProducts(
  categoryId: string,
  filters: CollectionFiltersInput
): Promise<CollectionProductsResult> {
  const supabase = createPublicClient()
  const page = filters.page ?? 1
  const extraCategoryIds = filters.categories ?? []
  const brandIds = filters.brands ?? []

  let query = supabase
    .from('products')
    .select(collectionSelect(PRODUCT_SELECT, extraCategoryIds), { count: 'exact' })
    .eq('collection_link.category_id', categoryId)
    .eq('active', true)

  if (extraCategoryIds.length > 0) {
    query = query.in('filter_link.category_id', extraCategoryIds)
  }
  if (brandIds.length > 0) {
    query = query.in('brand_id', brandIds)
  }

  if (filters.min_price != null) {
    query = query.gte('price', filters.min_price)
  }
  if (filters.max_price != null) {
    query = query.lte('price', filters.max_price)
  }

  switch (filters.sort ?? 'relevance') {
    case 'price_asc':
      query = query.order('price', { ascending: true })
      break
    case 'price_desc':
      query = query.order('price', { ascending: false })
      break
    case 'name_asc':
      query = query.order('name', { ascending: true })
      break
    case 'name_desc':
      query = query.order('name', { ascending: false })
      break
    case 'newest':
      query = query.order('created_at', { ascending: false })
      break
    case 'discount':
      query = query.order('original_price', { ascending: false, nullsFirst: false })
      break
    default:
      query = query.order('name', { ascending: true })
      break
  }

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error || !data) {
    return { products: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false }
  }

  const total = count ?? 0
  return {
    products: await attachReviewSummaries(
      data.map((row) => mapProductCard(row as unknown as Record<string, unknown>))
    ),
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: total > page * PAGE_SIZE,
  }
}

const META_PAGE = 500

/** Lê o catálogo da coleção em páginas curtas, sem lista de IDs na URL. */
async function loadCollectionMetaRows(categoryId: string) {
  const supabase = createPublicClient()
  const rows: Array<{
    price: number | string
    brand: unknown
    product_categories: Array<{ category_id: string; categories: unknown }> | null
  }> = []

  for (let from = 0; ; from += META_PAGE) {
    const { data, error } = await supabase
      .from('products')
      .select(
        `price, brand:brands(id, name, slug, active),
         product_categories(category_id, categories(id, name, slug, active)),
         collection_link:product_categories!inner(category_id)`
      )
      .eq('collection_link.category_id', categoryId)
      .eq('active', true)
      .order('id', { ascending: true })
      .range(from, from + META_PAGE - 1)

    if (error || !data?.length) break
    rows.push(...data)
    if (data.length < META_PAGE) break
  }

  return rows
}

export async function getCollectionFilterMeta(categoryId: string): Promise<CollectionFilterMeta> {
  const rows = await loadCollectionMetaRows(categoryId)

  if (rows.length === 0) {
    return {
      brands: [],
      categories: [],
      priceMin: 0,
      priceMax: 0,
      totalProducts: 0,
    }
  }

  const prices = rows.map((p) => Number(p.price))
  const priceMin = Math.min(...prices)
  const priceMax = Math.max(...prices)

  const brandCounts = new Map<string, { id: string; name: string; slug: string; count: number }>()
  const categoryCounts = new Map<string, { id: string; name: string; slug: string; count: number }>()

  for (const row of rows) {
    const brand = readRelatedEntity(row.brand)
    if (brand?.active) {
      const existing = brandCounts.get(brand.id)
      if (existing) existing.count += 1
      else brandCounts.set(brand.id, { id: brand.id, name: brand.name, slug: brand.slug, count: 1 })
    }

    for (const link of row.product_categories ?? []) {
      if (link.category_id === categoryId) continue
      const cat = readRelatedEntity(link.categories)
      if (!cat?.active || isStorefrontCategoryNavHidden(cat.slug)) continue
      const existing = categoryCounts.get(cat.id)
      if (existing) existing.count += 1
      else categoryCounts.set(cat.id, { id: cat.id, name: cat.name, slug: cat.slug, count: 1 })
    }
  }

  return {
    brands: [...brandCounts.values()].sort((a, b) => a.name.localeCompare(b.name)),
    categories: [...categoryCounts.values()].sort((a, b) => a.name.localeCompare(b.name)),
    priceMin,
    priceMax,
    totalProducts: rows.length,
  }
}

export type CollectionCarouselItem = {
  id: string
  name: string
  slug: string
  imageUrl: string | null
}

export type CollectionsForCarouselOptions = {
  slugs?: string[]
}

function isRootCategoryRow(row: Record<string, unknown>): boolean {
  return row.parent_id == null || row.parent_id === ''
}

function mapCollectionCarouselRow(row: Record<string, unknown>): CollectionCarouselItem {
  const raw =
    (row.image_url as string | null) ??
    (row.seal_image_url as string | null | undefined) ??
    null
  // URL absoluta (Supabase) evita falha do /_next/image via rewrite em carrosséis
  const imageUrl = toAbsoluteSiteMediaUrl(raw) ?? toSiteMediaUrl(raw)

  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    imageUrl,
  }
}

function filterCollectionsBySlugs(
  items: CollectionCarouselItem[],
  slugs?: string[]
): CollectionCarouselItem[] {
  const visible = filterStorefrontCategories(items)

  if (!slugs?.length) return visible

  const allowed = new Set(slugs)
  const order = new Map(slugs.map((slug, index) => [slug, index]))

  return visible
    .filter((item) => allowed.has(item.slug))
    .sort((a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999))
}

/** Lista pública de coleções com selo (home e carrosséis). */
export async function getCollectionsForCarousel(
  options?: CollectionsForCarouselOptions
): Promise<CollectionCarouselItem[]> {
  const supabase = createPublicClient()
  const full = await supabase
    .from('categories')
    .select('id, name, slug, image_url, sort_order, parent_id')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (!full.error && full.data) {
    return filterCollectionsBySlugs(
      full.data
        .filter((row) => isRootCategoryRow(row as Record<string, unknown>))
        .map((row) => mapCollectionCarouselRow(row as Record<string, unknown>)),
      options?.slugs
    )
  }

  const legacy = await supabase
    .from('categories')
    .select('id, name, slug, seal_image_url, image_url, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  return filterCollectionsBySlugs(
    (legacy.data ?? []).map((row) => mapCollectionCarouselRow(row as Record<string, unknown>)),
    options?.slugs
  )
}
