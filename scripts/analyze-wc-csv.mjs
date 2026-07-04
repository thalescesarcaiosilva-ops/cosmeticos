import fs from 'node:fs'

const text = fs.readFileSync('c:/Users/rodri/product_export_2026-06-16-10-17-43.csv', 'utf8').replace(/^\uFEFF/, '')

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

const rows = parseCSV(text)
const hdr = rows[0]
const idx = (n) => hdr.indexOf(n)
const data = rows.slice(1).filter((r) => r.length > 1 && r[idx('post_title')])

console.log('products', data.length)
const types = {}
const statuses = {}
const cats = new Set()
const brands = new Set()
let withImages = 0

for (const r of data) {
  const t = r[idx('tax:product_type')] || ''
  types[t] = (types[t] || 0) + 1
  const s = r[idx('post_status')] || ''
  statuses[s] = (statuses[s] || 0) + 1
  const cat = r[idx('tax:product_cat')] || ''
  if (cat) cat.split('|').forEach((c) => cats.add(c.trim()))
  const b = r[idx('tax:pwb-brand')] || r[idx('tax:product_brand')] || ''
  if (b) brands.add(b)
  if (r[idx('images')]) withImages++
}

console.log('types', types)
console.log('statuses', statuses)
console.log('categories count', cats.size)
console.log('brands count', brands.size)
console.log('with images', withImages)
console.log('sample cats', [...cats].slice(0, 20))
console.log('sample brands', [...brands].slice(0, 15))

const sample = data.find((r) => r[idx('images')])
if (sample) {
  console.log('sample title', sample[idx('post_title')].slice(0, 80))
  console.log('sample slug', sample[idx('post_name')])
  console.log('sample sku', sample[idx('sku')])
  console.log('sample price', sample[idx('regular_price')], sample[idx('sale_price')])
  console.log('sample stock', sample[idx('stock')], sample[idx('stock_status')])
  console.log('sample images', sample[idx('images')].slice(0, 300))
  console.log('sample cat', sample[idx('tax:product_cat')])
  console.log('sample brand', sample[idx('tax:pwb-brand')], sample[idx('tax:product_brand')])
  console.log('sample excerpt len', (sample[idx('post_excerpt')] || '').length)
  console.log('sample yoast desc', (sample[idx('meta:_yoast_wpseo_metadesc')] || '').slice(0, 120))
  console.log('sample yoast title', sample[idx('meta:_yoast_wpseo_title')])
}

const simple = data.filter((r) => (r[idx('tax:product_type')] || 'simple') === 'simple')
console.log('simple products', simple.length)

const catSamples = new Set()
for (const r of data) {
  const cat = r[idx('tax:product_cat')] || ''
  if (cat.includes('|') || cat.includes('>')) catSamples.add(cat)
}
console.log('multi/hier cats', [...catSamples].slice(0, 10))

let emptySku = 0
let dupSlugs = new Map()
for (const r of data) {
  if (!r[idx('sku')]) emptySku++
  const slug = r[idx('post_name')]
  dupSlugs.set(slug, (dupSlugs.get(slug) || 0) + 1)
}
console.log('empty sku', emptySku)
console.log('duplicate slugs', [...dupSlugs.entries()].filter(([, n]) => n > 1))

function parseImages(raw) {
  if (!raw) return []
  return raw.split(',').map((part) => part.split(' ! alt')[0].trim()).filter(Boolean)
}
const multiImg = data.filter((r) => parseImages(r[idx('images')]).length > 1)
console.log('multi image products', multiImg.length)
if (multiImg[0]) console.log('multi sample', parseImages(multiImg[0][idx('images')]))

let zeroPrice = 0
for (const r of data) {
  const p = parseFloat(r[idx('regular_price')] || r[idx('sale_price')] || '0')
  if (!p || p <= 0) zeroPrice++
}
console.log('zero price', zeroPrice)
