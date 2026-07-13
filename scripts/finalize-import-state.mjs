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

const rows = parseCSV(text)
const hdr = rows[0]
const idx = (n) => hdr.indexOf(n)
const csv = []

for (const r of rows.slice(1)) {
  const status = (r[idx('post_status')] || '').trim().toLowerCase()
  if (!['publish', 'published', 'publicado', 'publicada', ''].includes(status)) continue
  const type = (r[idx('tax:product_type')] || 'simple').trim().toLowerCase()
  if (type !== 'simple') continue
  const wooId = parseInt(r[idx('ID')] || '', 10)
  const slug = (r[idx('post_name')] || '').trim()
  const price = parseFloat((r[idx('sale_price')] || r[idx('regular_price')] || '0').replace(',', '.'))
  if (!wooId || !slug || !price) continue
  csv.push({ wooId, slug, name: r[idx('post_title')] })
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: db } = await admin.from('products').select('id, woocommerce_id, slug, name, active')

const matchedDbIds = new Map()
const unmatchedCsv = []

for (const row of csv) {
  const hit = (db ?? []).find((p) => p.woocommerce_id === row.wooId || p.slug === row.slug)
  if (!hit) {
    unmatchedCsv.push(row)
    continue
  }
  const list = matchedDbIds.get(hit.id) ?? []
  list.push(row)
  matchedDbIds.set(hit.id, list)
}

const collisions = [...matchedDbIds.entries()].filter(([, rows]) => rows.length > 1)
const unmatchedDb = (db ?? []).filter((p) => !csv.some((r) => r.wooId === p.woocommerce_id || r.slug === p.slug))

console.log(JSON.stringify({
  csvCount: csv.length,
  dbCount: db?.length,
  unmatchedCsv,
  unmatchedDb,
  collisions: collisions.map(([id, rows]) => ({ dbId: id, csvRows: rows })),
  inactiveInDb: (db ?? []).filter((p) => !p.active),
}, null, 2))
