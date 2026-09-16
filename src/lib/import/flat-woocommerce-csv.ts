import { parseCsv } from '@/lib/csv/parse-csv'
import { DEFAULT_PRODUCT_STOCK } from '@/lib/products/stock'
import { slugify } from '@/lib/products/format'
import type { WooCommerceProductRow } from '@/lib/import/woocommerce-csv'

const COMPETITOR_RE =
  /paguemenos|pague\s*menos|[ée]poca\s*cosm[eé]ticos|ultrafarma|belezanaweb|beleza\s*na\s*web|drogasil|droga\s*raia|panvel|karlacosmeticos/gi

const BRAND_ALIASES: Record<string, string> = {
  mantecorp: 'Mantecorp Skincare',
  'mantecorp skincare': 'Mantecorp Skincare',
  avene: 'Avène',
  avène: 'Avène',
  'avêne': 'Avène',
  cerave: 'Cerave',
  'cera ve': 'Cerave',
  wella: 'Wella',
  'wella professionals': 'Wella',
  "l'oréal paris": "L'Oréal",
  "l'oreal paris": "L'Oréal",
  "l'oréal": "L'Oréal",
  "l'oreal": "L'Oréal",
  "l'oréal professionnel": "L'Oréal Professionnel",
  "l'oreal professionnel": "L'Oréal Professionnel",
  'lola cosmetics': 'Lola From Rio',
  eudora: 'Eudora Niina Secrets',
  lancome: 'Lancôme',
  'lancôme': 'Lancôme',
  kerastase: 'Kérastase',
  'kérastase': 'Kérastase',
  biore: 'Bioré',
  'bioré': 'Bioré',
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function rowValue(row: string[], header: string[], column: string): string {
  const index = header.indexOf(column)
  if (index < 0) return ''
  return row[index] ?? ''
}

function parsePrice(value: string): number | null {
  const n = parseFloat(value.replace(',', '.').trim())
  if (Number.isNaN(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

function parseImages(raw: string): { url: string; alt: string }[] {
  if (!raw.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url) => ({ url, alt: '' }))
}

function sanitizeCompetitorMentions(text: string | null): string | null {
  if (!text) return null
  let cleaned = text
  cleaned = cleaned.replace(
    /https?:\/\/[^\s"'<>]*(paguemenos|ultrafarma|epocacosmeticos|belezanaweb|drogasil|panvel)[^\s"'<>]*/gi,
    ''
  )
  cleaned = cleaned.replace(COMPETITOR_RE, '')
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim()
  return cleaned || null
}

function mapBrand(raw: string | null): string | null {
  if (!raw) return null
  const decoded = decodeHtmlEntities(raw).trim()
  if (!decoded) return null
  const alias = BRAND_ALIASES[normalizeKey(decoded)]
  return alias ?? decoded.slice(0, 120)
}

/**
 * Mapeia categorias cruas do CSV para categorias da loja.
 * Cria apenas "Vitaminas e Suplementos"; Ofertas/Mamãe e Bebê são remapeadas.
 */
export function mapStoreCategory(rawCategories: string[], productName: string): string {
  const blob = `${rawCategories.join(' ')} ${productName}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (rawCategories.some((c) => /vitaminas|suplementos/i.test(c))) {
    return 'Vitaminas e Suplementos'
  }
  if (/(protetor solar|fps\s*\d|protecao solar|photoderm|anthelios|episol)/.test(blob)) {
    return 'Proteção Solar'
  }
  if (
    /(shampoo|condicionador|mascara capilar|cabelo|capilar|leave.?in|juba|oil reflections|fusion)/.test(
      blob
    )
  ) {
    return 'Cuidados Capilares'
  }
  if (
    /(base liquida|batom|mascara de cilios|rimel|blush|corretivo|maquiagem|gloss|bb cream)/.test(
      blob
    )
  ) {
    return 'Maquiagem'
  }
  if (/(perfume|eau de|edt\b|edp\b|colonia)/.test(blob)) {
    if (/feminin|mulher|woman/.test(blob)) return 'Perfumes Femininos'
    if (/masculin|homem|\bman\b/.test(blob)) return 'Perfumes Masculinos'
  }
  if (rawCategories.includes('Cuidados Capilares')) return 'Cuidados Capilares'
  if (rawCategories.includes('Protetor Solar')) return 'Proteção Solar'
  // Ofertas / Mamãe e Bebê / Higiene / Facial → dermocosméticos (sem criar categoria crua)
  return 'Dermocosméticos'
}

function syntheticWooId(key: string): number {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0
  }
  return 2_100_000_000 + Math.abs(hash)
}

function uniqueSlug(base: string, used: Set<string>, key: string): string {
  let slug = slugify(base).slice(0, 200)
  if (!used.has(slug)) {
    used.add(slug)
    return slug
  }
  const suffix = slugify(key).slice(-24) || String(syntheticWooId(key))
  const withKey = `${slug}-${suffix}`.slice(0, 200)
  used.add(withKey)
  return withKey
}

export type FlatWooImportOptions = {
  /** Mínimo de imagens na galeria (padrão 2). */
  minImages?: number
  /** Força estoque (padrão DEFAULT_PRODUCT_STOCK = 99). */
  stock?: number
  /** active=false para revisão (padrão true neste parser = false). */
  active?: boolean
}

/**
 * Parser do CSV flat (Type,SKU,Name,Published,...,Brands,GTIN).
 * Exige GTIN; exige minImages; sanitiza menções a concorrentes; stock 99; inactive.
 */
export function parseFlatWooCommerceCsv(
  text: string,
  options: FlatWooImportOptions = {}
): {
  products: WooCommerceProductRow[]
  skippedNoGtin: { sku: string; name: string }[]
  skippedFewImages: { sku: string; name: string; images: number }[]
  skippedNoPrice: { sku: string; name: string }[]
} {
  const rows = parseCsv(text)
  const minImages = options.minImages ?? 2
  const stock = options.stock ?? DEFAULT_PRODUCT_STOCK
  const active = options.active ?? false
  const usedSlugs = new Set<string>()

  const products: WooCommerceProductRow[] = []
  const skippedNoGtin: { sku: string; name: string }[] = []
  const skippedFewImages: { sku: string; name: string; images: number }[] = []
  const skippedNoPrice: { sku: string; name: string }[] = []

  if (rows.length < 2) {
    return { products, skippedNoGtin, skippedFewImages, skippedNoPrice }
  }

  const header = rows[0]

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const type = rowValue(row, header, 'Type').trim().toLowerCase()
    if (type && type !== 'simple') continue

    const name = decodeHtmlEntities(rowValue(row, header, 'Name')).trim()
    if (!name) continue

    const sku = rowValue(row, header, 'SKU').trim()
    const gtin =
      rowValue(row, header, 'GTIN').trim() ||
      rowValue(row, header, 'Meta: gtin').trim() ||
      rowValue(row, header, 'Meta: _alg_ean').trim() ||
      rowValue(row, header, 'Meta: _global_unique_id').trim() ||
      ''

    if (!gtin) {
      skippedNoGtin.push({ sku, name })
      continue
    }

    const images = parseImages(rowValue(row, header, 'Images'))
    if (images.length < minImages) {
      skippedFewImages.push({ sku, name, images: images.length })
      continue
    }

    const price = parsePrice(rowValue(row, header, 'Regular price'))
    if (!price) {
      skippedNoPrice.push({ sku, name })
      continue
    }

    const rawCategories = rowValue(row, header, 'Categories')
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean)
    const storeCategory = mapStoreCategory(rawCategories, name)
    const brandName = mapBrand(rowValue(row, header, 'Brands').trim() || null)

    const shortDescription = sanitizeCompetitorMentions(
      decodeHtmlEntities(rowValue(row, header, 'Short description')).trim() || null
    )
    const description = sanitizeCompetitorMentions(
      decodeHtmlEntities(rowValue(row, header, 'Description')).trim() || null
    )

    const key = gtin || sku || name
    products.push({
      wooId: syntheticWooId(key),
      name: name.slice(0, 200),
      slug: uniqueSlug(name, usedSlugs, key),
      description,
      shortDescription,
      sku: sku || null,
      gtin,
      price,
      originalPrice: null,
      stock,
      active,
      brandName,
      categoryNames: [storeCategory],
      images,
      metaTitle: null,
      metaDescription: null,
      productType: 'simple',
      variationCount: 0,
    })
  }

  return { products, skippedNoGtin, skippedFewImages, skippedNoPrice }
}
