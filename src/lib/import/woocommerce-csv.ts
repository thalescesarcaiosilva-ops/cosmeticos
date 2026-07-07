import { parseCsv } from '@/lib/csv/parse-csv'

export type WooCommerceProductType = 'simple' | 'variable'

export type WooCommerceProductRow = {
  wooId: number
  name: string
  slug: string
  description: string | null
  shortDescription: string | null
  sku: string | null
  gtin: string | null
  price: number
  originalPrice: number | null
  stock: number
  active: boolean
  brandName: string | null
  categoryNames: string[]
  images: { url: string; alt: string }[]
  metaTitle: string | null
  metaDescription: string | null
  productType: WooCommerceProductType
  variationCount: number
}

const SIMPLE_TYPE = 'simple'
const VARIABLE_TYPE = 'variable'
const VARIATION_TYPE = 'variation'
const PUBLISH = 'publish'

/** Status considerados publicados (export WC em inglês ou português). */
const PUBLISHED_STATUSES = new Set([
  'publish',
  'published',
  'publicado',
  'publicada',
])

type RawWooRow = {
  wooId: number
  parentId: number | null
  type: string
  status: string
  name: string
  slug: string
  description: string | null
  shortDescription: string | null
  sku: string | null
  gtin: string | null
  salePriceRaw: string
  regularPriceRaw: string
  stockRaw: string
  stockStatusRaw: string
  brandName: string | null
  categoryNames: string[]
  images: { url: string; alt: string }[]
  metaTitle: string | null
  metaDescription: string | null
}

