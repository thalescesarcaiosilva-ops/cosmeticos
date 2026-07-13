import {
  filterStorefrontCategories,
  isStorefrontCategoryHidden,
} from '@/lib/categories/storefront'
import { createPublicClient } from '@/lib/supabase/public'
import { toSiteMediaUrl } from '@/lib/media/public-url'
import { mapProductCard, PRODUCT_SELECT } from '@/lib/products/queries'
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

async function getCollectionProductIds(categoryId: string): Promise<string[]> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('product_categories')
    .select('product_id')
    .eq('category_id', categoryId)

  return [...new Set((data ?? []).map((r) => r.product_id))]
}

function intersectIds(base: string[], filter: string[]): string[] {
  if (filter.length === 0) return base
  const set = new Set(filter)
  return base.filter((id) => set.has(id))
}

async function filterByBrands(productIds: string[], brandIds: string[]): Promise<string[]> {
  if (brandIds.length === 0 || productIds.length === 0) return productIds

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('products')
    .select('id')
    .in('id', productIds)
    .in('brand_id', brandIds)
    .eq('active', true)

  return (data ?? []).map((r) => r.id)
}

async function filterByCategories(
  productIds: string[],
  categoryIds: string[]
): Promise<string[]> {
  if (categoryIds.length === 0 || productIds.length === 0) return productIds

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('product_categories')
    .select('product_id')
    .in('product_id', productIds)
    .in('category_id', categoryIds)

  return [...new Set((data ?? []).map((r) => r.product_id))]
}

export async function getCollectionProducts(
  categoryId: string,
  filters: CollectionFiltersInput
): Promise<CollectionProductsResult> {
  const supabase = createPublicClient()
  const page = filters.page ?? 1

  let productIds = await getCollectionProductIds(categoryId)
  productIds = await filterByBrands(productIds, filters.brands ?? [])
  productIds = await filterByCategories(productIds, filters.categories ?? [])

  if (productIds.length === 0) {
    return { products: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false }
  }

  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT, { count: 'exact' })
    .in('id', productIds)
    .eq('active', true)

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
    products: data.map((row) => mapProductCard(row as Record<string, unknown>)),
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: total > page * PAGE_SIZE,
  }
}

export async function getCollectionFilterMeta(categoryId: string): Promise<CollectionFilterMeta> {
  const supabase = createPublicClient()
  const productIds = await getCollectionProductIds(categoryId)

  if (productIds.length === 0) {
    return {
      brands: [],
      categories: [],
      priceMin: 0,
      priceMax: 0,
      totalProducts: 0,
    }
  }

  const { data: products } = await supabase
    .from('products')
    .select('id, price, brand_id, brand:brands(id, name, slug, active)')
    .in('id', productIds)
    .eq('active', true)

  const rows = products ?? []
  const prices = rows.map((p) => Number(p.price))
  const priceMin = prices.length ? Math.min(...prices) : 0
  const priceMax = prices.length ? Math.max(...prices) : 0

  const brandCounts = new Map<string, { id: string; name: string; slug: string; count: number }>()
  for (const row of rows) {
    const brand = readRelatedEntity(row.brand)
    if (!brand?.active) continue
    const existing = brandCounts.get(brand.id)
    if (existing) existing.count += 1
    else brandCounts.set(brand.id, { id: brand.id, name: brand.name, slug: brand.slug, count: 1 })
  }

  const { data: catLinks } = await supabase
    .from('product_categories')
    .select('category_id, categories(id, name, slug, active)')
    .in('product_id', productIds)
    .neq('category_id', categoryId)

  const categoryCounts = new Map<string, { id: string; name: string; slug: string; count: number }>()
  for (const link of catLinks ?? []) {
    const cat = readRelatedEntity(link.categories)
    if (!cat?.active || isStorefrontCategoryHidden(cat.slug)) continue
    const existing = categoryCounts.get(cat.id)
    if (existing) existing.count += 1
    else categoryCounts.set(cat.id, { id: cat.id, name: cat.name, slug: cat.slug, count: 1 })
  }

  return {
    brands: [...brandCounts.values()].sort((a, b) => a.name.localeCompare(b.name)),
    categories: [...categoryCounts.values()].sort((a, b) => a.name.localeCompare(b.name)),
    priceMin,
    priceMax,
    totalProducts: productIds.length,
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

function mapCollectionCarouselRow(row: Record<string, unknown>): CollectionCarouselItem {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    imageUrl:
      toSiteMediaUrl(
        (row.image_url as string | null) ??
          (row.seal_image_url as string | null | undefined) ??
          null
      ),
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
    .select('id, name, slug, image_url, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (!full.error && full.data) {
    return filterCollectionsBySlugs(
      full.data.map((row) => mapCollectionCarouselRow(row as Record<string, unknown>)),
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
