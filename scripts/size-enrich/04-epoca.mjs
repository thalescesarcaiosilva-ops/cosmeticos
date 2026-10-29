// Consulta pública à API VTEX da Época Cosméticos: busca por EAN (exato) e, na falta, por texto.
import { readCache, writeCache, getJson, sleep, norm, strip } from './lib.mjs'

const BASE = 'https://www.epocacosmeticos.com.br/api/catalog_system/pub/products/search'
const products = readCache('products.json', [])
const targets = products.filter((p) => p.nameSizes.length === 0)
const cache = readCache('epoca.json', {})

function slimItem(it, p) {
  return {
    name: it.name,
    nameComplete: it.nameComplete,
    ean: it.ean,
    tamanho: it['tamanho sku']?.[0] || null,
  }
}
function slim(p) {
  return {
    productName: p.productName,
    brand: p.brand,
    link: p.link,
    description: p.description,
    tamanhoSpec: p['Tamanho'] || null,
    items: (p.items || []).map(slimItem),
  }
}

const eanVariants = (g) => {
  const d = String(g).replace(/\D/g, '')
  const set = new Set([d, d.replace(/^0+/, ''), d.padStart(13, '0'), d.padStart(14, '0')])
  return [...set].filter(Boolean)
}

let done = 0
const queue = targets.filter((p) => !(p.id in cache))
async function worker() {
  while (queue.length) {
    const p = queue.shift()
    const rec = { byEan: null, byText: [] }
    try {
      if (p.gtin) {
        for (const e of eanVariants(p.gtin)) {
          const r = await getJson(`${BASE}?fq=alternateIds_Ean:${e}`)
          if (Array.isArray(r) && r.length) {
            rec.byEan = slim(r[0])
            break
          }
          await sleep(100)
        }
      }
      if (!rec.byEan) {
        const q = encodeURIComponent(strip(p.name).replace(/[^\w\s%.,-]/g, ' ').replace(/\s+/g, ' ').trim())
        const r = await getJson(`${BASE}?ft=${q}&_from=0&_to=9`)
        rec.byText = (Array.isArray(r) ? r : []).map(slim)
      }
      rec.ok = true
    } catch (e) {
      rec.ok = false
      rec.error = e.message
    }
    cache[p.id] = rec
    if (++done % 50 === 0) {
      writeCache('epoca.json', cache)
      console.log('epoca', done, '/', done + queue.length)
    }
    await sleep(120)
  }
}
await Promise.all(Array.from({ length: 4 }, worker))
writeCache('epoca.json', cache)
const vals = targets.map((p) => cache[p.id])
console.log({
  targets: targets.length,
  byEan: vals.filter((v) => v?.byEan).length,
  textCandidates: vals.filter((v) => v?.byText?.length).length,
  failed: vals.filter((v) => v && !v.ok).length,
})
