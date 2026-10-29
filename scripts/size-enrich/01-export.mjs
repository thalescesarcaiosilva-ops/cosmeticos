// Exporta produtos ativos e classifica quem já tem tamanho (nome) e quem não tem.
import { supa, findSizes, writeCache } from './lib.mjs'

const db = supa()
const rows = await db.select(
  'products?select=id,name,slug,description,gtin,sku,size_label,brand:brands(name)&active=eq.true&order=name.asc'
)
const products = rows.map((r) => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.description || '',
  gtin: r.gtin || null,
  sku: r.sku || null,
  brand: Array.isArray(r.brand) ? r.brand[0]?.name : r.brand?.name || '',
  size_label: r.size_label || null,
}))

let withName = 0
let multi = 0
for (const p of products) {
  const sizes = findSizes(p.name)
  p.nameSizes = sizes.map((s) => s.label)
  if (sizes.length === 1) withName++
  if (sizes.length > 1) multi++
}
writeCache('products.json', products)
console.log({ total: products.length, nameOneSize: withName, nameMultiSize: multi, noSizeInName: products.length - withName - multi })
