// Busca cada produto da loja na Época e guarda só o anúncio vendido pela Época Cosméticos.
import fs from 'node:fs'
import path from 'node:path'
import {
  CACHE_DIR,
  findSizes,
  getJson,
  norm,
  sameProductName,
  sizeKey,
  sleep,
  supa,
  tokens,
  typeCompatible,
} from '../size-enrich/lib.mjs'

const OUT = path.join(CACHE_DIR, 'epoca-seller-matches.json')
const BASE = 'https://www.epocacosmeticos.com.br/api/catalog_system/pub/products/search'
const SELLER = 'epoca cosmeticos'

function readOut() {
  return fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
}
function writeOut(data) {
  fs.writeFileSync(OUT, JSON.stringify(data))
}

function eanVariants(g) {
  const d = String(g || '').replace(/\D/g, '')
  if (d.length < 8) return []
  const set = new Set([d, d.replace(/^0+/, '')])
  if (d.length === 14) {
    set.add(d.slice(1))
    set.add(d.slice(0, 13))
  }
  if (d.length === 13) set.add(`0${d}`)
  if (d.length === 12) set.add(`0${d}`)
  return [...set].filter((e) => e && e.length >= 8 && e.length <= 14)
}

function sizeKeysFromText(text) {
  const keys = new Set()
  for (const size of findSizes(String(text || ''))) {
    const key = sizeKey(size.label)
    if (key) keys.add(key)
  }
  return keys
}

function ourSizes(product) {
  const keys = sizeKeysFromText(product.name)
  for (const key of sizeKeysFromText(product.size_label)) keys.add(key)
  return keys
}

function itemSizes(product, item) {
  const chunks = [item?.name, item?.nameComplete, item?.['tamanho sku']?.[0]]
  for (const spec of product?.Tamanho || []) chunks.push(spec)
  const keys = new Set()
  for (const chunk of chunks) {
    for (const key of sizeKeysFromText(chunk)) keys.add(key)
  }
  return keys
}

function sizesCompatible(ours, theirs) {
  if (ours.size === 0 && theirs.size === 0) return true
  if (ours.size === 0 || theirs.size === 0) return false
  for (const key of ours) if (theirs.has(key)) return true
  return false
}

function overlap(a, b) {
  const left = tokens(a)
  const right = new Set(tokens(b))
  if (left.length === 0) return 0
  let hit = 0
  for (const token of left) if (right.has(token)) hit += 1
  return hit / left.length
}

function itemEanMatches(item, product) {
  const wanted = new Set(eanVariants(product.gtin))
  if (wanted.size === 0) return false
  for (const variant of eanVariants(item?.ean)) {
    if (wanted.has(variant)) return true
  }
  return false
}

function epocaOffer(item) {
  for (const seller of item?.sellers || []) {
    if (norm(seller.sellerName) !== SELLER) continue
    const offer = seller.commertialOffer || {}
    const price = Number(offer.Price)
    if (offer.IsAvailable && Number.isFinite(price) && price > 0) {
      return { sellerName: seller.sellerName, price }
    }
  }
  return null
}

