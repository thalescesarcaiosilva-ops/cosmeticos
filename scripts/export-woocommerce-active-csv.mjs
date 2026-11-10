/**
 * Exporta produtos ativos no formato CSV flat do WooCommerce Product Importer.
 * Uso: node --env-file=.env.local scripts/export-woocommerce-active-csv.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(1)
}

const supabaseUrl = url.replace(/\/$/, '')
const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const HEADERS = [
  'ID',
  'Type',
  'SKU',
  'Name',
  'Published',
  'Is featured?',
  'Visibility in catalog',
  'Short description',
  'Description',
  'Tax status',
  'In stock?',
  'Stock',
  'Backorders allowed?',
  'Sold individually?',
  'Allow customer reviews?',
  'Sale price',
  'Regular price',
  'Categories',
  'Tags',
  'Images',
  'Brands',
  'GTIN',
  'Meta: _global_unique_id',
  'Slug',
]

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function absoluteImageUrl(raw) {
  if (!raw) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/')) return `${supabaseUrl}${trimmed}`
  return `${supabaseUrl}/${trimmed}`
}

function formatPrice(value) {
  if (value == null || value === '') return ''
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  return n.toFixed(2)
}

function buildPriceFields(price, originalPrice) {
  const sale = Number(price)
  const regular = Number(originalPrice)
  const hasSale = Number.isFinite(sale) && sale > 0
  const hasRegular = Number.isFinite(regular) && regular > 0

  if (hasSale && hasRegular && regular > sale) {
    return { salePrice: formatPrice(sale), regularPrice: formatPrice(regular) }
  }
  if (hasSale) {
    return { salePrice: '', regularPrice: formatPrice(sale) }
  }
  if (hasRegular) {
    return { salePrice: '', regularPrice: formatPrice(regular) }
  }
  return { salePrice: '', regularPrice: '' }
}

async function fetchAllActiveProducts() {
  const pageSize = 500
  let from = 0
  const products = []

  for (;;) {
    const to = from + pageSize - 1
    const { data, error } = await admin
      .from('products')
      .select(
        `
        id,
        woocommerce_id,
        name,
        slug,
        sku,
        gtin,
        price,
        original_price,
        stock,
        short_description,
        description,
        brands ( name ),
        product_categories (
          categories ( name )
        ),
        product_images (
          sort_order,
          media:media_assets ( public_url )
        )
      `,
      )
      .eq('active', true)
      .is('parent_id', null)
      .order('name', { ascending: true })
      .range(from, to)

    if (error) throw new Error(error.message)
    if (!data?.length) break
    products.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return products
}

function mapRow(product) {
  const brandName = product.brands?.name ?? ''
  const categories = (product.product_categories ?? [])
    .map((pc) => pc.categories?.name)
    .filter(Boolean)
  const images = [...(product.product_images ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((pi) => absoluteImageUrl(pi.media?.public_url))
    .filter(Boolean)

  const { salePrice, regularPrice } = buildPriceFields(
    product.price,
    product.original_price,
  )
  const stock = Number.isFinite(Number(product.stock)) ? Math.max(0, Number(product.stock)) : 0
  const gtin = product.gtin ?? ''

  return [
    product.woocommerce_id ?? '',
    'simple',
    product.sku ?? '',
    product.name ?? '',
    1,
    0,
    'visible',
    product.short_description ?? '',
    product.description ?? '',
    'taxable',
    stock > 0 ? 1 : 0,
    stock,
    0,
    0,
    1,
    salePrice,
    regularPrice,
    categories.join(' | '),
    '',
    images.join(', '),
    brandName,
    gtin,
    gtin,
    product.slug ?? '',
  ]
}

const products = await fetchAllActiveProducts()
const lines = [
  HEADERS.join(','),
  ...products.map((p) => mapRow(p).map(csvEscape).join(',')),
]

const stamp = new Date().toISOString().slice(0, 10)
const outPath = path.resolve(`woocommerce-produtos-ativos-${stamp}.csv`)
fs.writeFileSync(outPath, `\uFEFF${lines.join('\n')}\n`, 'utf8')

const withImages = products.filter((p) => (p.product_images ?? []).length > 0).length
const withGtin = products.filter((p) => p.gtin).length
const withBrand = products.filter((p) => p.brands?.name).length

console.log(
  JSON.stringify(
    {
      total: products.length,
      withImages,
      withGtin,
      withBrand,
      outPath,
    },
    null,
    2,
  ),
)
