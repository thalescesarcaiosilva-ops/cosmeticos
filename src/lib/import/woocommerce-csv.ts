import { parseCsv } from '@/lib/csv/parse-csv'

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
}

const SIMPLE_TYPE = 'simple'
const PUBLISH = 'publish'

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

export function parseWooCategories(raw: string): string[] {
  if (!raw.trim()) return []
  return [...new Set(raw.split('|').map((c) => c.trim()).filter(Boolean))]
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

function mapRow(row: string[], header: string[]): WooCommerceProductRow | null {
  const type = rowValue(row, header, 'tax:product_type').trim().toLowerCase()
  if (type && type !== SIMPLE_TYPE) return null

  const status = rowValue(row, header, 'post_status').trim().toLowerCase()
  if (status && status !== PUBLISH) return null

  const name = rowValue(row, header, 'post_title').trim()
  const slug = rowValue(row, header, 'post_name').trim()
  if (!name || !slug) return null

  const wooId = parseInt(rowValue(row, header, 'ID').trim(), 10)
  if (Number.isNaN(wooId)) return null

  const salePrice = parsePrice(rowValue(row, header, 'sale_price'))
  const regularPrice = parsePrice(rowValue(row, header, 'regular_price'))
  const price = salePrice ?? regularPrice
  if (!price) return null

  const brandName =
    rowValue(row, header, 'tax:pwb-brand').trim() ||
    rowValue(row, header, 'tax:product_brand').trim() ||
    null

  const gtin =
    rowValue(row, header, 'meta:_wt_feed_gtin').trim() ||
    rowValue(row, header, 'meta:_global_unique_id').trim() ||
    null

  return {
    wooId,
    name: name.slice(0, 200),
    slug: slug.slice(0, 200),
    description: rowValue(row, header, 'post_content').trim() || null,
    shortDescription: rowValue(row, header, 'post_excerpt').trim() || null,
    sku: rowValue(row, header, 'sku').trim() || null,
    gtin: gtin || null,
    price,
    originalPrice: salePrice && regularPrice && regularPrice > salePrice ? regularPrice : null,
    stock: parseStock(rowValue(row, header, 'stock'), rowValue(row, header, 'stock_status')),
    active: true,
    brandName,
    categoryNames: parseWooCategories(rowValue(row, header, 'tax:product_cat')),
    images: parseWooImageField(rowValue(row, header, 'images')),
    metaTitle: rowValue(row, header, 'meta:_yoast_wpseo_title').trim() || null,
    metaDescription: rowValue(row, header, 'meta:_yoast_wpseo_metadesc').trim() || null,
  }
}

export function parseWooCommerceCsv(text: string): WooCommerceProductRow[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []

  const header = rows[0]
  const products: WooCommerceProductRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const mapped = mapRow(rows[i], header)
    if (mapped) products.push(mapped)
  }

  return products
}

export function summarizeWooCommerceImport(rows: WooCommerceProductRow[]) {
  const categories = new Set<string>()
  const brands = new Set<string>()
  let withImages = 0

  for (const row of rows) {
    row.categoryNames.forEach((c) => categories.add(c))
    if (row.brandName) brands.add(row.brandName)
    if (row.images.length > 0) withImages++
  }

  return {
    total: rows.length,
    categories: categories.size,
    brands: brands.size,
    withImages,
    categoryNames: [...categories].sort(),
    brandNames: [...brands].sort(),
  }
}
