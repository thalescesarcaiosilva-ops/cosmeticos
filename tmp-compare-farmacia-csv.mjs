import fs from 'node:fs'
import path from 'node:path'

const CSV_PATH = path.join('d:/lojadecosmeticosnova', 'todos os produtos farmácia.csv')
const STORE_JSON = path.join('d:/lojadecosmeticosnova', 'tmp-store-products.json')

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

function normalizeKey(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Strip marketing noise for fuzzy name match */
function normalizeProductName(s) {
  let n = normalizeKey(s)
  n = n.replace(/\b(eau de parfum|eau de toilette|edp|edt|refil|refill)\b/g, ' ')
  n = n.replace(/\b\d+\s*(ml|g|kg|un|und|caps|comp|sache|saches)\b/g, ' ')
  n = n.replace(/\s+/g, ' ').trim()
  return n
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
  const cats = parseWooCategories(row[idx('tax:product_cat')] || '')
  const catStr = cats.join(' ').toLowerCase()
  if (
    /\b(perfume|parfum|eau de parfum|eau de toilette|fragr[aâ]ncia|col[oô]nia)\b/.test(
      title,
    )
  )
    return true
  if (/\bperfum/.test(catStr)) return true
  return false
}

function tokenSetRatio(a, b) {
  const ta = new Set(a.split(' ').filter((t) => t.length > 1))
  const tb = new Set(b.split(' ').filter((t) => t.length > 1))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / Math.max(ta.size, tb.size)
}

const text = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '')
const rows = parseCSV(text)
const hdr = rows[0].map((h) => h.replace(/^\uFEFF/, ''))
const idx = (n) => hdr.indexOf(n)

const storeRaw = fs.readFileSync(STORE_JSON, 'utf8')
const storeProducts = JSON.parse(storeRaw)

const storeByWoo = new Map()
const storeBySku = new Map()
const storeByGtin = new Map()
const storeBySlug = new Map()
const storeNormNames = []

for (const p of storeProducts) {
  if (p.woocommerce_id) storeByWoo.set(Number(p.woocommerce_id), p)
  if (p.sku) storeBySku.set(normalizeKey(p.sku), p)
  if (p.gtin) storeByGtin.set(normalizeKey(p.gtin), p)
  if (p.slug) storeBySlug.set(normalizeKey(p.slug), p)
  const nn = normalizeProductName(p.name)
  if (nn) storeNormNames.push({ nn, p })
}

function findInStore(csvRow) {
  const wooId = Number(csvRow[idx('ID')])
  if (wooId && storeByWoo.has(wooId)) return { how: 'woocommerce_id', store: storeByWoo.get(wooId) }

  const sku = normalizeKey(csvRow[idx('sku')])
  if (sku && storeBySku.has(sku)) return { how: 'sku', store: storeBySku.get(sku) }

  const gtin = normalizeKey(
    csvRow[idx('meta:_wt_feed_gtin')] || csvRow[idx('meta:_global_unique_id')] || '',
  )
  if (gtin && storeByGtin.has(gtin)) return { how: 'gtin', store: storeByGtin.get(gtin) }

  const slug = normalizeKey(csvRow[idx('post_name')])
  if (slug && storeBySlug.has(slug)) return { how: 'slug', store: storeBySlug.get(slug) }

  const csvName = normalizeProductName(csvRow[idx('post_title')])
  if (csvName) {
    let best = null
    let bestScore = 0
    for (const { nn, p } of storeNormNames) {
      if (nn === csvName) return { how: 'name_exact', store: p }
      const score = tokenSetRatio(csvName, nn)
      if (score > bestScore) {
        bestScore = score
        best = p
      }
    }
    if (best && bestScore >= 0.92) return { how: `name_fuzzy_${Math.round(bestScore * 100)}`, store: best }
  }
  return null
}

const data = rows.slice(1).filter((r) => r.length > 1 && r[idx('post_title')])

let skippedPerfume = 0
let skippedVariation = 0
let skippedDraft = 0
const missing = []
const matched = []
const fuzzyMatches = []

for (const r of data) {
  const type = (r[idx('tax:product_type')] || 'simple').toLowerCase()
  if (type === 'variation') {
    skippedVariation++
    continue
  }
  const status = (r[idx('post_status')] || '').toLowerCase()
  if (status && !['publish', 'published', 'publicado', 'publicada'].includes(status)) {
    skippedDraft++
    continue
  }
  if (isPerfume(r, idx)) {
    skippedPerfume++
    continue
  }

  const hit = findInStore(r)
  const title = r[idx('post_title')]
  const cats = parseWooCategories(r[idx('tax:product_cat')] || '')
  const primaryCat = cats[cats.length - 1] || cats[0] || '(sem categoria)'
  const brand = r[idx('tax:product_brand')] || r[idx('tax:pwb-brand')] || ''

  if (!hit) {
    missing.push({
      title,
      slug: r[idx('post_name')],
      sku: r[idx('sku')] || '',
      wooId: r[idx('ID')],
      categories: cats,
      primaryCat,
      brand,
    })
  } else {
    matched.push({ title, how: hit.how, storeName: hit.store.name })
    if (hit.how.startsWith('name_fuzzy')) {
      fuzzyMatches.push({
        csvTitle: title,
        storeName: hit.store.name,
        how: hit.how,
      })
    }
  }
}

const missingCats = new Map()
for (const m of missing) {
  const key = m.primaryCat
  if (!missingCats.has(key)) missingCats.set(key, [])
  missingCats.get(key).push(m)
}

const storeCatNames = new Set(storeProducts.map((p) => p.category).filter(Boolean))

const report = {
  csvTotalRows: data.length,
  skippedPerfume,
  skippedVariation,
  skippedDraft,
  csvCompared: matched.length + missing.length,
  matchedInStore: matched.length,
  missingInStore: missing.length,
  fuzzyNameMatches: fuzzyMatches.length,
  storeActiveProducts: storeProducts.length,
  missingByPrimaryCategory: [...missingCats.entries()]
    .map(([cat, items]) => ({ category: cat, count: items.length }))
    .sort((a, b) => b.count - a.count),
  categoriesInMissingNotInStoreTable: [...missingCats.keys()].filter(
    (c) => c !== '(sem categoria)' && ![...storeCatNames].some((sc) => normalizeKey(sc) === normalizeKey(c)),
  ),
  sampleMissing: missing.slice(0, 40),
  sampleFuzzyMatches: fuzzyMatches.slice(0, 25),
  allMissingTitles: missing.map((m) => ({
    title: m.title,
    primaryCat: m.primaryCat,
    brand: m.brand,
    sku: m.sku,
  })),
}

fs.writeFileSync('d:/lojadecosmeticosnova/tmp-farmacia-missing-report.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  csvCompared: report.csvCompared,
  matched: report.matchedInStore,
  missing: report.missingInStore,
  skippedPerfume: report.skippedPerfume,
  topMissingCats: report.missingByPrimaryCategory.slice(0, 15),
  categoriesNotInStore: report.categoriesInMissingNotInStoreTable.slice(0, 30),
}, null, 2))
