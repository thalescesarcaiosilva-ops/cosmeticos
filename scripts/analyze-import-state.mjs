import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const text = fs.readFileSync('d:/produtoscosmeticosvalormercado_1000.csv', 'utf8').replace(/^\uFEFF/, '')

function parseCSV(input) {
  const rows = []
  let row = []
  let cur = ''
  let q = false
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (q) {
      if (c === '"' && input[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++
      row.push(cur); rows.push(row); row = []; cur = ''
    } else cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows
}

function parseWooImageField(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return []
  const results = []
  for (const segment of trimmed.split(/\s\|\s/)) {
    const url = segment.split(/\s!\s*alt\s*:/i)[0]?.trim()
    if (!url || !/^https?:\/\//i.test(url)) continue
    results.push(url)
  }
  return results
}

const rows = parseCSV(text)
const hdr = rows[0]
const idx = (n) => hdr.indexOf(n)
const products = []

for (const r of rows.slice(1)) {
  const status = (r[idx('post_status')] || '').trim().toLowerCase()
  if (!['publish', 'published', 'publicado', 'publicada', ''].includes(status)) continue
  const type = (r[idx('tax:product_type')] || 'simple').trim().toLowerCase()
  if (type !== 'simple') continue
  const wooId = parseInt(r[idx('ID')] || '', 10)
  const slug = (r[idx('post_name')] || '').trim()
  const price = parseFloat((r[idx('sale_price')] || r[idx('regular_price')] || '0').replace(',', '.'))
  if (!wooId || !slug || !price) continue
  const images = parseWooImageField(r[idx('images')] || '')
  products.push({ wooId, slug, images })
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: dbProducts } = await admin.from('products').select('id, woocommerce_id, slug')
const woo = new Set((dbProducts ?? []).map((p) => p.woocommerce_id).filter(Boolean))
const slugSet = new Set((dbProducts ?? []).map((p) => p.slug))

const inDb = products.filter((p) => woo.has(p.wooId) || slugSet.has(p.slug))
const pending = products.filter((p) => !woo.has(p.wooId) && !slugSet.has(p.slug))
const extraDb = (dbProducts ?? []).filter((p) => !products.some((r) => r.wooId === p.woocommerce_id || r.slug === p.slug))

let epocaOnly = 0, karlaOnly = 0, mixed = 0, noImg = 0, otherOnly = 0
for (const p of products) {
  if (!p.images.length) { noImg++; continue }
  const hasEpoca = p.images.some((u) => /epocacosmeticos/i.test(u))
  const hasKarla = p.images.some((u) => /karlacosmeticos/i.test(u))
  if (hasEpoca && !hasKarla) epocaOnly++
  else if (hasKarla && !hasEpoca) karlaOnly++
  else if (hasEpoca && hasKarla) mixed++
  else otherOnly++
}

console.log(JSON.stringify({
  csvProducts: products.length,
  inDb: inDb.length,
  pending: pending.length,
  extraInDb: extraDb.length,
  imageBreakdown: { epocaOnly, karlaOnly, mixed, otherOnly, noImg },
}, null, 2))
