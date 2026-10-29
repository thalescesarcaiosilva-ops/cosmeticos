// Fallback por EAN em outras lojas VTEX públicas (somente quando a Época não tem o produto).
import { readCache, writeCache, getJson, sleep } from './lib.mjs'

const STORES = {
  drogariasaopaulo: 'https://www.drogariasaopaulo.com.br',
  paguemenos: 'https://www.paguemenos.com.br',
  amobeleza: 'https://www.amobeleza.com.br',
  pacheco: 'https://www.drogariaspacheco.com.br',
}
const products = readCache('products.json', [])
const epoca = readCache('epoca.json', {})
const resolved = Object.fromEntries(readCache('resolved.json', []).map((r) => [r.id, r]))
const cache = readCache('vtex-extra.json', {})

const crude = (p) => p.description.replace(/<[^>]+>/g, '').trim().length < 200
const targets = products.filter(
  (p) =>
    p.nameSizes.length === 0 &&
    p.gtin &&
    !epoca[p.id]?.byEan &&
    (!resolved[p.id]?.size || crude(p))
)
console.log('targets', targets.length)

const eanVariants = (g) => {
  const d = String(g).replace(/\D/g, '')
  return [...new Set([d, d.replace(/^0+/, ''), d.padStart(13, '0')])].filter(Boolean)
}
function slim(p) {
  return {
    productName: p.productName,
    brand: p.brand,
    link: p.link,
    description: p.description,
    items: (p.items || []).map((it) => ({ name: it.name, nameComplete: it.nameComplete, ean: it.ean })),
  }
}

let done = 0
const queue = targets.filter((p) => !(p.id in cache))
async function worker() {
  while (queue.length) {
    const p = queue.shift()
    const rec = {}
    for (const [key, base] of Object.entries(STORES)) {
      try {
        for (const e of eanVariants(p.gtin)) {
          const r = await getJson(`${base}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${e}`)
          if (Array.isArray(r) && r.length) {
            rec[key] = slim(r[0])
            break
          }
        }
      } catch (e) {
        rec[key + '_error'] = e.message
      }
      await sleep(80)
    }
    cache[p.id] = rec
    if (++done % 40 === 0) {
      writeCache('vtex-extra.json', cache)
      console.log('extra', done, '/', done + queue.length)
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker))
writeCache('vtex-extra.json', cache)
const vals = targets.map((p) => cache[p.id])
for (const k of Object.keys(STORES)) console.log(k, vals.filter((v) => v?.[k]).length)
console.log('any', vals.filter((v) => Object.keys(STORES).some((k) => v?.[k])).length)