function imageUrls(item) {
  const seen = new Set()
  const urls = []
  for (const image of item?.images || []) {
    const raw = image?.imageUrl
    if (!raw || seen.has(raw)) continue
    seen.add(raw)
    const hi = raw.replace(/\/ids\/(\d+)\//, '/ids/$1-1000-1000/')
    urls.push(hi)
    if (urls.length >= 6) break
  }
  return urls
}

function consider(product, epocaProduct, item, via) {
  const offer = epocaOffer(item)
  if (!offer) return null
  const ours = ourSizes(product)
  const theirs = itemSizes(epocaProduct, item)
  if (!sizesCompatible(ours, theirs)) return null
  const candidate = { productName: item.nameComplete || item.name || epocaProduct.productName, brand: epocaProduct.brand }
  const local = { name: product.name, brand: product.brand }
  const nameHit = sameProductName(local, candidate) && typeCompatible(product.name, candidate.productName)
  const ratio = overlap(product.name, candidate.productName)
  if (via === 'ean') {
    if (!itemEanMatches(item, product)) return null
    if (!nameHit && (ratio < 0.45 || !typeCompatible(product.name, candidate.productName))) return null
  } else if (!nameHit) {
    return null
  }
  return {
    status: 'match',
    via,
    ratio,
    nameHit,
    epocaProductId: epocaProduct.productId,
    epocaName: epocaProduct.productName,
    itemName: item.nameComplete || item.name,
    link: epocaProduct.link,
    seller: offer.sellerName,
    epocaPrice: offer.price,
    newPrice: Math.round(offer.price * 67) / 100,
    images: imageUrls(item),
  }
}

function pick(product, epocaProducts, via) {
  const matches = []
  let sawProduct = false
  let sawOtherSeller = false
  let eanConfirmed = false
  for (const epocaProduct of epocaProducts || []) {
    sawProduct = true
    for (const item of epocaProduct.items || []) {
      if (via === 'ean' && itemEanMatches(item, product)) eanConfirmed = true
      const sellers = item.sellers || []
      if (sellers.some((s) => norm(s.sellerName) === SELLER)) {
        const offer = epocaOffer(item)
        if (!offer && sellers.some((s) => norm(s.sellerName) !== SELLER && s.commertialOffer?.IsAvailable)) {
          sawOtherSeller = true
        }
      } else if (sellers.some((s) => s.commertialOffer?.IsAvailable && Number(s.commertialOffer?.Price) > 0)) {
        sawOtherSeller = true
      }
      const match = consider(product, epocaProduct, item, via)
      if (match) matches.push(match)
    }
  }
  if (matches.length === 0) {
    return {
      status: sawProduct ? (sawOtherSeller ? 'not_sold_by_epoca' : 'no_confident_match') : 'not_found',
      eanConfirmed,
    }
  }
  matches.sort((a, b) => b.ratio - a.ratio || Number(b.nameHit) - Number(a.nameHit))
  const best = matches[0]
  const rivals = matches.filter((m) => m.epocaProductId !== best.epocaProductId && m.ratio >= best.ratio - 0.05)
  if (rivals.length > 0 && via !== 'ean') {
    return { status: 'ambiguous', candidates: [best.epocaName, ...rivals.map((m) => m.epocaName)].slice(0, 4) }
  }
  return best
}

async function searchOne(product) {
  if (product.gtin) {
    for (const ean of eanVariants(product.gtin)) {
      const rows = await getJson(`${BASE}?fq=alternateIds_Ean:${encodeURIComponent(ean)}`)
      if (Array.isArray(rows) && rows.length > 0) {
        const picked = pick(product, rows, 'ean')
        if (picked.status === 'match') return picked
        if (picked.status === 'not_sold_by_epoca' && picked.eanConfirmed) return picked
      }
      await sleep(80)
    }
  }
  const query = norm(product.name).slice(0, 120)
  if (!query) return { status: 'not_found' }
  const rows = await getJson(`${BASE}?ft=${encodeURIComponent(query)}&_from=0&_to=7`)
  if (!Array.isArray(rows) || rows.length === 0) return { status: 'not_found' }
  return pick(product, rows, 'text')
}

const db = supa()
const [products, brands] = await Promise.all([
  db.select('products?select=id,name,slug,price,original_price,gtin,active,size_label,brand_id&order=name.asc'),
  db.select('brands?select=id,name'),
])
const brandName = new Map(brands.map((b) => [b.id, b.name]))
for (const product of products) product.brand = brandName.get(product.brand_id) || ''

const cache = readOut()
const queue = products.filter((p) => !cache[p.id])
console.log('products', products.length, 'pending', queue.length)

let done = 0
async function worker() {
  while (queue.length) {
    const product = queue.shift()
    let rec
    try {
      rec = await searchOne(product)
      rec.ok = true
    } catch (error) {
      rec = { status: 'error', ok: false, error: error instanceof Error ? error.message : String(error) }
    }
    rec.slug = product.slug
    rec.storeName = product.name
    rec.storePrice = product.price
    cache[product.id] = rec
    done += 1
    if (done % 25 === 0) {
      writeOut(cache)
      const match = Object.values(cache).filter((r) => r.status === 'match').length
      console.log('done', done, '/', done + queue.length, 'matches', match)
    }
    await sleep(140)
  }
}

await Promise.all(Array.from({ length: 3 }, () => worker()))
writeOut(cache)

const vals = Object.values(cache)
const tally = {}
for (const rec of vals) tally[rec.status] = (tally[rec.status] || 0) + 1
console.log(JSON.stringify(tally, null, 2))
const sample = vals.filter((r) => r.status === 'match').slice(0, 8)
for (const rec of sample) {
  console.log(`${rec.storePrice} -> ${rec.newPrice} | ${rec.storeName} <= ${rec.epocaPrice} ${rec.itemName}`)
}