export function parseWooImageField(raw: string): { url: string; alt: string }[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  const segments = trimmed.split(/\s\|\s/)
  const results: { url: string; alt: string }[] = []

  for (const segment of segments) {
    const url = segment.split(/\s!\s*alt\s*:/i)[0]?.trim()
    if (!url || !/^https?:\/\//i.test(url)) continue

    const altMatch = segment.match(/!\s*alt\s*:\s*(.*?)\s*!\s*title/i)
    const alt = altMatch?.[1]?.trim() ?? ''
    results.push({ url, alt })
  }

  return results
}

/** Expande "Pai > Filho | Outra" em nomes únicos de categoria. */
export function parseWooCategories(raw: string): string[] {
  if (!raw.trim()) return []

  const names = new Set<string>()
  for (const segment of raw.split('|')) {
    for (const part of segment.split('>')) {
      const name = part.trim()
      if (name) names.add(name)
    }
  }

  return [...names]
}

function parsePrice(value: string): number | null {
  const n = parseFloat(value.replace(',', '.').trim())
  if (Number.isNaN(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

function parseStock(stockRaw: string, statusRaw: string): number {
  const parsed = parseInt(stockRaw.trim(), 10)
  if (!Number.isNaN(parsed) && parsed >= 0) return parsed
  return statusRaw.trim().toLowerCase() === 'outofstock' ? 0 : 99
}

function rowValue(row: string[], header: string[], column: string): string {
  const index = header.indexOf(column)
  if (index < 0) return ''
  return row[index] ?? ''
}

function normalizeProductType(raw: string): string {
  const type = raw.trim().toLowerCase()
  return type || SIMPLE_TYPE
}

function isPublished(status: string): boolean {
  const normalized = status.trim().toLowerCase()
  return !normalized || PUBLISHED_STATUSES.has(normalized)
}

function parseRawRow(row: string[], header: string[]): RawWooRow | null {
  const type = normalizeProductType(rowValue(row, header, 'tax:product_type'))
  if (type !== SIMPLE_TYPE && type !== VARIABLE_TYPE && type !== VARIATION_TYPE) return null

  const status = rowValue(row, header, 'post_status').trim().toLowerCase()
  if (!isPublished(status)) return null

  const name = rowValue(row, header, 'post_title').trim()
  const slug = rowValue(row, header, 'post_name').trim()
  if (!name || !slug) return null

  const wooId = parseInt(rowValue(row, header, 'ID').trim(), 10)
  if (Number.isNaN(wooId)) return null

  const parentRaw = rowValue(row, header, 'post_parent').trim()
  const parentId = parentRaw ? parseInt(parentRaw, 10) : null

  const brandName =
    rowValue(row, header, 'tax:pwb-brand').trim() ||
    rowValue(row, header, 'tax:product_brand').trim() ||
    rowValue(row, header, 'tax:product_brands').trim() ||
    rowValue(row, header, 'meta:_wt_feed_brand').trim() ||
    null

  const gtin =
    rowValue(row, header, 'meta:_wt_feed_gtin').trim() ||
    rowValue(row, header, 'meta:_global_unique_id').trim() ||
    null

  return {
    wooId,
    parentId: parentId != null && !Number.isNaN(parentId) && parentId > 0 ? parentId : null,
    type,
    status,
    name,
    slug,
    description: rowValue(row, header, 'post_content').trim() || null,
    shortDescription: rowValue(row, header, 'post_excerpt').trim() || null,
    sku: rowValue(row, header, 'sku').trim() || null,
    gtin: gtin || null,
    salePriceRaw: rowValue(row, header, 'sale_price'),
    regularPriceRaw: rowValue(row, header, 'regular_price'),
    stockRaw: rowValue(row, header, 'stock'),
    stockStatusRaw: rowValue(row, header, 'stock_status'),
    brandName,
    categoryNames: parseWooCategories(rowValue(row, header, 'tax:product_cat')),
    images: parseWooImageField(rowValue(row, header, 'images')),
    metaTitle: rowValue(row, header, 'meta:_yoast_wpseo_title').trim() || null,
    metaDescription: rowValue(row, header, 'meta:_yoast_wpseo_metadesc').trim() || null,
  }
}

function resolvePricing(
  raw: RawWooRow,
  variations: RawWooRow[]
): { price: number; originalPrice: number | null; stock: number } | null {
  const publishedVariations = variations.filter((v) => isPublished(v.status))

  if (raw.type === VARIABLE_TYPE && publishedVariations.length > 0) {
    let minPrice: number | null = null
    let minOriginal: number | null = null
    let totalStock = 0
    let hasStock = false

    for (const variation of publishedVariations) {
      const salePrice = parsePrice(variation.salePriceRaw)
      const regularPrice = parsePrice(variation.regularPriceRaw)
      const price = salePrice ?? regularPrice
      if (!price) continue

      if (minPrice === null || price < minPrice) {
        minPrice = price
        minOriginal =
          salePrice && regularPrice && regularPrice > salePrice ? regularPrice : null
      }

      totalStock += parseStock(variation.stockRaw, variation.stockStatusRaw)
      hasStock = true
    }

    if (minPrice !== null) {
      return {
        price: minPrice,
        originalPrice: minOriginal,
        stock: hasStock ? totalStock : 0,
      }
    }
  }

  const salePrice = parsePrice(raw.salePriceRaw)
  const regularPrice = parsePrice(raw.regularPriceRaw)
  const price = salePrice ?? regularPrice
  if (!price) return null

  return {
    price,
    originalPrice:
      salePrice && regularPrice && regularPrice > salePrice ? regularPrice : null,
    stock: parseStock(raw.stockRaw, raw.stockStatusRaw),
  }
}

function mergeMetadata(parent: RawWooRow, variations: RawWooRow[]): RawWooRow {
  if (variations.length === 0) return parent

  const published = variations.filter((v) => isPublished(v.status))
  const brandName =
    parent.brandName ??
    published.find((v) => v.brandName)?.brandName ??
    null

  const categoryNames =
    parent.categoryNames.length > 0
      ? parent.categoryNames
      : [...new Set(published.flatMap((v) => v.categoryNames))]

  const images =
    parent.images.length > 0 ? parent.images : published.find((v) => v.images.length > 0)?.images ?? []

  return {
    ...parent,
    brandName,
    categoryNames,
    images,
    description: parent.description ?? published.find((v) => v.description)?.description ?? null,
    shortDescription:
      parent.shortDescription ??
      published.find((v) => v.shortDescription)?.shortDescription ??
      null,
    metaTitle: parent.metaTitle ?? published.find((v) => v.metaTitle)?.metaTitle ?? null,
    metaDescription:
      parent.metaDescription ??
      published.find((v) => v.metaDescription)?.metaDescription ??
      null,
  }
}

function rawToProductRow(
  raw: RawWooRow,
  variations: RawWooRow[],
  productType: WooCommerceProductType
): WooCommerceProductRow | null {
  const merged = mergeMetadata(raw, variations)
  const pricing = resolvePricing(raw, variations)
  if (!pricing) return null

  return {
    wooId: merged.wooId,
    name: merged.name.slice(0, 200),
    slug: merged.slug.slice(0, 200),
    description: merged.description,
    shortDescription: merged.shortDescription,
    sku: merged.sku,
    gtin: merged.gtin,
    price: pricing.price,
    originalPrice: pricing.originalPrice,
    stock: pricing.stock,
    active: true,
    brandName: merged.brandName,
    categoryNames: merged.categoryNames,
    images: merged.images,
    metaTitle: merged.metaTitle,
    metaDescription: merged.metaDescription,
    productType,
    variationCount: variations.filter((v) => isPublished(v.status)).length,
  }
}

function buildVariationIndex(rawRows: RawWooRow[]): Map<number, RawWooRow[]> {
  const index = new Map<number, RawWooRow[]>()

  for (const row of rawRows) {
    if (row.type !== VARIATION_TYPE || !row.parentId) continue
    const list = index.get(row.parentId) ?? []
    list.push(row)
    index.set(row.parentId, list)
  }

  return index
}

function hasParentInCsv(rawRows: RawWooRow[], parentId: number | null): boolean {
  if (!parentId) return false
  return rawRows.some((row) => row.wooId === parentId && row.type === VARIABLE_TYPE)
}

export function parseWooCommerceCsv(text: string): WooCommerceProductRow[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []

  const header = rows[0]
  const rawRows: RawWooRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const mapped = parseRawRow(rows[i], header)
    if (mapped) rawRows.push(mapped)
  }

  const variationIndex = buildVariationIndex(rawRows)
  const products: WooCommerceProductRow[] = []

  for (const raw of rawRows) {
    if (raw.type === VARIATION_TYPE) {
      if (hasParentInCsv(rawRows, raw.parentId)) continue
      const orphan = rawToProductRow(raw, [], SIMPLE_TYPE)
      if (orphan) products.push(orphan)
      continue
    }

    if (raw.type !== SIMPLE_TYPE && raw.type !== VARIABLE_TYPE) continue

    const variations = raw.type === VARIABLE_TYPE ? variationIndex.get(raw.wooId) ?? [] : []
    const productType: WooCommerceProductType =
      raw.type === VARIABLE_TYPE ? VARIABLE_TYPE : SIMPLE_TYPE
    const mapped = rawToProductRow(raw, variations, productType)
    if (mapped) products.push(mapped)
  }

  return products
}

export function summarizeWooCommerceImport(rows: WooCommerceProductRow[]) {
  const categories = new Set<string>()
  const brands = new Set<string>()
  let withImages = 0
  let simple = 0
  let variable = 0

  for (const row of rows) {
    row.categoryNames.forEach((c) => categories.add(c))
    if (row.brandName) brands.add(row.brandName)
    if (row.images.length > 0) withImages++
    if (row.productType === 'variable') variable++
    else simple++
  }

  return {
    total: rows.length,
    simple,
    variable,
    categories: categories.size,
    brands: brands.size,
    withImages,
    categoryNames: [...categories].sort(),
    brandNames: [...brands].sort(),
  }
}
