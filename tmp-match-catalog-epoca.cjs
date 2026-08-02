const fs = require('fs')

const catalog = JSON.parse(fs.readFileSync('tmp-catalog-audit.json', 'utf8'))
const raw = JSON.parse(
  fs.readFileSync(
    'c:/importarprodutos/exportados/epoca_cosmeticos_1000_20260713_152010_raw.json',
    'utf8'
  )
)

const byWc = Object.fromEntries(
  catalog.keepPool.map((p) => [String(p.woocommerce_id), p])
)
const bySku = Object.fromEntries(
  catalog.keepPool.filter((p) => p.sku).map((p) => [String(p.sku), p])
)

let matchId = 0
let matchSku = 0
let unmatched = []
for (const r of raw) {
  if (byWc[String(r.product_id)]) matchId++
  else if (r.sku && bySku[String(r.sku)]) matchSku++
}

const perfumeRaw = raw.filter((r) =>
  (r.categorias || []).some((c) => /perfume|fragran/i.test(String(c)))
)

console.log({
  keepPool: catalog.keepPool.length,
  perfumeStore: catalog.perfume.length,
  raw: raw.length,
  matchByProductId: matchId,
  matchBySkuExtra: matchSku,
  sampleRawCats: raw[0].categorias,
  perfumeInRawApprox: perfumeRaw.length,
})

// sample rates extraction from one matched non-perfume
const sample = raw.find((r) => byWc[String(r.product_id)] && !/perfume/i.test(JSON.stringify(r.categorias || [])))
console.log('sample', sample?.nome, sample?.url, sample?.product_id)
