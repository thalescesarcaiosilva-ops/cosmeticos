import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const CSV_PATH = path.join('d:/lojadecosmeticosnova', 'todos os produtos farmácia.csv')

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

function csvEffectivePrice(row, idx) {
  const sale = parsePrice(row[idx('sale_price')])
  const regular = parsePrice(row[idx('regular_price')])
  const price = sale ?? regular
  const original =
    sale && regular && regular > sale ? regular : regular && !sale ? null : regular
  return { price, regular, sale, originalPrice: sale && regular && regular > sale ? regular : null }
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

function tokenSetRatio(a, b) {
  const ta = new Set(a.split(' ').filter((t) => t.length > 1))
  const tb = new Set(b.split(' ').filter((t) => t.length > 1))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / Math.max(ta.size, tb.size)
}

const env = fs.readFileSync('d:/lojadecosmeticosnova/.env.local', 'utf8')
const url = env.match(/SUPABASE_URL=(.+)/)?.[1]?.trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()
const sb = createClient(url, key)

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

const storeByWoo = new Map()
const storeBySku = new Map()
const storeByGtin = new Map()
const storeBySlug = new Map()
const storeNormNames = []

for (const p of activeStore) {
  if (p.woocommerce_id) storeByWoo.set(Number(p.woocommerce_id), p)
  if (p.sku) storeBySku.set(normalizeKey(p.sku), p)
  if (p.gtin) storeByGtin.set(normalizeKey(p.gtin), p)
  if (p.slug) storeBySlug.set(normalizeKey(p.slug), p)
  const nn = normalizeProductName(p.name)
  if (nn) storeNormNames.push({ nn, p })
}

function findInStore(csvRow, idx) {
  const wooId = Number(csvRow[idx('ID')])
  if (wooId && storeByWoo.has(wooId)) return storeByWoo.get(wooId)

  const sku = normalizeKey(csvRow[idx('sku')])
  if (sku && storeBySku.has(sku)) return storeBySku.get(sku)

  const gtin = normalizeKey(
    csvRow[idx('meta:_wt_feed_gtin')] || csvRow[idx('meta:_global_unique_id')] || '',
  )
  if (gtin && storeByGtin.has(gtin)) return storeByGtin.get(gtin)

  const slug = normalizeKey(csvRow[idx('post_name')])
  if (slug && storeBySlug.has(slug)) return storeBySlug.get(slug)

  const csvName = normalizeProductName(csvRow[idx('post_title')])
  if (csvName) {
    for (const { nn, p } of storeNormNames) {
      if (nn === csvName) return p
    }
    let best = null
    let bestScore = 0
    for (const { nn, p } of storeNormNames) {
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

const comparisons = []
const noCsvPrice = []
const EPS = 0.009

for (const r of data) {
  const status = (r[idx('post_status')] || '').toLowerCase()
  if (status && !['publish', 'published', 'publicado', 'publicada'].includes(status)) continue
  if (isPerfume(r, idx)) continue

  const store = findInStore(r, idx)
  if (!store) continue

  const csvP = csvEffectivePrice(r, idx)
  if (csvP.price == null) {
    noCsvPrice.push({ name: store.name, slug: store.slug })
    continue
  }

  const storePrice = Number(store.price)
  const storeOriginal = store.original_price != null ? Number(store.original_price) : null
  const diff = Math.round((storePrice - csvP.price) * 100) / 100
  const pct =
    csvP.price > 0 ? Math.round((diff / csvP.price) * 1000) / 10 : null

  let verdict
  if (Math.abs(diff) <= EPS) verdict = 'igual'
  else if (storePrice > csvP.price) verdict = 'loja_mais_cara'
  else verdict = 'loja_mais_barata'

  comparisons.push({
    name: store.name,
    slug: store.slug,
    sku: store.sku,
    csvPrice: csvP.price,
    csvRegular: csvP.regular,
    csvSale: csvP.sale,
    storePrice,
    storeOriginal,
    diffVsCsv: diff,
    pctVsCsv: pct,
    verdict,
  })
}

const lojaMaisCara = comparisons
  .filter((c) => c.verdict === 'loja_mais_cara')
  .sort((a, b) => b.diffVsCsv - a.diffVsCsv)
const lojaMaisBarata = comparisons
  .filter((c) => c.verdict === 'loja_mais_barata')
  .sort((a, b) => a.diffVsCsv - b.diffVsCsv)
const iguais = comparisons.filter((c) => c.verdict === 'igual')

const report = {
  activeStoreCount: activeStore.length,
  matchedWithPrice: comparisons.length,
  noCsvPrice: noCsvPrice.length,
  lojaMaisCaraCount: lojaMaisCara.length,
  lojaMaisBarataCount: lojaMaisBarata.length,
  iguaisCount: iguais.length,
  totalDiffIfAlignedToCsv: Math.round(
    lojaMaisCara.reduce((s, c) => s + c.diffVsCsv, 0) * 100,
  ) / 100,
  lojaMaisCara,
  lojaMaisBarata,
  iguais,
}

fs.writeFileSync(
  'd:/lojadecosmeticosnova/tmp-price-compare-active.json',
  JSON.stringify(report, null, 2),
)

console.log(
  JSON.stringify(
    {
      matched: report.matchedWithPrice,
      loja_mais_cara_que_csv: report.lojaMaisCaraCount,
      loja_mais_barata_que_csv: report.lojaMaisBarataCount,
      iguais: report.iguaisCount,
      sem_preco_no_csv: report.noCsvPrice,
      top10_loja_mais_cara: lojaMaisCara.slice(0, 10).map((c) => ({
        name: c.name,
        loja: c.storePrice,
        csv: c.csvPrice,
        diff: c.diffVsCsv,
        pct: c.pctVsCsv,
      })),
    },
    null,
    2,
  ),
)
