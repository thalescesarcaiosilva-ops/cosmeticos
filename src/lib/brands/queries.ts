import { isStorefrontCategoryHidden } from '@/lib/categories/storefront'
import { createPublicClient } from '@/lib/supabase/public'
import { mapProductCard, PRODUCT_SELECT } from '@/lib/products/queries'
import type { CollectionFiltersInput } from '@/schemas/category-schema'
import type { CollectionFilterMeta, CollectionProductsResult } from '@/types/collection'
import type { Brand } from '@/types/product'

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

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('brands')
    .select('id, name, slug, active')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (error || !data) return null
  return data as Brand
}

async function getBrandProductIds(brandId: string): Promise<string[]> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('products')
    .select('id')
    .eq('brand_id', brandId)
    .eq('active', true)

  return (data ?? []).map((r) => r.id as string)
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

  return [...new Set((data ?? []).map((r) => r.product_id as string))]
}

export async function getBrandProducts(
  brandId: string,
  filters: CollectionFiltersInput = { sort: 'relevance', brands: [], categories: [], page: 1 }
): Promise<CollectionProductsResult> {
  const supabase = createPublicClient()
  const page = filters.page ?? 1

  let productIds = await getBrandProductIds(brandId)
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

export async function getBrandFilterMeta(brandId: string): Promise<CollectionFilterMeta> {
  const supabase = createPublicClient()
  const productIds = await getBrandProductIds(brandId)

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
    .select('id, price')
    .in('id', productIds)
    .eq('active', true)

  const rows = products ?? []
  const prices = rows.map((p) => Number(p.price))
  const priceMin = prices.length ? Math.min(...prices) : 0
  const priceMax = prices.length ? Math.max(...prices) : 0

  const { data: catLinks } = await supabase
    .from('product_categories')
    .select('category_id, categories(id, name, slug, active)')
    .in('product_id', productIds)

  const categoryCounts = new Map<string, { id: string; name: string; slug: string; count: number }>()
  for (const link of catLinks ?? []) {
    const cat = readRelatedEntity(link.categories)
    if (!cat?.active || isStorefrontCategoryHidden(cat.slug)) continue
    const existing = categoryCounts.get(cat.id)
    if (existing) existing.count += 1
    else categoryCounts.set(cat.id, { id: cat.id, name: cat.name, slug: cat.slug, count: 1 })
  }

  return {
    brands: [],
    categories: [...categoryCounts.values()].sort((a, b) => a.name.localeCompare(b.name)),
    priceMin,
    priceMax,
    totalProducts: productIds.length,
  }
}
