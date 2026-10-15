import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = 'd:/lojadecosmeticosnova'
const CSV_PATH = path.join(ROOT, 'todos os produtos farmácia.csv')

function parseCSV(input) {
  const rows = []
  let row = []
  let cur = ''
  let q = false
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (q) {
      if (c === '"' && input[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') {
      row.push(cur)
      cur = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
    } else cur += c
  }
  if (cur || row.length) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}

function csvEscape(value) {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function normalizeKey(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeProductName(s) {
  let n = normalizeKey(s)
  n = n.replace(/\b(eau de parfum|eau de toilette|edp|edt|refil|refill)\b/g, ' ')
  n = n.replace(/\b\d+\s*(ml|g|kg|un|und|caps|comp|sache|saches)\b/g, ' ')
  n = n.replace(/\s+/g, ' ').trim()
  return n
}

function parsePrice(value) {
  const n = parseFloat(String(value || '').replace(',', '.').trim())
  if (Number.isNaN(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

function parseWooCategories(raw) {
  if (!raw) return []
  return raw
    .split('|')
    .flatMap((part) => part.split('>'))
    .map((c) => c.trim())
    .filter(Boolean)
}

function isPerfume(row, idx) {
  const title = (row[idx('post_title')] || '').toLowerCase()
  const cat = (row[idx('tax:product_cat')] || '').toLowerCase()
  if (
    /\b(perfume|parfum|eau de parfum|eau de toilette|fragr[aâ]ncia|col[oô]nia)\b/.test(
      title,
    )
  )
    return true
  if (/\bperfum/.test(cat)) return true
  return false
}

function isVitaminsCategory(cats) {
  const joined = cats.join(' ').toLowerCase()
  return /vitamin|suplement/.test(joined)
}

function tokenSetRatio(a, b) {
  const ta = new Set(a.split(' ').filter((t) => t.length > 1))
  const tb = new Set(b.split(' ').filter((t) => t.length > 1))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / Math.max(ta.size, tb.size)
}

const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const url = env.match(/SUPABASE_URL=(.+)/)?.[1]?.trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()
const sb = createClient(url, key)

// --- load store products ---
const storeProducts = []
let from = 0
while (true) {
  const { data, error } = await sb
    .from('products')
    .select('id, woocommerce_id, slug, sku, gtin, name, price, original_price, active')
    .range(from, from + 999)
  if (error) throw error
  if (!data?.length) break
  storeProducts.push(...data)
  if (data.length < 1000) break
  from += 1000
}

const activeStore = storeProducts.filter((p) => p.active)
const allByWoo = new Map()
const allBySku = new Map()
const allByGtin = new Map()
const allBySlug = new Map()
const allNormNames = []
const activeByWoo = new Map()
const activeBySku = new Map()
const activeByGtin = new Map()
const activeBySlug = new Map()
const activeNormNames = []

function indexProduct(p, maps) {
  if (p.woocommerce_id) maps.byWoo.set(Number(p.woocommerce_id), p)
  if (p.sku) maps.bySku.set(normalizeKey(p.sku), p)
  if (p.gtin) maps.byGtin.set(normalizeKey(p.gtin), p)
  if (p.slug) maps.bySlug.set(normalizeKey(p.slug), p)
  const nn = normalizeProductName(p.name)
  if (nn) maps.normNames.push({ nn, p })
}

for (const p of storeProducts) {
  indexProduct(p, {
    byWoo: allByWoo,
    bySku: allBySku,
    byGtin: allByGtin,
    bySlug: allBySlug,
    normNames: allNormNames,
  })
}
for (const p of activeStore) {
  indexProduct(p, {
    byWoo: activeByWoo,
    bySku: activeBySku,
    byGtin: activeByGtin,
    bySlug: activeBySlug,
    normNames: activeNormNames,
  })
}

function findInMaps(csvRow, idx, maps) {
  const wooId = Number(csvRow[idx('ID')])
  if (wooId && maps.byWoo.has(wooId)) return maps.byWoo.get(wooId)
  const sku = normalizeKey(csvRow[idx('sku')])
  if (sku && maps.bySku.has(sku)) return maps.bySku.get(sku)
  const gtin = normalizeKey(
    csvRow[idx('meta:_wt_feed_gtin')] || csvRow[idx('meta:_global_unique_id')] || '',
  )
  if (gtin && maps.byGtin.has(gtin)) return maps.byGtin.get(gtin)
  const slug = normalizeKey(csvRow[idx('post_name')])
  if (slug && maps.bySlug.has(slug)) return maps.bySlug.get(slug)
  const csvName = normalizeProductName(csvRow[idx('post_title')])
  if (csvName) {
    for (const { nn, p } of maps.normNames) {
      if (nn === csvName) return p
    }
    let best = null
    let bestScore = 0
    for (const { nn, p } of maps.normNames) {
      const score = tokenSetRatio(csvName, nn)
      if (score > bestScore) {
        bestScore = score
        best = p
      }
    }
    if (best && bestScore >= 0.92) return best
  }
  return null
}

const text = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '')
const rows = parseCSV(text)
const hdr = rows[0].map((h) => h.replace(/^\uFEFF/, ''))
const idx = (n) => hdr.indexOf(n)
const data = rows.slice(1).filter((r) => r.length > 1 && r[idx('post_title')])

const activeMaps = {
  byWoo: activeByWoo,
  bySku: activeBySku,
  byGtin: activeByGtin,
  bySlug: activeBySlug,
  normNames: activeNormNames,
}
const allMaps = {
  byWoo: allByWoo,
  bySku: allBySku,
  byGtin: allByGtin,
  bySlug: allBySlug,
  normNames: allNormNames,
}

// --- 1) update prices where store > csv ---
const priceUpdates = []
const EPS = 0.009

for (const r of data) {
  const status = (r[idx('post_status')] || '').toLowerCase()
  if (status && !['publish', 'published', 'publicado', 'publicada'].includes(status)) continue
  if (isPerfume(r, idx)) continue

  const store = findInMaps(r, idx, activeMaps)
  if (!store) continue

  const sale = parsePrice(r[idx('sale_price')])
  const regular = parsePrice(r[idx('regular_price')])
  const csvPrice = sale ?? regular
  if (csvPrice == null) continue

  const storePrice = Number(store.price)
  if (!(storePrice > csvPrice + EPS)) continue

  const original_price =
    sale && regular && regular > sale
      ? regular
      : regular && regular > csvPrice
        ? regular
        : null

  priceUpdates.push({
    id: store.id,
    name: store.name,
    slug: store.slug,
    oldPrice: storePrice,
    oldOriginal: store.original_price != null ? Number(store.original_price) : null,
    newPrice: csvPrice,
    newOriginal: original_price,
  })
}

const updateResults = []
for (const u of priceUpdates) {
  const payload = {
    price: u.newPrice,
    original_price: u.newOriginal,
    updated_at: new Date().toISOString(),
  }
  const { error } = await sb.from('products').update(payload).eq('id', u.id)
  updateResults.push({
    ...u,
    ok: !error,
    error: error?.message || null,
  })
  if (error) console.error('FAIL', u.slug, error.message)
}

fs.writeFileSync(
  path.join(ROOT, 'tmp-price-update-results.json'),
  JSON.stringify(
    {
      attempted: priceUpdates.length,
      ok: updateResults.filter((r) => r.ok).length,
      failed: updateResults.filter((r) => !r.ok).length,
      updates: updateResults,
    },
    null,
    2,
  ),
)

// --- 2) export missing products CSV (no vitamins/supplements, no perfumes) ---
const missingRows = []
for (const r of data) {
  const status = (r[idx('post_status')] || '').toLowerCase()
  if (status && !['publish', 'published', 'publicado', 'publicada'].includes(status)) continue
  if (isPerfume(r, idx)) continue

  const cats = parseWooCategories(r[idx('tax:product_cat')] || '')
  if (isVitaminsCategory(cats)) continue

  // missing from store entirely (active or inactive)
  if (findInMaps(r, idx, allMaps)) continue

  const sale = parsePrice(r[idx('sale_price')])
  const regular = parsePrice(r[idx('regular_price')])
  const price = sale ?? regular

  missingRows.push({
    nome: r[idx('post_title')],
    slug: r[idx('post_name')],
    sku: r[idx('sku')] || '',
    woo_id: r[idx('ID')] || '',
    preco: price ?? '',
    preco_regular: regular ?? '',
    preco_promocional: sale ?? '',
    categorias: cats.join(' | '),
    categoria_principal: cats[cats.length - 1] || cats[0] || '',
    marca: r[idx('tax:product_brand')] || r[idx('tax:pwb-brand')] || '',
    gtin: r[idx('meta:_wt_feed_gtin')] || r[idx('meta:_global_unique_id')] || '',
    estoque: r[idx('stock')] || '',
    status_estoque: r[idx('stock_status')] || '',
  })
}

const outHeaders = [
  'nome',
  'slug',
  'sku',
  'woo_id',
  'preco',
  'preco_regular',
  'preco_promocional',
  'categorias',
  'categoria_principal',
  'marca',
  'gtin',
  'estoque',
  'status_estoque',
]

const outLines = [
  outHeaders.join(','),
  ...missingRows.map((row) => outHeaders.map((h) => csvEscape(row[h])).join(',')),
]
const outPath = path.join(ROOT, 'produtos-faltantes-farmacia.csv')
fs.writeFileSync(outPath, '\uFEFF' + outLines.join('\n'), 'utf8')

const byCat = {}
for (const m of missingRows) {
  const c = m.categoria_principal || '(sem)'
  byCat[c] = (byCat[c] || 0) + 1
}

console.log(
  JSON.stringify(
    {
      priceUpdatesAttempted: priceUpdates.length,
      priceUpdatesOk: updateResults.filter((r) => r.ok).length,
      priceUpdatesFailed: updateResults.filter((r) => !r.ok).length,
      sampleUpdates: updateResults.slice(0, 5).map((u) => ({
        name: u.name,
        old: u.oldPrice,
        new: u.newPrice,
        original: u.newOriginal,
        ok: u.ok,
      })),
      missingExported: missingRows.length,
      missingByCategory: Object.entries(byCat)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      outPath,
    },
    null,
    2,
  ),
)
