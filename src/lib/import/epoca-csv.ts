import { parseCsv } from '@/lib/csv/parse-csv'
import { DEFAULT_PRODUCT_STOCK } from '@/lib/products/stock'
import { slugify } from '@/lib/products/format'
import type { WooCommerceProductRow } from '@/lib/import/woocommerce-csv'

const PT_COLUMNS = {
  id: 'ID',
  tipo: 'Tipo',
  sku: 'SKU',
  gtin: 'GTIN, UPC, EAN, or ISBN',
  nome: 'Nome',
  publicado: 'Publicado',
  descCurta: 'Descrição curta',
  descricao: 'Descrição',
  emEstoque: 'Em estoque?',
  estoque: 'Estoque',
  precoPromo: 'Preço promocional',
  preco: 'Preço',
  categorias: 'Categorias',
  imagens: 'Imagens',
  ascendente: 'Ascendente',
  tags: 'Tags',
} as const

const EN_COLUMNS = {
  id: 'ID',
  tipo: 'tax:product_type',
  nome: 'post_title',
  slug: 'post_name',
  publicado: 'post_status',
  descCurta: 'post_excerpt',
  descricao: 'post_content',
  sku: 'sku',
  gtin: 'meta:_wt_feed_gtin',
  precoPromo: 'sale_price',
  preco: 'regular_price',
  estoque: 'stock',
  emEstoque: 'stock_status',
  categorias: 'tax:product_cat',
  imagens: 'images',
  ascendente: 'post_parent',
} as const

const PUBLISHED_VALUES = new Set(['1', 'publish', 'published', 'publicado', 'publicada', ''])

const KNOWN_BRANDS = [
  'Lancôme', 'Lancome', 'Giorgio Armani', 'Carolina Herrera', 'Paco Rabanne',
  'Dolce & Gabbana', 'Dolce e Gabbana', 'Givenchy', 'Burberry', 'Montblanc',
  'Cacharel', 'Azzaro', 'Tommy Hilfiger', 'Antonio Banderas', 'Emporio Armani',
  'Versace', 'Chanel', 'Dior', 'Yves Saint Laurent', 'YSL', 'Prada',
  'Hermès', 'Hermes', 'Gucci', 'Bvlgari', 'Calvin Klein', 'Hugo Boss',
  'Jean Paul Gaultier', 'Kenzo', 'Mugler', 'Thierry Mugler', 'Rabanne',
  'Natura', 'O Boticário', 'Avon', "Victoria's Secret", "L'Oréal", "L'Oreal",
  "L'Occitane", 'Clinique', 'Estée Lauder', 'MAC', 'Nyx', 'Maybelline',
  'La Roche-Posay', 'Vichy', 'Avène', 'Avene', 'Bioderma', 'Eucerin',
  'Cerave', 'CeraVe', 'Neutrogena', 'Nivea', 'Senscience', 'Kérastase',
  'Kerastase', 'Redken', 'Wella', 'Schwarzkopf', 'L\'Oréal Professionnel',
  'Biotherm', 'Shiseido', 'Clarins', 'Filorga', 'Payot', 'Isdin', 'ISDIN',
  'Sensai', 'Truss', 'Joico', 'Moroccanoil', 'Olaplex', 'Tigi', 'TIGI',
]

function rowValue(row: string[], header: string[], column: string): string {
  const index = header.indexOf(column)
  if (index < 0) return ''
  return row[index] ?? ''
}

function detectFormat(header: string[]): 'pt' | 'en' {
  if (header.includes(PT_COLUMNS.nome)) return 'pt'
  return 'en'
}

