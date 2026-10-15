import { readFileSync } from 'node:fs'

// dynamic import would run full script; duplicate minimal test for 3 products
const products = JSON.parse(readFileSync('tmp-active-products.json', 'utf8')).filter((p) =>
  /Monsieur Big|Azzaro Pour Homme|Bioderma Sébium H2O 500ml/i.test(p.name)
)

const { execSync } = await import('node:child_process')
// run inline by spawning node functions - simpler: just log names and run epoca only
for (const p of products) {
  const gtin = p.gtin
  const ep = await fetch(
    `https://www.epocacosmeticos.com.br/api/catalog_system/pub/products/search/?fq=alternateIds_Ean:${gtin}`
  ).then((r) => r.json())
  const epPrice = ep?.[0]?.items?.[0]?.sellers?.[0]?.commertialOffer?.Price
  console.log(p.name, 'loja', p.price, 'epoca', epPrice)
}