function parsePrice(value: string): number | null {
  const n = parseFloat(value.replace(',', '.').trim())
  if (Number.isNaN(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

function parseStock(stockRaw: string, statusRaw: string): number {
  const parsed = parseInt(stockRaw.trim(), 10)
  if (!Number.isNaN(parsed) && parsed >= 0) return parsed
  const status = statusRaw.trim().toLowerCase()
  if (status === '0' || status === 'outofstock') return 0
  return DEFAULT_PRODUCT_STOCK
}

function parsePtCategories(raw: string): string[] {
  if (!raw.trim()) return []
  return raw
    .split('|')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function parsePtImages(raw: string): { url: string; alt: string }[] {
  if (!raw.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url) => ({ url, alt: '' }))
}

export function extractBrandFromName(name: string): string | null {
  const lower = name.toLowerCase()
  for (const brand of KNOWN_BRANDS) {
    if (lower.includes(brand.toLowerCase())) {
      return brand
        .replace('Lancome', 'Lancôme')
        .replace("L'Oreal", "L'Oréal")
        .replace('Avene', 'Avène')
    }
  }
  return null
}

function isPublished(status: string): boolean {
  return PUBLISHED_VALUES.has(status.trim().toLowerCase())
}

function uniqueSlug(base: string, used: Set<string>, wooId: number): string {
  let slug = slugify(base).slice(0, 200)
  if (!used.has(slug)) {
    used.add(slug)
    return slug
  }
  const withId = `${slug}-${wooId}`.slice(0, 200)
  used.add(withId)
  return withId
}

export type EpocaImportOptions = {
  minPrice?: number
}

export function parseEpocaWooCommerceCsv(
  text: string,
  options: EpocaImportOptions = {}
): WooCommerceProductRow[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []

  const header = rows[0]
  const format = detectFormat(header)
  const cols = format === 'pt' ? PT_COLUMNS : EN_COLUMNS
  const minPrice = options.minPrice ?? 0
  const usedSlugs = new Set<string>()
  const products: WooCommerceProductRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const tipo = rowValue(row, header, cols.tipo).trim().toLowerCase()
    if (tipo !== 'simple' && tipo !== 'variable') continue

    const status = rowValue(row, header, cols.publicado)
    if (!isPublished(status)) continue

    const name = rowValue(row, header, cols.nome).trim()
    if (!name) continue

    const wooIdRaw = rowValue(row, header, cols.id).trim()
    const wooId = wooIdRaw ? parseInt(wooIdRaw, 10) : i
    if (Number.isNaN(wooId)) continue

    const slug =
      format === 'en'
        ? rowValue(row, header, 'post_name').trim() || uniqueSlug(name, usedSlugs, wooId)
        : uniqueSlug(name, usedSlugs, wooId)

    const salePrice = parsePrice(rowValue(row, header, cols.precoPromo))
    const regularPrice = parsePrice(rowValue(row, header, cols.preco))
    const price = salePrice ?? regularPrice
    if (!price || price <= minPrice) continue

    const categoryNames =
      format === 'pt'
        ? parsePtCategories(rowValue(row, header, cols.categorias))
        : parsePtCategories(rowValue(row, header, cols.categorias).replace(/>/g, ','))

    const images =
      format === 'pt'
        ? parsePtImages(rowValue(row, header, cols.imagens))
        : parsePtImages(rowValue(row, header, cols.imagens).replace(/\s\|\s/g, ','))

    const brandFromTags =
      format === 'pt' ? rowValue(row, header, PT_COLUMNS.tags).trim() || null : null
    const brandName = extractBrandFromName(name) ?? brandFromTags

    products.push({
      wooId,
      name: name.slice(0, 200),
      slug,
      description: rowValue(row, header, cols.descricao).trim() || null,
      shortDescription: rowValue(row, header, cols.descCurta).trim() || null,
      sku: null,
      gtin: rowValue(row, header, cols.gtin).trim() || null,
      price,
      originalPrice:
        salePrice && regularPrice && regularPrice > salePrice ? regularPrice : null,
      stock: parseStock(rowValue(row, header, cols.estoque), rowValue(row, header, cols.emEstoque)),
      active: true,
      brandName,
      categoryNames,
      images,
      metaTitle: null,
      metaDescription: null,
      productType: tipo === 'variable' ? 'variable' : 'simple',
      variationCount: 0,
    })
  }

  return products
}
